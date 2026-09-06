import express from 'express';
import { createHash } from 'crypto';
import { Type } from '@google/genai';
import { ModelRouter } from '../ai/modelRouter';
import { GeminiResponseCache } from '../ai/geminiCache';
import { getLanguageConfig } from '../../src/config/languages';
import { AiTelemetry } from '../observability/aiTelemetry';

export const pronunciationRouter = express.Router();

// Avaliar o mesmo áudio duas vezes (usuário re-checa a gravação) não deve
// gerar outra chamada multimodal paga: cache por hash do áudio + referência.
const pronunciationCache = new GeminiResponseCache<any>(200, 15 * 60_000);

pronunciationRouter.post('/', async (req, res) => {
  const requestId = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const startTime = Date.now();

  try {
    const {
      audio_base64,
      mime_type = 'audio/webm',
      texto_falado = '',
      texto_esperado = '',
      idioma = 'Inglês',
      topico = 'Conversação',
    } = req.body;

    const langConfig = getLanguageConfig(idioma);

    // REGRA DE CONFIABILIDADE PEDAGÓGICA: Sem áudio válido, não existe score acústico de pronúncia!
    if (!audio_base64 || typeof audio_base64 !== 'string') {
      return res.status(400).json({
        available: false,
        reason: 'missing_audio',
        message: 'Gravação de áudio necessária para análise acústica e fonética de pronúncia.',
        retryable: true,
      });
    }

    const cleanBase64 = audio_base64.replace(/^data:[^;]+;base64,/, '');

    const cacheKey = createHash('sha256')
      .update(cleanBase64)
      .update('|')
      .update(texto_esperado || '')
      .update('|')
      .update(idioma)
      .digest('hex');

    const promptInstrucao = `Você é um Foneticista e Avaliador de Pronúncia em ${langConfig.displayName} (${langConfig.bcp47}) para falantes de Português Brasileiro.
Analise a pronúncia acústica do áudio gravado pelo estudante.

Texto Esperado / Referência: "${texto_esperado || topico || texto_falado}"
Texto Falado Reconhecido: "${texto_falado || 'Gravação do aluno'}"
Idioma Alvo: ${langConfig.displayName} (${langConfig.bcp47})

DIRETRIZES DE AVALIAÇÃO ACÚSTICA:
1. Calcule scores realistas de 0 a 100 baseados estritamente na evidência do áudio:
   - overall_score: pontuação global
   - accuracy_score: precisão dos fonemas
   - fluency_score: fluidez e ritmo
   - prosody_score: entonação e tonicidade
   - completeness_score: completude da fala
2. Forneça o IPA Esperado padrão e o IPA Real pronunciado no áudio.
3. Decomponha cada palavra (words_breakdown) com:
   - word
   - expected_ipa
   - transcribed_ipa
   - accuracy (0 a 100)
   - status: 'perfeito' (>=88), 'bom' (>=70), 'atencao' (>=50), 'incorreto' (<50)
   - feedback: dica curta do fonema específico
4. Destaque ponto_forte, ponto_a_melhorar e dica_articulacao_boca prática.`;

    const result = await pronunciationCache.run(cacheKey, () =>
      ModelRouter.generateContent(
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
              text: promptInstrucao,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overall_score: { type: Type.NUMBER },
              accuracy_score: { type: Type.NUMBER },
              fluency_score: { type: Type.NUMBER },
              prosody_score: { type: Type.NUMBER },
              completeness_score: { type: Type.NUMBER },
              recognized_text: { type: Type.STRING },
              expected_phonetics_ipa: { type: Type.STRING },
              transcribed_phonetics_ipa: { type: Type.STRING },
              words_breakdown: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    expected_ipa: { type: Type.STRING },
                    transcribed_ipa: { type: Type.STRING },
                    accuracy: { type: Type.NUMBER },
                    status: {
                      type: Type.STRING,
                      enum: ['perfeito', 'bom', 'atencao', 'incorreto'],
                    },
                    feedback: { type: Type.STRING },
                  },
                  required: ['word', 'expected_ipa', 'transcribed_ipa', 'accuracy', 'status'],
                },
              },
              ponto_forte: { type: Type.STRING },
              ponto_a_melhorar: { type: Type.STRING },
              dica_articulacao_boca: { type: Type.STRING },
            },
            required: [
              'overall_score',
              'accuracy_score',
              'fluency_score',
              'prosody_score',
              'completeness_score',
              'recognized_text',
              'expected_phonetics_ipa',
              'transcribed_phonetics_ipa',
              'words_breakdown',
              'ponto_forte',
              'ponto_a_melhorar',
              'dica_articulacao_boca',
            ],
          },
        },
      },
      {
        preferredModel: 'gemini-3.7-flash',
        fallbackModels: ['gemini-3.1-flash-lite'],
        perAttemptTimeoutMs: 10000,
        deadlineMs: 15000,
      }
      )
    );

    const scoreData = JSON.parse(result.data.text || '{}');

    AiTelemetry.record({
      requestId,
      route: '/api/pronunciation-assessment',
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
      scoreData,
      evaluatorVersion: '2.0.0-acoustic',
    });
  } catch (err: any) {
    console.error(`[Pronunciation Error] req=${requestId}:`, err?.message || err);

    AiTelemetry.record({
      requestId,
      route: '/api/pronunciation-assessment',
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
      errorCode: err?.code || 'PRONUNCIATION_EVAL_FAILED',
    });

    // Retorna falha honesta sem inventar scores de 85 ou IPA fixo
    return res.status(502).json({
      available: false,
      reason: 'model_unavailable',
      message: 'Não foi possível concluir a análise fonética detalhada deste áudio.',
      retryable: true,
    });
  }
});
