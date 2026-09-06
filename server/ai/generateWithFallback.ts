import type { GoogleGenAI } from '@google/genai';
import { AiTelemetry } from '../observability/aiTelemetry';

/**
 * Gerenciador de cooldown de modelos para evitar chamadas repetidas a endpoints em 503.
 * Estado de módulo: o cooldown de um modelo persiste entre chamadas (e testes)
 * no mesmo processo — é o que permite pular modelos resfriados na chamada seguinte.
 */
const modelCooldownMap = new Map<string, number>();

export interface GenerateWithFallbackOptions {
  client: GoogleGenAI;
  params: { model?: string; contents?: any; config?: any };
  fallbackModels?: string[];
  route: string;
  requestId?: string;
  timeoutMs?: number;
}

/** Isolamento entre testes: limpa o mapa de cooldown (estado de módulo). */
export function resetModelCooldownForTests(): void {
  modelCooldownMap.clear();
}

/**
 * Executa chamadas ao Gemini com retry inteligente, cooldown ativo e fallback automático de modelos
 * para 503 (High Demand/UNAVAILABLE), 429 e erros transitórios. Comportamento idêntico ao helper
 * legado que vivia em server.ts, com telemetria por rota (AiTelemetry) e timeout configurável.
 */
export async function generateWithFallback(options: GenerateWithFallbackOptions): Promise<any> {
  const preferredModel = options.params.model || 'gemini-3.7-flash';
  const fallbackModels =
    options.fallbackModels || ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash'];
  // requestId é opcional para chamadores sem contexto de request; sem ele,
  // geramos um id sintético só para a telemetria continuar rastreável.
  const requestId = options.requestId || `gwfb-${options.route}-${Date.now()}`;
  const inputCharacters = JSON.stringify(options.params.contents ?? '').length;
  const startedAt = Date.now();
  const now = Date.now();

  // Lista base de modelos a tentar
  const allCandidates = Array.from(new Set([preferredModel, ...fallbackModels]));

  // Ordena modelos colocando na frente aqueles que NÃO estão em cooldown de 503
  const modelsToTry = allCandidates.sort((a, b) => {
    const aCool = (modelCooldownMap.get(a) || 0) > now ? 1 : 0;
    const bCool = (modelCooldownMap.get(b) || 0) > now ? 1 : 0;
    return aCool - bCool;
  });

  let lastError: any = null;
  // Índice do modelo dentro da lista de modelos efetivamente tentados
  // (modelos pulados por cooldown não contam).
  let attemptIndex = 0;
  // Último modelo que chegou a ser tentado (para o registro de erro final).
  let lastAttemptedModel: string | undefined;

  for (const modelName of modelsToTry) {
    const isCoolingDown = (modelCooldownMap.get(modelName) || 0) > now;
    if (isCoolingDown && modelsToTry.length > 1) {
      // Se há alternativas disponíveis, pula modelos em cooldown recente de 503
      continue;
    }

    const attemptIndexForThisTry = attemptIndex;
    attemptIndex++;
    lastAttemptedModel = modelName;
    const attemptStartedAt = Date.now();

    try {
      // Deadline por tentativa: sem isso um Gemini travado pendura a conexão
      // por minutos e o fallback nunca é acionado. Aborta a request real.
      // O chamador pode calibrar (server.ts passa GEMINI_TIMEOUT_MS via appEnv).
      const perAttemptTimeoutMs = options.timeoutMs ?? 60000;
      const attemptCtrl = new AbortController();
      const timeoutTimer = setTimeout(
        () => attemptCtrl.abort(new Error(`Timeout de ${perAttemptTimeoutMs}ms excedido no modelo ${modelName}`)),
        perAttemptTimeoutMs
      );
      let response: any;
      try {
        response = await options.client.models.generateContent({
          ...options.params,
          // `contents` é opcional no contrato do helper (testes usam params mínimos),
          // mas é obrigatório para o SDK — chamadores reais sempre o fornecem.
          contents: options.params.contents ?? '',
          model: modelName,
          config: { ...(options.params.config || {}), abortSignal: attemptCtrl.signal },
        });
      } finally {
        clearTimeout(timeoutTimer);
      }
      // Sucesso: remove do cooldown se estiver lá
      modelCooldownMap.delete(modelName);
      // Telemetria de sucesso por modelo (fallback bem-sucedido entra aqui com degraded=true).
      AiTelemetry.record({
        requestId,
        route: options.route,
        modelRequested: preferredModel,
        modelUsed: modelName,
        fallbackIndex: attemptIndexForThisTry,
        degraded: modelName !== preferredModel,
        durationMs: Date.now() - attemptStartedAt,
        inputCharacters,
        status: 'success',
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errMsg = (err?.message || String(err)).toLowerCase();
      const is503HighDemand =
        errMsg.includes('503') ||
        errMsg.includes('unavailable') ||
        errMsg.includes('high demand') ||
        errMsg.includes('spikes in demand');
      const isRateLimit =
        errMsg.includes('429') ||
        errMsg.includes('resource has been exhausted') ||
        errMsg.includes('rate limit');

      if (is503HighDemand || isRateLimit) {
        // Registra cooldown de 30 segundos para não insistir no modelo com sobrecarga
        modelCooldownMap.set(modelName, Date.now() + 30000);
        console.info(
          `[Gemini Auto-Fallback] Modelo ${modelName} em alta demanda (503/429). Chaveando para próximo modelo saudável da lista.`
        );
        // Não tenta de novo o mesmo modelo saturado; passa direto para o fallback (ex: gemini-3.1-flash-lite)
        continue;
      }

      console.warn(`[Gemini Resiliente] Modelo ${modelName} retornou erro:`, errMsg.slice(0, 120));
      // Telemetria de erro fica para o throw final (um único registro por chamada falha).
    }
  }

  // Todos os candidatos falharam (ou foram pulados): registra o erro final uma única vez.
  AiTelemetry.record({
    requestId,
    route: options.route,
    modelRequested: preferredModel,
    fallbackIndex: Math.max(attemptIndex - 1, 0),
    degraded: lastAttemptedModel !== undefined && lastAttemptedModel !== preferredModel,
    durationMs: Date.now() - startedAt,
    inputCharacters,
    status: 'error',
    errorCode: lastError ? String(lastError?.message || lastError).slice(0, 120) : 'all_models_failed',
  });

  throw lastError || new Error('Todos os modelos de IA falharam temporariamente');
}
