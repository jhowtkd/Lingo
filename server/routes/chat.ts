import express from 'express';
import { ModelRouter, ModelRouterError } from '../ai/modelRouter';
import { TutorPromptBuilder } from '../ai/tutorPrompt';
import { PedagogicalAnalyzer } from '../ai/pedagogicalAnalyzer';
import { sanitizeTutorChatPayload, TutorStreamEvent } from '../ai/tutorContracts';
import { AiTelemetry } from '../observability/aiTelemetry';
import { getLanguageConfig } from '../../src/config/languages';
import { generateLocalLanguageTutorResponse } from '../ai/localTutorFallback';

export const chatRouter = express.Router();

/**
 * Endpoint de Streaming do Tutor (NDJSON streaming)
 * Emite: meta -> delta... -> response_complete -> pedagogical_analysis
 */
chatRouter.post('/stream', async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startTime = Date.now();
  let timeToFirstChunkMs: number | undefined = undefined;
  let fullText = '';
  let modelUsed = 'gemini-3.7-flash';
  let isDegraded = false;

  const sanitized = sanitizeTutorChatPayload(req.body);
  const langConfig = getLanguageConfig(sanitized.language);

  if (!sanitized.message) {
    return res.status(400).json({ error: 'Mensagem é obrigatória' });
  }

  // Configura headers para streaming NDJSON
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Request-Id', requestId);
  res.flushHeaders?.();

  const sendEvent = (event: TutorStreamEvent) => {
    if (!res.writableEnded) {
      res.write(JSON.stringify(event) + '\n');
    }
  };

  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  try {
    const systemInstruction = TutorPromptBuilder.buildSystemInstruction(sanitized);
    const contents = TutorPromptBuilder.buildContents(sanitized);

    // Envia evento inicial com metadados da requisição
    sendEvent({
      type: 'meta',
      requestId,
      modelRequested: 'gemini-3.7-flash',
      degraded: false,
      language: langConfig.displayName,
      cefrLevel: sanitized.cefrLevel,
    });

    // 1. Estágio A: Stream da resposta conversacional
    const streamGenerator = ModelRouter.generateContentStream(
      {
        contents,
        systemInstruction,
        config: {
          temperature: 0.7,
        },
      },
      {
        preferredModel: 'gemini-3.7-flash',
        fallbackModels: ['gemini-3.1-flash-lite'],
        signal: abortController.signal,
      }
    );

    for await (const chunk of streamGenerator) {
      if (!timeToFirstChunkMs) {
        timeToFirstChunkMs = Date.now() - startTime;
      }
      modelUsed = chunk.modelUsed;
      isDegraded = chunk.degraded;
      fullText += chunk.chunkText;

      sendEvent({
        type: 'delta',
        text: chunk.chunkText,
      });
    }

    const durationMs = Date.now() - startTime;

    // Envia evento de conclusão do texto visível
    sendEvent({
      type: 'response_complete',
      fullText,
      modelUsed,
      degraded: isDegraded,
      durationMs,
    });

    // 2. Estágio B: Analisador pedagógico em segundo plano
    const analysis = await PedagogicalAnalyzer.analyzeTurn(
      sanitized,
      fullText,
      abortController.signal
    );

    sendEvent({
      type: 'pedagogical_analysis',
      analysis,
    });

    // Registra telemetria
    AiTelemetry.record({
      requestId,
      route: '/api/chat/stream',
      modelRequested: 'gemini-3.7-flash',
      modelUsed,
      fallbackIndex: isDegraded ? 1 : 0,
      degraded: isDegraded,
      durationMs,
      timeToFirstChunkMs,
      inputCharacters: sanitized.message.length,
      historyItems: sanitized.recentHistory.length,
      memoryItems: sanitized.relevantMemories.length,
      language: langConfig.id,
      cefrLevel: sanitized.cefrLevel,
      status: isDegraded ? 'degraded' : 'success',
    });

    res.end();
  } catch (err: any) {
    const isAborted = err instanceof ModelRouterError && err.code === 'ABORTED';
    if (isAborted) {
      res.end();
      return;
    }

    const isAuthOrUnavailable =
      (err instanceof ModelRouterError &&
        (err.code === 'AUTH_ERROR' || err.code === 'NO_API_KEY' || err.code === 'MODEL_UNAVAILABLE')) ||
      (err?.message || '').toLowerCase().includes('api_key') ||
      (err?.message || '').toLowerCase().includes('api key');

    if (isAuthOrUnavailable && !timeToFirstChunkMs) {
      console.warn(`[Chat Stream] Chave inválida ou indisponível. Acionando motor pedagógico local para req=${requestId}`);
      const fallback = generateLocalLanguageTutorResponse(
        sanitized.message,
        sanitized.topic || 'Conversação Geral',
        sanitized.language || 'Inglês',
        sanitized.relevantMemories || [],
        (req.body as any).adaptationPreference,
        (req.body as any).studyPlan
      );

      sendEvent({
        type: 'delta',
        text: fallback.resposta_tutor,
      });

      sendEvent({
        type: 'response_complete',
        fullText: fallback.resposta_tutor,
        modelUsed: 'local-pedagogical-fallback',
        degraded: true,
        durationMs: Date.now() - startTime,
      });

      const events: any[] = fallback.correcao
        ? [
            {
              type: 'grammar_error',
              evidence: fallback.correcao.evidencia,
              correctedForm: fallback.correcao.resposta_corrigida,
              explanation: fallback.correcao.explicacao,
              confidence: 0.95,
              severity:
                fallback.correcao.gravidade === 'critica'
                  ? 'high'
                  : fallback.correcao.gravidade === 'moderada'
                  ? 'medium'
                  : 'low',
              language: sanitized.language,
            },
          ]
        : [];

      sendEvent({
        type: 'pedagogical_analysis',
        analysis: {
          hasError: fallback.possui_erro,
          events,
          adaptationNotice:
            fallback.adaptacao?.rotulo ||
            fallback.adaptacao?.justificativa ||
            'Adaptação pedagógica aplicada',
          xpEarned: fallback.xp_ganho,
        },
      });

      AiTelemetry.record({
        requestId,
        route: '/api/chat/stream',
        modelRequested: 'gemini-3.7-flash',
        fallbackIndex: 1,
        degraded: true,
        durationMs: Date.now() - startTime,
        inputCharacters: sanitized.message.length,
        historyItems: sanitized.recentHistory.length,
        memoryItems: sanitized.relevantMemories.length,
        language: langConfig.id,
        cefrLevel: sanitized.cefrLevel,
        status: 'degraded',
      });

      res.end();
      return;
    }

    const errorCode = err?.code || 'STREAM_ERROR';
    console.error(`[Chat Stream Error] req=${requestId}:`, err?.message || err);

    sendEvent({
      type: 'error',
      code: errorCode,
      message: err?.message || 'Falha ao processar resposta do tutor.',
      retryable: Boolean(err?.retryable ?? true),
    });

    AiTelemetry.record({
      requestId,
      route: '/api/chat/stream',
      modelRequested: 'gemini-3.7-flash',
      fallbackIndex: 0,
      degraded: false,
      durationMs: Date.now() - startTime,
      inputCharacters: sanitized.message.length,
      historyItems: sanitized.recentHistory.length,
      memoryItems: sanitized.relevantMemories.length,
      language: langConfig.id,
      cefrLevel: sanitized.cefrLevel,
      status: 'error',
      errorCode,
    });

    res.end();
  }
});

