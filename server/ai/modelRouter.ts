import { GoogleGenAI } from '@google/genai';

export interface ModelAttemptResult<T> {
  data: T;
  modelUsed: string;
  fallbackIndex: number;
  degraded: boolean;
  durationMs: number;
}

export interface ModelRouterOptions {
  deadlineMs?: number;
  perAttemptTimeoutMs?: number;
  preferredModel?: string;
  fallbackModels?: string[];
  signal?: AbortSignal;
}

export class ModelRouterError extends Error {
  constructor(
    public code:
      | 'TIMEOUT'
      | 'RATE_LIMITED'
      | 'MODEL_UNAVAILABLE'
      | 'AUTH_ERROR'
      | 'ABORTED'
      | 'NO_API_KEY'
      | 'UNKNOWN',
    message: string,
    public retryable: boolean = true,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ModelRouterError';
  }
}

export class ModelRouter {
  private static geminiClient: GoogleGenAI | null = null;
  private static modelCooldownMap: Map<string, number> = new Map();

  static getClient(): GoogleGenAI | null {
    if (this.geminiClient) return this.geminiClient;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    this.geminiClient = new GoogleGenAI({ apiKey });
    return this.geminiClient;
  }

  static isModelInCooldown(modelName: string): boolean {
    const expiresAt = this.modelCooldownMap.get(modelName);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.modelCooldownMap.delete(modelName);
      return false;
    }
    return true;
  }

  static setModelCooldown(modelName: string, durationMs = 25000): void {
    this.modelCooldownMap.set(modelName, Date.now() + durationMs);
  }

  /**
   * Executa geração de conteúdo com timeouts rígidos, abort signal e fallback explícito
   */
  static async generateContent<T = any>(
    params: {
      contents: any;
      config?: any;
      systemInstruction?: string;
    },
    options: ModelRouterOptions = {}
  ): Promise<ModelAttemptResult<any>> {
    const client = this.getClient();
    if (!client) {
      throw new ModelRouterError('NO_API_KEY', 'GEMINI_API_KEY não configurada no ambiente.', false);
    }

    const preferredModel = options.preferredModel || 'gemini-3.7-flash';
    const fallbackList = options.fallbackModels || ['gemini-3.1-flash-lite'];
    const candidates = Array.from(new Set([preferredModel, ...fallbackList]));

    const perAttemptTimeoutMs = options.perAttemptTimeoutMs || 10000;
    const deadlineMs = options.deadlineMs || 18000;
    const startTime = Date.now();

    let lastError: any = null;

    for (let i = 0; i < candidates.length; i++) {
      const modelName = candidates[i];
      const isDegraded = modelName !== preferredModel;

      // Verifica deadline total
      if (Date.now() - startTime > deadlineMs) {
        throw new ModelRouterError('TIMEOUT', `Deadline de ${deadlineMs}ms excedido antes de tentar ${modelName}.`, true);
      }

      // Verifica abort do cliente
      if (options.signal?.aborted) {
        throw new ModelRouterError('ABORTED', 'Requisição cancelada pelo cliente.', false);
      }

      // Pula modelo em cooldown se houver alternativas
      if (this.isModelInCooldown(modelName) && i < candidates.length - 1) {
        continue;
      }

      try {
        const attemptStart = Date.now();
        const callPromise = client.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: {
            ...params.config,
            systemInstruction: params.systemInstruction || params.config?.systemInstruction,
          },
        });

        // Timeout por tentativa
        const timeoutPromise = new Promise((_, reject) => {
          const t = setTimeout(() => {
            reject(new ModelRouterError('TIMEOUT', `Timeout de ${perAttemptTimeoutMs}ms no modelo ${modelName}`, true));
          }, perAttemptTimeoutMs);

          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(t);
              reject(new ModelRouterError('ABORTED', 'Requisição abortada pelo cliente.', false));
            });
          }
        });

        const response: any = await Promise.race([callPromise, timeoutPromise]);
        const durationMs = Date.now() - attemptStart;

        // Limpa cooldown em caso de sucesso
        this.modelCooldownMap.delete(modelName);

        return {
          data: response,
          modelUsed: modelName,
          fallbackIndex: i,
          degraded: isDegraded,
          durationMs,
        };
      } catch (err: any) {
        lastError = err;
        const msg = (err?.message || String(err)).toLowerCase();

        const is503 = msg.includes('503') || msg.includes('unavailable') || msg.includes('high demand');
        const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('rate limit');
        const isAuth = msg.includes('api_key_invalid') || msg.includes('unauthenticated') || msg.includes('permission_denied');

        if (isAuth) {
          throw new ModelRouterError('AUTH_ERROR', 'Chave de API inválida ou sem permissão.', false, err);
        }

        if (is503 || is429) {
          this.setModelCooldown(modelName, 30000);
        }

        if (err instanceof ModelRouterError && err.code === 'ABORTED') {
          throw err;
        }
      }
    }

    throw new ModelRouterError(
      'MODEL_UNAVAILABLE',
      `Todos os modelos (${candidates.join(', ')}) falharam. Último erro: ${lastError?.message || lastError}`,
      true,
      lastError
    );
  }

  /**
   * Executa streaming de texto conversacional com @google/genai
   */
  static async *generateContentStream(
    params: {
      contents: any;
      config?: any;
      systemInstruction?: string;
    },
    options: ModelRouterOptions = {}
  ): AsyncGenerator<{ chunkText: string; modelUsed: string; degraded: boolean }> {
    const client = this.getClient();
    if (!client) {
      throw new ModelRouterError('NO_API_KEY', 'GEMINI_API_KEY não configurada.', false);
    }

    const preferredModel = options.preferredModel || 'gemini-3.7-flash';
    const fallbackList = options.fallbackModels || ['gemini-3.1-flash-lite'];
    const candidates = Array.from(new Set([preferredModel, ...fallbackList]));

    let streamEstablished = false;

    for (let i = 0; i < candidates.length; i++) {
      const modelName = candidates[i];
      const isDegraded = modelName !== preferredModel;

      if (this.isModelInCooldown(modelName) && i < candidates.length - 1) {
        continue;
      }

      if (options.signal?.aborted) {
        throw new ModelRouterError('ABORTED', 'Requisição abortada.', false);
      }

      try {
        const responseStream = await client.models.generateContentStream({
          model: modelName,
          contents: params.contents,
          config: {
            ...params.config,
            systemInstruction: params.systemInstruction || params.config?.systemInstruction,
          },
        });

        streamEstablished = true;
        this.modelCooldownMap.delete(modelName);

        for await (const chunk of responseStream) {
          if (options.signal?.aborted) {
            return;
          }
          const text = chunk.text || '';
          if (text) {
            yield {
              chunkText: text,
              modelUsed: modelName,
              degraded: isDegraded,
            };
          }
        }
        return;
      } catch (err: any) {
        if (streamEstablished) {
          // Se o stream já havia começado a emitir chunks para o cliente, não podemos reiniciar com outro modelo no meio
          throw err;
        }

        const msg = (err?.message || String(err)).toLowerCase();
        if (msg.includes('503') || msg.includes('429') || msg.includes('unavailable')) {
          this.setModelCooldown(modelName, 30000);
        }
      }
    }

    throw new ModelRouterError('MODEL_UNAVAILABLE', 'Não foi possível estabelecer stream com os modelos disponíveis.', true);
  }
}
