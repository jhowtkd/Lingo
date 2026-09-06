import express from 'express';
import { Modality } from '@google/genai';
import type { GoogleGenAI } from '@google/genai';

export function createTtsRouter(
  getClient: () => GoogleGenAI | null,
  timeoutMs?: number
): express.Router {
  // timeoutMs aceito por uniformidade com as demais fábricas de rota; o TTS
  // usa generateContent direto (sem generateWithFallback) e não o consome.
  const router = express.Router();

  let ttsAuthFailedUntil = 0;
  function isTtsAuthFailed(): boolean {
    return Date.now() < ttsAuthFailedUntil;
  }
  function markTtsAuthFailed(durationMs = 60000) {
    ttsAuthFailedUntil = Date.now() + durationMs;
  }

  // Síntese de Voz Neural de Alta Fidelidade (Gemini 3.1 Flash TTS)
  router.post('/', async (req, res) => {
    try {
      const {
        text,
        voice = 'Kore',
        idioma = 'en-US',
      } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Texto para síntese é obrigatório.' });
      }
      if (text.length > 5000) {
        return res.status(413).json({ error: 'Texto para síntese excede o limite de 5.000 caracteres.' });
      }

      if (isTtsAuthFailed()) {
        return res.status(200).json({
          error: 'Chave Gemini API inválida ou sem permissão de áudio. Ativando voz nativa do navegador.',
          fallback: true,
          reason: 'API_KEY_INVALID',
        });
      }

      const client = getClient();
      if (!client) {
        return res.status(200).json({
          error: 'Gemini client não configurado no servidor. Ativando voz nativa do navegador.',
          fallback: true,
          reason: 'API_KEY_INVALID',
        });
      }

      // Higieniza o texto para remover marcações Markdown, emojis e URLs
      let cleanText = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*•]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/\n+/g, '. ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (!cleanText) {
        return res.status(400).json({ error: 'Texto vazio após higienização.' });
      }

      // Limita tamanho para otimização de latência
      if (cleanText.length > 800) {
        cleanText = cleanText.substring(0, 800) + '.';
      }

      // Mapeia vozes válidas do Gemini TTS
      const validVoices = ['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir', 'Aoede'];
      const chosenVoice = validVoices.includes(voice) ? voice : 'Kore';

      // Executa geração de fala com o modelo gemini-3.1-flash-tts-preview
      let response: any = null;
      let lastTtsError: any = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await client.models.generateContent({
            model: 'gemini-3.1-flash-tts-preview',
            contents: [
              {
                parts: [
                  {
                    text: cleanText,
                  },
                ],
              },
            ],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: chosenVoice },
                },
              },
            },
          });
          break;
        } catch (ttsErr: any) {
          lastTtsError = ttsErr;
          const errMsg = (ttsErr?.message || String(ttsErr)).toLowerCase();
          const isAuth =
            errMsg.includes('api_key_invalid') ||
            errMsg.includes('api key not valid') ||
            errMsg.includes('invalid_argument') ||
            errMsg.includes('unauthenticated') ||
            errMsg.includes('permission_denied') ||
            errMsg.includes('api key');

          if (isAuth) {
            markTtsAuthFailed();
            console.log('[Gemini TTS] Chave de API inválida detectada. Ativando voz nativa do navegador.');
            return res.status(200).json({
              error: 'Chave Gemini API inválida ou sem permissão de voz. Fallback para voz do navegador ativado.',
              fallback: true,
              reason: 'API_KEY_INVALID',
            });
          }

          console.warn(`[Gemini TTS] Tentativa ${attempt + 1} falhou:`, ttsErr?.message || ttsErr);
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      }

      if (!response && lastTtsError) {
        throw lastTtsError;
      }

      const audioPart = response?.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData && p.inlineData.data
      );

      if (!audioPart || !audioPart.inlineData?.data) {
        return res.status(200).json({
          error: 'Nenhum áudio gerado pelo modelo Gemini TTS.',
          fallback: true,
        });
      }

      const rawPcmBase64 = audioPart.inlineData.data;
      const mimeType = audioPart.inlineData.mimeType || 'audio/pcm;rate=24000';

      // Converte PCM em formato WAV padrão reconhecido universalmente por navegadores
      const wavBuffer = pcmToWavBuffer(rawPcmBase64, 24000, 1, 16);
      const wavBase64 = wavBuffer.toString('base64');
      const audioUrl = `data:audio/wav;base64,${wavBase64}`;

      return res.json({
        audioUrl,
        audioBase64: wavBase64,
        mimeType: 'audio/wav',
        voice: chosenVoice,
        textProcessed: cleanText,
      });
    } catch (err: any) {
      const errMsg = (err?.message || String(err)).toLowerCase();
      const isAuth =
        errMsg.includes('api_key_invalid') ||
        errMsg.includes('api key not valid') ||
        errMsg.includes('invalid_argument') ||
        errMsg.includes('unauthenticated') ||
        errMsg.includes('permission_denied') ||
        errMsg.includes('api key');

      if (isAuth) {
        markTtsAuthFailed();
        return res.status(200).json({
          error: 'Chave Gemini API inválida. Fallback ativado.',
          fallback: true,
          reason: 'API_KEY_INVALID',
        });
      }

      console.warn('[Gemini TTS] Síntese neural falhou, ativando fallback local:', err?.message || err);
      return res.status(200).json({
        error: err?.message || 'Falha na síntese de voz neural',
        fallback: true,
      });
    }
  });

  return router;
}

/**
 * Converte PCM 16-bit 24kHz (padrão Gemini TTS) para Buffer de arquivo WAV
 */
function pcmToWavBuffer(
  pcmBase64: string,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(dataSize + 36, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format = 1
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}