/**
 * Endpoint síncrono legado para compatibilidade direta, com contrato compacto
 */
chatRouter.post('/', async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startTime = Date.now();

  const sanitized = sanitizeTutorChatPayload(req.body);
  const langConfig = getLanguageConfig(sanitized.language);

  if (!sanitized.message) {
    return res.status(400).json({ error: 'Mensagem é obrigatória' });
  }

  try {
    const systemInstruction = TutorPromptBuilder.buildSystemInstruction(sanitized);
    const contents = TutorPromptBuilder.buildContents(sanitized);

    // 1. Gera resposta do tutor visível
    const result = await ModelRouter.generateContent(
      {
        contents,
        systemInstruction,
        config: {
          temperature: 0.7,
        },
      },
      {
        preferredModel: 'gemini-3.7-flash',
        fallbackModels: ['gemini-3.1-flash-lite'],
      }
    );

    const tutorText = result.data.text?.trim() || '';

    // 2. Analisador pedagógico (Estágio B)
    const analysis = await PedagogicalAnalyzer.analyzeTurn(sanitized, tutorText);

    const durationMs = Date.now() - startTime;

    AiTelemetry.record({
      requestId,
      route: '/api/chat',
      modelRequested: 'gemini-3.7-flash',
      modelUsed: result.modelUsed,
      fallbackIndex: result.fallbackIndex,
      degraded: result.degraded,
      durationMs,
      inputCharacters: sanitized.message.length,
      historyItems: sanitized.recentHistory.length,
      memoryItems: sanitized.relevantMemories.length,
      language: langConfig.id,
      cefrLevel: sanitized.cefrLevel,
      status: result.degraded ? 'degraded' : 'success',
    });

    // Constrói objeto de correção estruturada se houver desvio pedagógico detectado
    const errorEvent = analysis.events.find(
      (e) => e.type !== 'correct_use' && e.type !== 'fluency_signal'
    );
    const correcao = (analysis.hasError || errorEvent) && errorEvent
      ? {
          conceito: errorEvent.skillId,
          erro: errorEvent.evidence,
          explicacao: errorEvent.explanation || 'Identificado desvio no padrão do idioma alvo.',
          resposta_corrigida: errorEvent.correctedForm || tutorText,
          gravidade:
            errorEvent.severity === 'high'
              ? 'critica'
              : errorEvent.severity === 'low'
              ? 'leve'
              : 'moderada',
          evidencia: errorEvent.evidence,
          pergunta_confirmacao: `Como você diria "${errorEvent.correctedForm || errorEvent.skillId}" em uma frase curta?`,
        }
      : undefined;

    const conceitos_chave = Array.from(new Set(analysis.events.map((e) => e.skillId)));
    const novos_nos_grafo = analysis.events.map((e) => ({
      titulo: e.skillId,
      tipo:
        e.type === 'false_friend'
          ? 'falso_amigo'
          : e.type === 'correct_use'
          ? 'vocabulario'
          : 'gramatica',
      descricao: e.explanation || e.evidence,
      exemplo_uso: e.correctedForm || e.evidence,
      dominio_estimado: e.type === 'correct_use' ? 65 : 35,
      frequencia_erro: e.type === 'correct_use' ? 0 : 1,
    }));

    return res.json({
      requestId,
      resposta_tutor: tutorText,
      possui_erro: analysis.hasError,
      events: analysis.events,
      correcao,
      conceitos_chave,
      novos_nos_grafo,
      adaptacao: analysis.adaptationNotice,
      xp_ganho: analysis.xpEarned,
      modelUsed: result.modelUsed,
      degraded: result.degraded,
      fallbackUsed: result.degraded,
    });
  } catch (err: any) {
    const isAuthOrUnavailable =
      (err instanceof ModelRouterError &&
        (err.code === 'AUTH_ERROR' || err.code === 'NO_API_KEY' || err.code === 'MODEL_UNAVAILABLE')) ||
      (err?.message || '').toLowerCase().includes('api_key') ||
      (err?.message || '').toLowerCase().includes('api key');

    if (isAuthOrUnavailable) {
      console.warn(`[Chat Tutor] Chave inválida ou indisponível. Acionando motor pedagógico local para req=${requestId}`);
      const fallback = generateLocalLanguageTutorResponse(
        sanitized.message,
        sanitized.topic || 'Conversação Geral',
        sanitized.language || 'Inglês',
        sanitized.relevantMemories || [],
        (req.body as any).adaptationPreference,
        (req.body as any).studyPlan
      );

      return res.json({
        requestId,
        resposta_tutor: fallback.resposta_tutor,
        possui_erro: fallback.possui_erro,
        events: [],
        correcao: fallback.correcao,
        conceitos_chave: fallback.conceitos_chave,
        novos_nos_grafo: fallback.novos_nos_grafo,
        adaptacao: fallback.adaptacao,
        xp_ganho: fallback.xp_ganho,
        modelUsed: 'local-pedagogical-fallback',
        degraded: true,
        fallbackUsed: true,
      });
    }

    console.error(`[Chat Error] req=${requestId}:`, err);
    return res.status(500).json({
      requestId,
      error: err?.message || 'Erro ao gerar resposta do tutor.',
      code: err?.code || 'CHAT_ERROR',
      retryable: err?.retryable ?? true,
    });
  }
});
