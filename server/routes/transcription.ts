import express from 'express';
import { ModelRouter } from '../ai/modelRouter';
import { getLanguageConfig } from '../../src/config/languages';
import { AiTelemetry } from '../observability/aiTelemetry';

export const transcriptionRouter = express.Router();

transcriptionRouter.post('/', async (req, res) => {
  const requestId = `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const startTime = Date.now();

  try {
    const { audio_base64, mime_type = 'audio/webm', idioma = 'Inglês' } = req.body;

    if (!audio_base64 || typeof audio_base64 !== 'string') {
      return res.status(400).json({ error: 'Nenhum dado de áudio fornecido para transcrição' });
    }

    const langConfig = getLanguageConfig(idioma);
    const cleanBase64 = audio_base64.replace(/^data:[^;]+;base64,/, '');

    const result = await ModelRouter.generateContent(
      {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mime_type,
                data: cleanBase64,
              },
            },
            {
              text: `Transcreva exatamente as palavras faladas pelo estudante no idioma ${langConfig.displayName} (${langConfig.bcp47}). Retorne apenas o texto transcrito em texto puro, sem aspas, preâmbulos ou pontuação inventada.`,
            },
          ],
        },
      },
      {
        preferredModel: 'gemini-3.7-flash',
        fallbackModels: ['gemini-3.1-flash-lite'],
        perAttemptTimeoutMs: 8000,
        deadlineMs: 12000,
      }
    );

    const transcribedText = (result.data.text || '').trim();

    AiTelemetry.record({
      requestId,
      route: '/api/transcribe',
      modelRequested: 'gemini-3.7-flash',
      modelUsed: result.modelUsed,
      fallbackIndex: result.fallbackIndex,
      degraded: result.degraded,
      durationMs: Date.now() - startTime,
      inputCharacters: cleanBase64.length,
      historyItems: 0,
      memoryItems: 0,
      language: langConfig.id,
      cefrLevel: 'B1',
      status: 'success',
    });

    return res.json({
      requestId,
      texto: transcribedText,
      language: langConfig.bcp47,
      modelUsed: result.modelUsed,
    });
  } catch (err: any) {
    console.error(`[Transcription Error] req=${requestId}:`, err?.message || err);

    AiTelemetry.record({
      requestId,
      route: '/api/transcribe',
      modelRequested: 'gemini-3.7-flash',
      fallbackIndex: 0,
      degraded: false,
      durationMs: Date.now() - startTime,
      inputCharacters: 0,
      historyItems: 0,
      memoryItems: 0,
      language: 'unknown',
      cefrLevel: 'B1',
      status: 'error',
      errorCode: err?.code || 'TRANSCRIPTION_FAILED',
    });

    // Erro real e explícito: NÃO inventar frases que o usuário não falou!
    return res.status(502).json({
      requestId,
      error: 'transcription_failed',
      message: 'Não foi possível transcrever o áudio com clareza. Por favor, tente falar novamente.',
      retryable: true,
    });
  }
});
