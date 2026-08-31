import http from 'http';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { chatRouter } from './server/routes/chat';
import { transcriptionRouter } from './server/routes/transcription';
import { pronunciationRouter } from './server/routes/pronunciation';
import { AiTelemetry } from './server/observability/aiTelemetry';

dotenv.config();

const PORT = 3000;

let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!ai && process.env.GEMINI_API_KEY) {
    try {
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (err) {
      console.error('Erro ao inicializar Gemini client:', err);
    }
  }
  return ai;
}

/**
 * Gerenciador de cooldown de modelos para evitar chamadas repetidas a endpoints em 503
 */
const modelCooldownMap = new Map<string, number>();

/**
 * Executa chamadas ao Gemini com retry inteligente, cooldown ativo e fallback automático de modelos
 * para 503 (High Demand/UNAVAILABLE), 429 e erros transitórios.
 */
async function generateContentWithRetryAndFallback(
  client: GoogleGenAI,
  params: {
    model?: string;
    contents: any;
    config?: any;
  },
  fallbackModels: string[] = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash']
) {
  const preferredModel = params.model || 'gemini-3.7-flash';
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

  for (const modelName of modelsToTry) {
    const isCoolingDown = (modelCooldownMap.get(modelName) || 0) > now;
    if (isCoolingDown && modelsToTry.length > 1) {
      // Se há alternativas disponíveis, pula modelos em cooldown recente de 503
      continue;
    }

    try {
      const response = await client.models.generateContent({
        ...params,
        model: modelName,
      });
      // Sucesso: remove do cooldown se estiver lá
      modelCooldownMap.delete(modelName);
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
    }
  }

  throw lastError || new Error('Todos os modelos de IA falharam temporariamente');
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // Telemetria & Observabilidade AI
  app.get('/api/telemetry', (_req, res) => {
    res.json({
      summary: AiTelemetry.getMetricsSummary(),
      recentLogs: AiTelemetry.getRecentLogs(50),
    });
  });

  // Rotas Modulares do Tutor de Inteligência Artificial
  app.use('/api/chat', chatRouter);
  app.use('/api/transcribe', transcriptionRouter);
  app.use('/api/transcribe-audio', transcriptionRouter);
  app.use('/api/pronunciation-assessment', pronunciationRouter);
  app.use('/api/pronunciation', pronunciationRouter);

  // NOVO: GERADOR DE MATERIAIS DE ESTUDO (A partir de Vídeos do YouTube ou Arquivos de Texto)
  app.post('/api/materials/generate', async (req, res) => {
    try {
      const {
        tipo_fonte = 'texto', // 'youtube' | 'texto' | 'arquivo'
        conteudo_ou_url,
        transcricao_manual,
        idioma_alvo = 'Inglês',
        nivel_cefr = 'B1',
        foco_aprendizagem = 'Vocabulário, Expressões e Diálogo',
      } = req.body;

      if (!conteudo_ou_url && !transcricao_manual) {
        return res.status(400).json({ error: 'Conteúdo, texto ou link do YouTube é obrigatório.' });
      }

      const client = getGeminiClient();

      // Extrai ID do YouTube se aplicável
      const youtubeId = tipo_fonte === 'youtube' ? extractYouTubeVideoId(conteudo_ou_url) : undefined;

      if (!client) {
        // Fallback local rico e estruturado
        return res.json(generateLocalStudyMaterial(conteudo_ou_url, tipo_fonte, idioma_alvo, nivel_cefr, youtubeId));
      }

      const prompt = `
Você é um especialista sênior em Pedagogia de Idiomas e Engenharia de Materiais de Estudo para ${idioma_alvo}.
Sua missão é transformar a seguinte fonte (${tipo_fonte}) em um KIT COMPLETO DE ESTUDO DE IDIOMAS DE ALTO VALOR PEDAGÓGICO.

Informações da Fonte:
- Tipo de Fonte: ${tipo_fonte}
- Link ou Texto Base: "${conteudo_ou_url}"
- Transcrição / Trecho fornecido: "${transcricao_manual || 'Extrair tópicos e vocabulário essenciais com base no link/assunto'}"
- Idioma Alvo: "${idioma_alvo}"
- Nível CEFR Desejado: "${nivel_cefr}"
- Foco de Aprendizagem: "${foco_aprendizagem}"

GERE UM MATERIAL COMPLETO COM:
1. "titulo": Título atraente e didático para a aula/material.
2. "resumo": Resumo claro em Português sobre o tema do material e objetivos de aprendizado.
3. "nivel_cefr": Nível CEFR calibrado (A1, A2, B1, B2, C1 ou C2).
4. "vocabulario": Lista de 5 a 8 palavras/expressões chave mais importantes presentes no material com:
   - termo no idioma alvo
   - pronuncia_ipa (transcrição fonética aproximada/IPA)
   - traducao em português
   - classe_gramatical (substantivo, verbo, phrasal verb, etc.)
   - exemplo (frase real de uso no idioma alvo)
   - traducao_exemplo
5. "gramatica": 2 a 3 pontos gramaticais ou padrões de frases frequentes com explicações, exemplos práticos e uma "dica_para_brasileiros" (alertando para vícios de tradução literal).
6. "dialogo_pratica": Diálogo realista de 4 a 6 falas entre personagens aplicando o vocabulário e expressões do material em um contexto do dia a dia.
7. "questoes_compreensao": 3 questões interativas de compreensão auditiva/leitura com 3-4 opções, indicação da resposta correta e explicação detalhada do porquê.
8. "flashcards": 4 a 8 cartões de repetição espaçada (frente = pergunta/termo em ${idioma_alvo}, verso = significado/tradução em Português, dica = mnemônico ou dica fonética).
9. "dicas_culturais_e_pronuncia": 2 a 3 dicas práticas sobre pronúncia nativa, connected speech ou aspectos culturais.
10. "conteudo_markdown": Um guia de estudos completo e formatado em Markdown impecável para o estudante ler, copiar ou imprimir.
`;

      const response = await generateContentWithRetryAndFallback(client, {
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titulo: { type: Type.STRING },
              resumo: { type: Type.STRING },
              nivel_cefr: { type: Type.STRING },
              vocabulario: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    termo: { type: Type.STRING },
                    pronuncia_ipa: { type: Type.STRING },
                    traducao: { type: Type.STRING },
                    classe_gramatical: { type: Type.STRING },
                    exemplo: { type: Type.STRING },
                    traducao_exemplo: { type: Type.STRING },
                    nivel: { type: Type.STRING },
                  },
                  required: ['termo', 'traducao', 'exemplo'],
                },
              },
              gramatica: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topico: { type: Type.STRING },
                    explicacao: { type: Type.STRING },
                    exemplos: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    dica_para_brasileiros: { type: Type.STRING },
                  },
                  required: ['topico', 'explicacao', 'exemplos'],
                },
              },
              dialogo_pratica: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    personagem: { type: Type.STRING },
                    fala: { type: Type.STRING },
                    traducao: { type: Type.STRING },
                    audio_tip: { type: Type.STRING },
                  },
                  required: ['personagem', 'fala'],
                },
              },
              questoes_compreensao: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pergunta: { type: Type.STRING },
                    opcoes: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    resposta_correta: { type: Type.STRING },
                    explicacao: { type: Type.STRING },
                  },
                  required: ['pergunta', 'resposta_correta', 'explicacao'],
                },
              },
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    frente: { type: Type.STRING },
                    verso: { type: Type.STRING },
                    dica: { type: Type.STRING },
                  },
                  required: ['frente', 'verso'],
                },
              },
              dicas_culturais_e_pronuncia: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              conteudo_markdown: { type: Type.STRING },
            },
            required: ['titulo', 'resumo', 'vocabulario', 'gramatica', 'dialogo_pratica', 'conteudo_markdown'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const materialId = `mat-${Date.now()}`;

      const finalMaterial = {
        id: materialId,
        titulo: parsed.titulo || 'Material de Estudo Personalizado',
        tipo_fonte,
        fonte_original: conteudo_ou_url,
        youtube_video_id: youtubeId || undefined,
        idioma_alvo,
        nivel_cefr: parsed.nivel_cefr || nivel_cefr,
        resumo: parsed.resumo || 'Material extraído para prática conversacional e expansão de vocabulário.',
        vocabulario: parsed.vocabulario || [],
        gramatica: parsed.gramatica || [],
        dialogo_pratica: parsed.dialogo_pratica || [],
        questoes_compreensao: parsed.questoes_compreensao || [],
        flashcards: parsed.flashcards || [],
        dicas_culturais_e_pronuncia: parsed.dicas_culturais_e_pronuncia || [],
        conteudo_markdown: parsed.conteudo_markdown || `# ${parsed.titulo}\n\n${parsed.resumo}`,
        criado_em: new Date().toISOString(),
        adicionado_ao_grafo: false,
      };

      return res.json({ material: finalMaterial });
    } catch (err: any) {
      console.error('Erro ao gerar material de estudo:', err);
      const fallback = generateLocalStudyMaterial(
        req.body?.conteudo_ou_url || '',
        req.body?.tipo_fonte || 'texto',
        req.body?.idioma_alvo || 'Inglês',
        req.body?.nivel_cefr || 'B1',
        extractYouTubeVideoId(req.body?.conteudo_ou_url || '')
      );
      return res.json({ material: fallback });
    }
  });

  // NOVO: Caixa de Contexto de Palavra com Sinônimos, IPA, Tradução e Exemplos
  app.post('/api/word-context', async (req, res) => {
    try {
      const {
        palavra = '',
        frase_contexto = '',
        idioma = 'Inglês',
        topico = 'Conversação Geral',
      } = req.body;

      const cleanWord = (palavra || '').replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$/g, '').trim();

      if (!cleanWord) {
        return res.status(400).json({ error: 'Palavra inválida' });
      }

      const client = getGeminiClient();

      if (!client) {
        return res.json({
          contexto: generateLocalWordContext(cleanWord, frase_contexto, idioma),
        });
      }

      const prompt = `
Você é um Lexicógrafo e Especialista em Linguística Aplicada ao ensino de ${idioma} para falantes de Português.
Analise a palavra "${cleanWord}" exatamente no contexto da frase abaixo:

Frase de Contexto: "${frase_contexto || cleanWord}"
Tópico da Aula: "${topico}"
Idioma: "${idioma}"

Forneça um objeto JSON estruturado com:
1. "palavra": A palavra exata consultada.
2. "lemma_raiz": A forma base/dicionário (ex: "running" -> "run", "better" -> "good", "houses" -> "house").
3. "classe_gramatical": Ex: "Substantivo", "Verbo transitivo", "Adjetivo", "Phrasal Verb", "Advérbio", "Conjunção", "Expressão".
4. "idioma": "${idioma}"
5. "nivel_cefr": Nível estimado ('A1', 'A2', 'B1', 'B2', 'C1', 'C2').
6. "pronuncia_ipa": Transcrição fonética IPA padrão com tonicidade (ex: "/ˈfæs.ə.neɪ.tɪŋ/").
7. "traducao_principal": Tradução precisa em Português no contexto desta frase.
8. "definicao_contextual": Breve explicação de 1 a 2 frases do significado desta palavra nesta situação.
9. "sinonimos": Lista de 3 a 5 sinônimos ou termos equivalentes no idioma alvo.
10. "antonimos": Lista de 2 a 3 antônimos (se aplicável).
11. "exemplos_uso": Lista de 2 a 3 pares com {"frase_original": "...", "traducao_portugues": "..."} mostrando o uso natural em contextos reais e cotidianos.
12. "falso_amigo_alerta": Se for um falso cognato ou confundido frequentemente por brasileiros, explique claramente; caso contrário, omita ou deixe vazio.
13. "dica_uso_ou_collocation": Dica prática de preposição que a acompanha, colocação comum ou padrão de fala.
14. "origem_etimologia": Curiosidade etimológica curta e memorável (opcional).
`;

      const response = await generateContentWithRetryAndFallback(client, {
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              palavra: { type: Type.STRING },
              lemma_raiz: { type: Type.STRING },
              classe_gramatical: { type: Type.STRING },
              idioma: { type: Type.STRING },
              nivel_cefr: {
                type: Type.STRING,
                enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
              },
              pronuncia_ipa: { type: Type.STRING },
              traducao_principal: { type: Type.STRING },
              definicao_contextual: { type: Type.STRING },
              sinonimos: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              antonimos: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              exemplos_uso: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    frase_original: { type: Type.STRING },
                    traducao_portugues: { type: Type.STRING },
                  },
                  required: ['frase_original', 'traducao_portugues'],
                },
              },
              falso_amigo_alerta: { type: Type.STRING },
              dica_uso_ou_collocation: { type: Type.STRING },
              origem_etimologia: { type: Type.STRING },
            },
            required: [
              'palavra',
              'lemma_raiz',
              'classe_gramatical',
              'idioma',
              'nivel_cefr',
              'pronuncia_ipa',
              'traducao_principal',
              'definicao_contextual',
              'sinonimos',
              'exemplos_uso',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({ contexto: parsed });
    } catch (err: any) {
      console.warn('Erro ao gerar contexto de palavra com IA, usando fallback:', err?.message || err);
      const cleanWord = (req.body?.palavra || '').replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$/g, '').trim();
      return res.json({
        contexto: generateLocalWordContext(
          cleanWord,
          req.body?.frase_contexto || '',
          req.body?.idioma || 'Inglês'
        ),
      });
    }
  });

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

  // Síntese de Voz Neural de Alta Fidelidade (Gemini 3.1 Flash TTS)
  app.post('/api/tts', async (req, res) => {
    try {
      const {
        text,
        voice = 'Kore',
        idioma = 'en-US',
      } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Texto para síntese é obrigatório.' });
      }

      const client = getGeminiClient();
      if (!client) {
        return res.status(503).json({
          error: 'Gemini client não configurado no servidor.',
          fallback: true,
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

      // Executa geração de fala com o modelo gemini-3.1-flash-tts-preview com retry para erros transitórios
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
          console.warn(`[Gemini TTS] Tentativa ${attempt + 1} falhou:`, ttsErr?.message || ttsErr);
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      }

      if (!response && lastTtsError) {
        throw lastTtsError;
      }

      const audioPart = response.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData && p.inlineData.data
      );

      if (!audioPart || !audioPart.inlineData?.data) {
        return res.status(500).json({
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
      console.error('[Gemini TTS] Erro ao sintetizar áudio:', err);
      return res.status(500).json({
        error: err?.message || 'Falha na síntese de voz neural',
        fallback: true,
      });
    }
  });

  // Sugestões de Planejamento no Calendário
  app.post('/api/calendar/suggest', async (req, res) => {
    try {
      const {
        dias_disponiveis = 7,
        duracao_sessao_min = 45,
        horario_preferido = '19:00',
        topicos_dificeis = [],
        revisoes_pendentes = [],
      } = req.body;

      const client = getGeminiClient();

      if (!client) {
        return res.json({
          propostas: generateDefaultCalendarProposals(
            duracao_sessao_min,
            horario_preferido,
            topicos_dificeis,
            revisoes_pendentes
          ),
        });
      }

      const prompt = `
Gere um plano pedagógico semanal equilibrado com base nas dificuldades reais do aluno:
Tópicos com mais dificuldade: ${JSON.stringify(topicos_dificeis)}
Revisões pendentes de conceitos: ${JSON.stringify(revisoes_pendentes)}
Duração por sessão: ${duracao_sessao_min} minutos
Horário preferencial: ${horario_preferido}
Total de dias: ${dias_disponiveis}

Crie propostas realistas de sessões diárias intercalando:
1. 'revisao_espacada' para conceitos frágeis
2. 'correcao_erros' para equívocos identificados
3. 'novo_conceito' para avançar no cronograma
`;

      const response = await generateContentWithRetryAndFallback(client, {
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                titulo: { type: Type.STRING },
                descricao: { type: Type.STRING },
                duracao_minutos: { type: Type.NUMBER },
                topicos: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                prioridade: {
                  type: Type.STRING,
                  enum: ['alta', 'media', 'baixa'],
                },
                tipo: {
                  type: Type.STRING,
                  enum: ['revisao_espacada', 'novo_conceito', 'correcao_erros'],
                },
                offset_dias: {
                  type: Type.NUMBER,
                  description: 'Dia a partir de hoje (0 = hoje, 1 = amanhã, etc)',
                },
              },
              required: ['titulo', 'descricao', 'duracao_minutos', 'topicos', 'prioridade', 'tipo', 'offset_dias'],
            },
          },
        },
      });

      const items = JSON.parse(response.text || '[]');
      const now = new Date();

      if (!Array.isArray(items) || items.length === 0) {
        return res.json({
          propostas: generateDefaultCalendarProposals(
            duracao_sessao_min,
            horario_preferido,
            topicos_dificeis,
            revisoes_pendentes
          ),
        });
      }

      const propostas = items.map((item: any, idx: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() + (item.offset_dias ?? idx));
        const [hours, minutes] = (horario_preferido || '19:00').split(':').map(Number);
        d.setHours(hours || 19, minutes || 0, 0, 0);

        const end = new Date(d);
        end.setMinutes(end.getMinutes() + (item.duracao_minutos || duracao_sessao_min));

        return {
          id: `prop-${Date.now()}-${idx}`,
          titulo: item.titulo,
          descricao: item.descricao,
          inicio: d.toISOString(),
          fim: end.toISOString(),
          duracao_minutos: item.duracao_minutos || duracao_sessao_min,
          topicos: item.topicos || ['Estudos'],
          prioridade: item.prioridade || 'media',
          tipo: item.tipo || 'revisao_espacada',
        };
      });

      res.json({ propostas });
    } catch (err: any) {
      console.warn('Fallback ativado em /api/calendar/suggest:', err?.message || err);
      res.json({
        propostas: generateDefaultCalendarProposals(
          req.body?.duracao_sessao_min || 45,
          req.body?.horario_preferido || '19:00',
          req.body?.topicos_dificeis,
          req.body?.revisoes_pendentes
        ),
      });
    }
  });

  // Recomendação Semanal Personalizada
  app.post('/api/recommendation', async (req, res) => {
    try {
      const { metricas, grafo_resumo } = req.body;
      const client = getGeminiClient();

      if (!client) {
        return res.json({
          recomendacao:
            'Foque 20 minutos diários na revisão de conceitos com domínio inferior a 60% e pratique mais questões de aplicação direta.',
        });
      }

      const response = await generateContentWithRetryAndFallback(client, {
        model: 'gemini-3.7-flash',
        contents: `
Analise estas métricas de estudo dos últimos 7 dias:
${JSON.stringify(metricas)}
Resumo do grafo de conhecimento:
${JSON.stringify(grafo_resumo)}

Gere uma recomendação pedagógica objetiva, motivadora e acionável em 2 a 3 frases em Português para a próxima semana.`,
      });

      res.json({ recomendacao: response.text?.trim() });
    } catch (err: any) {
      res.json({
        recomendacao:
          'Mantenha a consistência diária e priorize os tópicos com maior taxa de repetição de erros.',
      });
    }
  });

  // NOVO: Análise com IA dos 3 Tópicos Prioritários do Grafo de Memória para a Próxima Sessão de Chat
  app.post('/api/dashboard/priority-topics', async (req, res) => {
    try {
      const { nos_grafo = [], correcoes = [], metricas = {} } = req.body;
      const client = getGeminiClient();

      if (!client || !nos_grafo || nos_grafo.length === 0) {
        return res.json({
          prioridades: [],
        });
      }

      const prompt = `
Você é o Motor Pedagógico de Análise de Memória e Grafo de Conhecimento em Idiomas.
Analise a topologia do grafo de memória do estudante, suas dificuldades, correções pendentes e histórico de retenção SRS:

Nós do Grafo:
${JSON.stringify(nos_grafo.slice(0, 15))}

Correções Recentes:
${JSON.stringify(correcoes.slice(0, 10))}

Métricas da Semana:
${JSON.stringify(metricas)}

Gere EXATAMENTE 3 tópicos prioritários para a próxima sessão de conversação no Chat Tutor.
Cada tópico deve atacar os pontos mais urgentes:
1. Falsos cognatos e armadilhas de tradução ativa
2. Equívocos conceituais/fonéticos recorrentes com baixo domínio (<60%)
3. Revisões espaçadas (SRS) com risco de esquecimento

Retorne as sugestões estruturadas e altamente motivadoras com estratégias pedagógicas práticas.`;

      const response = await generateContentWithRetryAndFallback(client, {
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                titulo: { type: Type.STRING },
                motivo_prioridade: { type: Type.STRING },
                descricao_pedagogica: { type: Type.STRING },
                dominio_atual: { type: Type.NUMBER },
                frequencia_erro: { type: Type.NUMBER },
                dificuldade: { type: Type.NUMBER },
                tipo_no: { type: Type.STRING },
                estrategia_sugerida: { type: Type.STRING },
                nivel_urgencia: {
                  type: Type.STRING,
                  enum: ['critica', 'alta', 'moderada'],
                },
                nos_relacionados: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                exemplos_praticos: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'id',
                'titulo',
                'motivo_prioridade',
                'descricao_pedagogica',
                'dominio_atual',
                'frequencia_erro',
                'dificuldade',
                'tipo_no',
                'estrategia_sugerida',
                'nivel_urgencia',
              ],
            },
          },
        },
      });

      const prioridades = JSON.parse(response.text || '[]');
      return res.json({ prioridades: Array.isArray(prioridades) ? prioridades.slice(0, 3) : [] });
    } catch (err: any) {
      console.warn('Erro ao gerar tópicos prioritários com Gemini:', err?.message || err);
      return res.json({ prioridades: [] });
    }
  });

  // NOVO: Assistente de Configuração Inicial (Onboarding) - Gera Plano Personalizado e Primeiros Conteúdos
  app.post('/api/onboarding/generate-plan', async (req, res) => {
    try {
      const {
        idioma_alvo = 'Inglês',
        nivel_atual = 'B1',
        motivo_principal = 'Trabalho & Carreira',
        motivo_detalhado = '',
        interesses = ['Tecnologia & IA', 'Conversação Cotidiana'],
        tempo_diario_minutos = 30,
        estilo_aprendizado = 'conversacao_voz',
        horario_preferido = '19:00',
      } = req.body;

      const client = getGeminiClient();

      if (!client) {
        return res.json({
          plano: generateLocalOnboardingPlan(
            idioma_alvo,
            nivel_atual,
            motivo_principal,
            motivo_detalhado,
            interesses,
            tempo_diario_minutos,
            estilo_aprendizado
          ),
        });
      }

      const prompt = `
Você é o Arquiteto Pedagógico Chefe e Tutor de Línguas de Inteligência Artificial para estudantes que aprendem ${idioma_alvo}.
Sua missão é criar o PRIMEIRO PLANO DE ESTUDOS ULTRA PERSONALIZADO e GERAR OS PRIMEIROS CONTEÚDOS DE ALTO VALOR IMEDIATO com base no perfil do estudante.

Perfil do Estudante:
- Idioma Alvo de Estudo: "${idioma_alvo}"
- Nível Atual Autodeclarado (CEFR): "${nivel_atual}"
- Motivo Principal / Objetivo: "${motivo_principal}"
- Detalhes Específicos do Aluno: "${motivo_detalhado || 'Foco em destravar conversação e vocabulário relevante'}"
- Interesses & Afinidades: ${JSON.stringify(interesses)}
- Tempo Disponível Diário: ${tempo_diario_minutos} minutos/dia
- Estilo Preferido de Aprendizado: "${estilo_aprendizado}"

Gere uma resposta JSON estruturada estritamente de acordo com o schema com:
1. "titulo_plano": Nome empolgante, profissional e focado do plano (ex: "Trilha Imersiva: Inglês para Tecnologia & Reuniões Globais").
2. "descricao_plano": Breve resumo explicando a proposta pedagógica e como o aluno atingirá o objetivo no tempo estipulado.
3. "topico_inicial_recomendado": Nome do primeiro tópico de conversação que o Tutor de Chat deve ativar (ex: "${idioma_alvo}: Daily Standups & Negociações de TI" ou "${idioma_alvo}: Situações em Restaurantes e Viagens").
4. "mensagem_boas_vindas_tutor": Uma mensagem calorosa de boas-vindas do tutor, iniciando no idioma alvo (${idioma_alvo}) e conectando o plano aos objetivos do aluno, já propondo a primeira pergunta de abertura prática no idioma alvo (${idioma_alvo}) para começar a conversa imediatamente.
5. "estrategia_pedagogica": Explicação da abordagem (ex: repetição espaçada, foco em collocations e connected speech sem fixação excessiva em decoreba gramatical).
6. "cronograma_semanal": Array com 7 dias da semana (Segunda a Domingo), especificando:
   - "dia_semana": Nome do dia
   - "foco": Tópico do dia
   - "duracao_minutos": ${tempo_diario_minutos}
   - "tipo_atividade": "chat" | "flashcards" | "duel" | "materials"
   - "descricao_pratica": Instrução clara de 1 frase do que fazer
7. "nos_iniciais_grafo": Array com 4 a 6 nós essenciais para inicializar o Grafo de Memória do aluno:
   - "tipo": "vocabulario" | "expressao_idiomatica" | "falso_amigo" | "gramatica"
   - "titulo": Termo ou estrutura
   - "descricao": Explicação prática em Português
   - "dominio_estimado": 35 a 55
   - "dificuldade": 1 a 4
   - "pronuncia_ipa": Transcrição fonética IPA precisa
   - "traducao": Tradução para o Português
   - "exemplo_uso": Frase de exemplo autêntica no idioma alvo
8. "primeiro_material_estudo": Kit de estudos de aula inicial com:
   - "titulo": Título do kit
   - "resumo": Resumo didático
   - "vocabulario": 4 a 6 termos essenciais com termo, pronuncia_ipa, traducao, classe_gramatical, exemplo e traducao_exemplo
   - "gramatica": 1 a 2 padrões gramaticais ou dicas de colocação com dica_para_brasileiros
   - "dialogo_pratica": Diálogo de 4 a 6 falas entre personagens aplicando os termos
   - "questoes_compreensao": 2 questões interativas com opções, resposta_correta e explicação
   - "flashcards": 3 a 5 flashcards com frente, verso e dica
   - "dicas_culturais_e_pronuncia": 2 dicas práticas
   - "conteudo_markdown": Guia completo formatado em Markdown
9. "dicas_personalizadas": 2 a 3 dicas pontuais de produtividade linguística ajustadas ao perfil.
`;

      const response = await generateContentWithRetryAndFallback(client, {
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titulo_plano: { type: Type.STRING },
              descricao_plano: { type: Type.STRING },
              topico_inicial_recomendado: { type: Type.STRING },
              mensagem_boas_vindas_tutor: { type: Type.STRING },
              estrategia_pedagogica: { type: Type.STRING },
              cronograma_semanal: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dia_semana: { type: Type.STRING },
                    foco: { type: Type.STRING },
                    duracao_minutos: { type: Type.NUMBER },
                    tipo_atividade: {
                      type: Type.STRING,
                      enum: ['chat', 'flashcards', 'duel', 'materials'],
                    },
                    descricao_pratica: { type: Type.STRING },
                  },
                  required: ['dia_semana', 'foco', 'duracao_minutos', 'tipo_atividade', 'descricao_pratica'],
                },
              },
              nos_iniciais_grafo: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tipo: {
                      type: Type.STRING,
                      enum: ['vocabulario', 'expressao_idiomatica', 'falso_amigo', 'gramatica'],
                    },
                    titulo: { type: Type.STRING },
                    descricao: { type: Type.STRING },
                    dominio_estimado: { type: Type.NUMBER },
                    dificuldade: { type: Type.NUMBER },
                    pronuncia_ipa: { type: Type.STRING },
                    traducao: { type: Type.STRING },
                    exemplo_uso: { type: Type.STRING },
                  },
                  required: ['tipo', 'titulo', 'descricao', 'traducao', 'exemplo_uso'],
                },
              },
              primeiro_material_estudo: {
                type: Type.OBJECT,
                properties: {
                  titulo: { type: Type.STRING },
                  resumo: { type: Type.STRING },
                  vocabulario: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        termo: { type: Type.STRING },
                        pronuncia_ipa: { type: Type.STRING },
                        traducao: { type: Type.STRING },
                        classe_gramatical: { type: Type.STRING },
                        exemplo: { type: Type.STRING },
                        traducao_exemplo: { type: Type.STRING },
                      },
                      required: ['termo', 'traducao', 'exemplo'],
                    },
                  },
                  gramatica: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        topico: { type: Type.STRING },
                        explicacao: { type: Type.STRING },
                        exemplos: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        dica_para_brasileiros: { type: Type.STRING },
                      },
                      required: ['topico', 'explicacao', 'exemplos'],
                    },
                  },
                  dialogo_pratica: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        personagem: { type: Type.STRING },
                        fala: { type: Type.STRING },
                        traducao: { type: Type.STRING },
                      },
                      required: ['personagem', 'fala'],
                    },
                  },
                  questoes_compreensao: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        pergunta: { type: Type.STRING },
                        opcoes: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        resposta_correta: { type: Type.STRING },
                        explicacao: { type: Type.STRING },
                      },
                      required: ['pergunta', 'resposta_correta', 'explicacao'],
                    },
                  },
                  flashcards: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        frente: { type: Type.STRING },
                        verso: { type: Type.STRING },
                        dica: { type: Type.STRING },
                      },
                      required: ['frente', 'verso'],
                    },
                  },
                  dicas_culturais_e_pronuncia: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  conteudo_markdown: { type: Type.STRING },
                },
                required: ['titulo', 'resumo', 'vocabulario', 'gramatica', 'dialogo_pratica', 'conteudo_markdown'],
              },
              dicas_personalizadas: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'titulo_plano',
              'descricao_plano',
              'topico_inicial_recomendado',
              'mensagem_boas_vindas_tutor',
              'estrategia_pedagogica',
              'cronograma_semanal',
              'nos_iniciais_grafo',
              'primeiro_material_estudo',
              'dicas_personalizadas',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const planId = `plan-${Date.now()}`;

      const generatedPlan = {
        id: planId,
        titulo_plano: parsed.titulo_plano || `Plano de ${idioma_alvo} Personalizado`,
        descricao_plano: parsed.descricao_plano || 'Plano customizado calibrado pelo assistente de configuração com inteligência artificial.',
        idioma: idioma_alvo,
        nivel_cefr: nivel_atual,
        meta_diaria_minutos: tempo_diario_minutos,
        motivo_principal: motivo_principal,
        interesses_principais: interesses,
        topico_inicial_recomendado: parsed.topico_inicial_recomendado || `${idioma_alvo}: ${interesses[0] || 'Conversação Essencial'}`,
        mensagem_boas_vindas_tutor: parsed.mensagem_boas_vindas_tutor || `Olá! Seu plano para ${idioma_alvo} está pronto. Vamos começar?`,
        estrategia_pedagogica: parsed.estrategia_pedagogica || 'Imersão conversacional adaptativa combinada com repetição espaçada no grafo.',
        cronograma_semanal: parsed.cronograma_semanal || [],
        nos_iniciais_grafo: (parsed.nos_iniciais_grafo || []).map((node: any, idx: number) => ({
          ...node,
          id: `node-onboarding-${Date.now()}-${idx}`,
          idioma: idioma_alvo,
          dominio_estimado: node.dominio_estimado || 40,
          dificuldade: node.dificuldade || 2,
          frequencia_erro: 0,
          ultima_revisao: new Date().toISOString(),
          proxima_revisao: new Date(Date.now() + 86400000).toISOString(),
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
          evidencias: ['Configuração de Perfil Inicial'],
        })),
        primeiro_material_estudo: {
          id: `mat-onboarding-${Date.now()}`,
          titulo: parsed.primeiro_material_estudo?.titulo || `Kit Inicial: ${idioma_alvo} Prático`,
          tipo_fonte: 'texto' as const,
          fonte_original: 'Assistente de Configuração Personalizado',
          idioma_alvo: idioma_alvo,
          nivel_cefr: nivel_atual,
          resumo: parsed.primeiro_material_estudo?.resumo || 'Material introdutório focado nos seus interesses e objetivos.',
          vocabulario: parsed.primeiro_material_estudo?.vocabulario || [],
          gramatica: parsed.primeiro_material_estudo?.gramatica || [],
          dialogo_pratica: parsed.primeiro_material_estudo?.dialogo_pratica || [],
          questoes_compreensao: parsed.primeiro_material_estudo?.questoes_compreensao || [],
          flashcards: parsed.primeiro_material_estudo?.flashcards || [],
          dicas_culturais_e_pronuncia: parsed.primeiro_material_estudo?.dicas_culturais_e_pronuncia || [],
          conteudo_markdown: parsed.primeiro_material_estudo?.conteudo_markdown || `# ${parsed.titulo_plano}\n\nMaterial preparado para você.`,
          criado_em: new Date().toISOString(),
          adicionado_ao_grafo: true,
        },
        dicas_personalizadas: parsed.dicas_personalizadas || [],
        criado_em: new Date().toISOString(),
      };

      return res.json({ plano: generatedPlan });
    } catch (err: any) {
      console.warn('Erro ao gerar plano no onboarding via Gemini:', err?.message || err);
      const fallback = generateLocalOnboardingPlan(
        req.body?.idioma_alvo || 'Inglês',
        req.body?.nivel_atual || 'B1',
        req.body?.motivo_principal || 'Trabalho & Carreira',
        req.body?.motivo_detalhado || '',
        req.body?.interesses || ['Tecnologia & IA', 'Conversação'],
        req.body?.tempo_diario_minutos || 30,
        req.body?.estilo_aprendizado || 'conversacao_voz'
      );
      return res.json({ plano: fallback });
    }
  });


  // ==========================================
  // WEBSOCKET BRIDGE: GEMINI LIVE VOICE API (LANGUAGE TUTOR)
  // ==========================================
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', async (clientWs: WebSocket, request) => {
    const client = getGeminiClient();
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const topic = url.searchParams.get('topic') || 'Conversação Geral';
    const targetLang = url.searchParams.get('lang') || 'Inglês';
    const studentLevel = url.searchParams.get('level') || 'Intermediário (B1)';
    const requestedVoice = url.searchParams.get('voice') || 'Aoede';

    const validVoices = ['Aoede', 'Zephyr', 'Puck', 'Fenrir', 'Kore', 'Charon'];
    const voiceName = validVoices.includes(requestedVoice) ? requestedVoice : 'Aoede';

    if (!client) {
      // Simulação interativa com retorno em áudio simulado ou texto quando sem chave
      clientWs.send(
        JSON.stringify({
          type: 'tutor_text',
          text: `Hello! I'm your ${targetLang} Voice Tutor. Let's practice speaking about "${topic}"! How are you doing today?`,
        })
      );

      clientWs.on('message', (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.text) {
            clientWs.send(
              JSON.stringify({
                type: 'tutor_text',
                text: `Great point! When discussing "${topic}" in ${targetLang}, that's a very natural way to express it. Tell me more!`,
              })
            );
          }
        } catch (e) {}
      });
      return;
    }

    try {
      const liveSession = await client.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `Você é um Tutor de Línguas nativo e caloroso especialista no ensino de ${targetLang} para estudantes brasileiros.
Tópico de estudo atual: "${topic}" (Nível estimado: ${studentLevel}).

Diretrizes Pedagógicas para Voz em Tempo Real:
1. Fale predominantemente em ${targetLang} de maneira clara, articulada e amigável. Se o estudante falar em Português ou demonstrar dúvida, acolha e encoraje.
2. Mantenha cada turno de fala curto (2 a 3 frases no máximo), sempre terminando com uma pergunta aberta ou provocação conversacional para manter o estudante falando.
3. Se o estudante cometer um erro evidente de vocabulário, falso cognato, pronúncia ou tempo verbal, ofereça um feedback encorajador e mostre a forma mais idiomática de dizer.
4. Estimule a autoconfiança e a fluência do aluno.`,
        },
        callbacks: {
          onmessage: (msg: any) => {
            // 1. Chunk de áudio gerado pelo modelo (24kHz PCM)
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'audio', audio: audioData }));
            }

            // 2. Notificação de interrupção (usuário falou por cima)
            if (msg.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }

            // 3. Transcrição do tutor
            const modelParts = msg.serverContent?.modelTurn?.parts;
            if (modelParts) {
              for (const part of modelParts) {
                if (part.text && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'tutor_text', text: part.text }));
                }
              }
            }

            // 4. Transcrição da fala do usuário
            const userParts = msg.serverContent?.userTurn?.parts;
            if (userParts) {
              for (const part of userParts) {
                if (part.text && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'user_text', text: part.text }));
                }
              }
            }

            // 5. Final de turno
            const turnComplete = msg.serverContent?.turnComplete;
            if (turnComplete && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'turn_complete' }));
            }
          },
          onerror: (err: any) => {
            console.error('Erro na sessão Gemini Live:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  error: err?.message || 'Erro na sessão de voz do Gemini Live',
                })
              );
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'closed' }));
            }
          },
        },
      });

      clientWs.on('message', (raw) => {
        try {
          const payload = JSON.parse(raw.toString());
          if (payload.audio) {
            liveSession.sendRealtimeInput({
              audio: {
                data: payload.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } else if (payload.text) {
            liveSession.sendRealtimeInput({
              text: payload.text,
            });
          }
        } catch (e) {
          console.error('Erro ao processar pacote do cliente no Live WebSocket:', e);
        }
      });

      clientWs.on('close', () => {
        try {
          liveSession.close();
        } catch (e) {}
      });
    } catch (liveErr: any) {
      console.error('Falha ao iniciar Gemini Live:', liveErr);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            error: liveErr.message || 'Falha ao conectar com o Gemini Live',
          })
        );
      }
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Tutor de Línguas Server rodando em http://0.0.0.0:${PORT}`);
  });
}

function extractYouTubeVideoId(url: string): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : undefined;
}

function generateLocalLanguageTutorResponse(
  mensagem: string,
  topico: string,
  idiomaAlvo: string,
  contextoGrafo: any[],
  preferenciaAdaptacao?: string,
  planoEstudo?: any
) {
  const lower = mensagem.toLowerCase();
  const hasCommonPortugueseTransfer =
    lower.includes('make a question') ||
    lower.includes('i have 20 years') ||
    lower.includes('depend of') ||
    lower.includes('actually') ||
    lower.includes('pretend') ||
    lower.includes('intend');

  const totalDominio = (contextoGrafo || []).reduce((acc: number, n: any) => acc + (n.dominio_estimado || 50), 0);
  const avgDominio = contextoGrafo?.length > 0 ? Math.round(totalDominio / contextoGrafo.length) : 62;

  if (hasCommonPortugueseTransfer) {
    return {
      resposta_tutor: `Muito bom você tentar formular a frase em **${idiomaAlvo}**! Notei um detalhe sutil de interferência do português: em ${idiomaAlvo === 'Francês' ? 'francês, dizemos *"poser une question"*' : idiomaAlvo === 'Espanhol' ? 'espanhol, dizemos *"hacer una pregunta"* ou *"tengo 20 años"*' : 'inglês, dizemos *"ask a question"* (e não "make a question") ou *"I am 20 years old"*'}. Vamos tentar reformular?`,
      possui_erro: true,
      adaptacao: {
        nivel: 'fundamental_analogico' as const,
        rotulo: 'A1/A2 - Básico com Dicas de Falsos Amigos',
        dominio_avaliado: Math.min(avgDominio, 50),
        justificativa: `Grafo detectou padrão de tradução literal do Português no tópico ${topico}.`,
        estrategia_pedagogica: 'Alinhamento de collocations nativas e falsos cognatos com reforço positivo.',
        conceitos_relacionados: [topico, 'Collocations', 'False Friends'],
      },
      correcao: {
        conceito: 'Collocation e Padrão Idiomático',
        erro: 'Tradução literal direta da estrutura do português',
        explicacao:
          `Em ${idiomaAlvo}, certas combinações de palavras (collocations) são fixas. Por exemplo, em ${idiomaAlvo}, usamos estruturas próprias para perguntas e descrições.`,
        resposta_corrigida: idiomaAlvo === 'Francês' ? `Je voudrais poser une question sur ${topico}.` : idiomaAlvo === 'Espanhol' ? `Me gustaría hacer una pregunta sobre ${topico}.` : `I would like to ask a question regarding ${topico}.`,
        gravidade: 'leve' as const,
        evidencia: mensagem,
        pergunta_confirmacao: `Como você diria agora "Posso fazer uma pergunta sobre isso?" em ${idiomaAlvo}?`,
        dica_pronuncia_ou_gramatica: `Dica de ritmo: mantenha a entonação natural da frase em ${idiomaAlvo}.`,
      },
      novos_nos_grafo: [
        {
          tipo: 'falso_amigo' as const,
          titulo: `Padrão de Uso em ${idiomaAlvo}`,
          descricao: `Ajuste de uso natural identificado na prática: "${mensagem.slice(0, 50)}"`,
          dominio_estimado: 55,
          dificuldade: 2,
          evidencia: mensagem,
          relacionado_com: topico,
          tipo_relacao: 'dificuldade_em' as const,
          traducao: `Expressão natural em ${idiomaAlvo}`,
          exemplo_uso: idiomaAlvo === 'Francês' ? 'Puis-je vous poser une question ?' : idiomaAlvo === 'Espanhol' ? '¿Puedo hacerte una pregunta?' : 'Can I ask you a quick question?',
        },
      ],
      xp_ganho: 25,
      conceitos_chave: [topico, 'Natural Collocations'],
    };
  }

  const isAdvanced = avgDominio >= 80 || preferenciaAdaptacao === 'avancado_analitico';

  const responsesByLang: Record<string, { advanced: string; standard: string }> = {
    'Francês': {
      advanced: `Très bien formulé ! Votre phrase en **Français** est claire et naturelle. Pour aller encore plus loin dans notre thème **${topico}**, comment exprimeriez-vous cette idée dans une conversation fluide ?`,
      standard: `C'est une excellente phrase en **Français** ! Vous avez bien communiqué votre intention sur le thème **${topico}**. Que diriez-vous si nous continuions avec une question pratique ?`,
    },
    'Espanhol': {
      advanced: `¡Excelente formulación! Tu estructura en **Español** es muy natural y fluida. Para avanzar en **${topico}**, ¿cómo expresarías esto en un contexto formal o cotidiano?`,
      standard: `¡Muy bien! Tu frase en **Español** se entiende perfectamente para practicar **${topico}**. ¿Qué te gustaría añadir o preguntar a continuación?`,
    },
    'Inglês': {
      advanced: `That was spot on! Your sentence structure in **English** is very natural and articulate. To elevate it further in **${topico}**, how would you express this in a professional or spontaneous context?`,
      standard: `Great sentence in **English**! You communicated your idea clearly regarding **${topico}**. To practice even more, how would you describe a personal experience or ask me a follow-up question about this?`,
    },
  };

  const langResponses = responsesByLang[idiomaAlvo] || {
    advanced: `Ótima formulação em **${idiomaAlvo}**! A estrutura foi muito bem empregada no tópico **${topico}**. Como você continuaria desenvolvendo essa ideia?`,
    standard: `Muito bem em **${idiomaAlvo}**! Você se expressou com clareza no tema **${topico}**. Vamos dar o próximo passo prático?`,
  };

  return {
    resposta_tutor: isAdvanced ? langResponses.advanced : langResponses.standard,
    possui_erro: false,
    adaptacao: {
      nivel: isAdvanced ? ('avancado_analitico' as const) : ('intermediario_aplicado' as const),
      rotulo: isAdvanced ? 'C1/C2 - Avançado e Fluência Idiomática' : 'B1/B2 - Intermediário Conversacional',
      dominio_avaliado: avgDominio,
      justificativa: isAdvanced
        ? `Grafo identificou alto domínio lexical (${avgDominio}%) em ${idiomaAlvo}.`
        : `Grafo identificou boa compreensão prática (${avgDominio}%) em ${idiomaAlvo}.`,
      estrategia_pedagogica: isAdvanced
        ? 'Refinamento estilístico, idioms e precisão contextual.'
        : 'Prática de conversação ativa e consolidação de vocabulário.',
      conceitos_relacionados: [topico],
    },
    novos_nos_grafo: [
      {
        tipo: 'vocabulario' as const,
        titulo: `Expressão em ${topico}`,
        descricao: `Compreensão demonstrada com sucesso na conversa em ${idiomaAlvo}.`,
        dominio_estimado: Math.min(100, avgDominio + 6),
        dificuldade: 2,
        evidencia: mensagem,
        relacionado_com: topico,
        tipo_relacao: 'relacionado_a' as const,
        traducao: `Vocabulário chave de ${idiomaAlvo}`,
      },
    ],
    xp_ganho: 30,
    conceitos_chave: [topico, `${idiomaAlvo} Practice`],
  };
}

function generateLocalStudyMaterial(
  conteudoOuUrl: string,
  tipoFonte: string,
  idiomaAlvo: string,
  nivelCefr: string,
  youtubeId?: string
) {
  const isYoutube = tipoFonte === 'youtube';
  const title = isYoutube
    ? `Mastering ${idiomaAlvo} with YouTube Video Analysis`
    : `Estudo Completo de ${idiomaAlvo}: Vocabulário e Diálogo`;

  return {
    id: `mat-${Date.now()}`,
    titulo: title,
    tipo_fonte: tipoFonte as 'youtube' | 'texto' | 'arquivo',
    fonte_original: conteudoOuUrl,
    youtube_video_id: youtubeId || (isYoutube ? 'dQw4w9WgXcQ' : undefined),
    idioma_alvo: idiomaAlvo,
    nivel_cefr: nivelCefr || 'B1',
    resumo: `Kit de estudos extraído a partir da fonte (${tipoFonte}). Contém vocabulário chave com transcrição fonética, estruturas gramaticais essenciais com dicas para falantes de português, diálogo conversacional de roleplay e flashcards de fixação.`,
    vocabulario: [
      {
        termo: 'Insightful',
        pronuncia_ipa: '/ˈɪn.saɪt.fəl/',
        traducao: 'Esclarecedor / Perspicaz',
        classe_gramatical: 'Adjetivo',
        exemplo: 'That was an insightful discussion on language immersion.',
        traducao_exemplo: 'Essa foi uma discussão muito esclarecedora sobre imersão em idiomas.',
        nivel: 'B2',
      },
      {
        termo: 'Get across',
        pronuncia_ipa: '/ɡɛt əˈkrɒs/',
        traducao: 'Transmitir / Fazer-se entender',
        classe_gramatical: 'Phrasal Verb',
        exemplo: 'He managed to get his message across clearly.',
        traducao_exemplo: 'Ele conseguiu transmitir sua mensagem com clareza.',
        nivel: 'B1',
      },
      {
        termo: 'Turn out',
        pronuncia_ipa: '/tɜːn aʊt/',
        traducao: 'Resultar / Revelar-se',
        classe_gramatical: 'Phrasal Verb',
        exemplo: 'The practice session turned out to be really fun.',
        traducao_exemplo: 'A sessão de prática acabou se revelando muito divertida.',
        nivel: 'B1',
      },
      {
        termo: 'Nuance',
        pronuncia_ipa: '/ˈnjuː.ɑːns/',
        traducao: 'Nuance / Detalhe sutil',
        classe_gramatical: 'Substantivo',
        exemplo: 'Understanding cultural nuances is key to fluency.',
        traducao_exemplo: 'Compreender nuances culturais é a chave para a fluência.',
        nivel: 'B2',
      },
    ],
    gramatica: [
      {
        topico: 'Uso de Phrasal Verbs Separables vs Inseparable',
        explicacao: 'Muitos phrasal verbs aceitam o objeto direto no meio (ex: "turn the lights on" ou "turn on the lights"), mas quando usamos pronomes ("it", "them"), o pronome DEVE ficar no meio ("turn it on").',
        exemplos: [
          'Please turn on the audio. / Please turn it on.',
          'Look up the new word. / Look it up in the dictionary.',
        ],
        dica_para_brasileiros: 'Nunca diga "turn on it". Em inglês, pronomes sempre separam phrasal verbs transitivos.',
      },
      {
        topico: 'Present Perfect para Experiências Sem Data Específica',
        explicacao: 'Quando falamos de experiências de vida sem especificar o momento exato no passado, usamos Have/Has + Particípio.',
        exemplos: [
          'Have you ever watched this video before?',
          'I have practiced this conversation three times this week.',
        ],
        dica_para_brasileiros: 'Não confunda com o passado simples! Se disser "yesterday" ou "last year", use Simple Past.',
      },
    ],
    dialogo_pratica: [
      {
        personagem: 'Alex',
        fala: 'Hey! Did you have a chance to check out that video?',
        traducao: 'Oi! Teve a oportunidade de dar uma olhada naquele vídeo?',
        audio_tip: 'Pronuncie "did you" com som suave /dɪdʒu/ no connected speech.',
      },
      {
        personagem: 'Sam',
        fala: 'Yes, absolutely! It turned out to be super insightful.',
        traducao: 'Sim, com certeza! Acabou sendo super esclarecedor.',
      },
      {
        personagem: 'Alex',
        fala: 'I agree. It really helped me get some new concepts across.',
        traducao: 'Concordo. Realmente me ajudou a transmitir alguns novos conceitos.',
      },
      {
        personagem: 'Sam',
        fala: 'Let’s practice discussing it with our language tutor now!',
        traducao: 'Vamos praticar discutindo isso com nosso tutor de línguas agora!',
      },
    ],
    questoes_compreensao: [
      {
        pergunta: 'Qual é o sentido principal do phrasal verb "get across" no contexto do material?',
        opcoes: [
          'Atravessar uma rua movimentada',
          'Fazer-se entender ou transmitir uma mensagem claramente',
          'Cancelar um compromisso importante',
          'Desistir de aprender um idioma',
        ],
        resposta_correta: 'Fazer-se entender ou transmitir uma mensagem claramente',
        explicacao: '"Get across" é uma expressão comum para comunicar ideias com sucesso.',
      },
      {
        pergunta: 'Ao usar um pronome com o phrasal verb "look up" (pesquisar), qual é a forma correta?',
        opcoes: ['Look up it', 'Look it up', 'Look to it up', 'Looking up it'],
        resposta_correta: 'Look it up',
        explicacao: 'Pronomes sempre vão entre o verbo e a partícula em phrasal verbs separáveis.',
      },
    ],
    flashcards: [
      {
        frente: 'Insightful',
        verso: 'Esclarecedor / Perspicaz',
        dica: 'Pense em "insight" (ideia genial/revelação) + "ful" (cheio de).',
      },
      {
        frente: 'Get across',
        verso: 'Transmitir / Fazer-se entender',
        dica: 'Conectar a mensagem de um lado ao outro da mente.',
      },
      {
        frente: 'Turn out',
        verso: 'Resultar / Revelar-se no final',
        dica: 'It turned out well! (Tudo correu bem no final).',
      },
      {
        frente: 'Nuance',
        verso: 'Detalhe sutil / Matiz de significado',
        dica: 'Pronúncia /njuː.ɑːns/ com acento no som francês suave.',
      },
    ],
    dicas_culturais_e_pronuncia: [
      'Connected Speech: Falantes nativos costumam juntar consoantes finais com vogais seguintes (ex: "turn it out" soa como "tur-ni-tout").',
      'Entonação de Confirmação: Em perguntas reflexivas, elevar a entonação ao final soa muito mais natural e amigável.',
    ],
    conteudo_markdown: `# Guia de Estudos: ${title}\n\n**Idioma Alvo**: ${idiomaAlvo} | **Nível**: ${nivelCefr}\n\n## 1. Resumo do Material\n${isYoutube ? 'Análise do vídeo selecionado do YouTube para desenvolvimento de escuta e conversação.' : 'Análise de texto para enriquecimento vocabular e gramatical.'}\n\n## 2. Vocabulário Chave\n- **Insightful** (/ˈɪn.saɪt.fəl/): Esclarecedor. *Ex: That was an insightful discussion.*\n- **Get across** (/ɡɛt əˈkrɒs/): Fazer-se entender. *Ex: He got his point across.*\n- **Turn out** (/tɜːn aʊt/): Resultar. *Ex: It turned out great.*\n\n## 3. Prática Conversacional\nPratique o diálogo com seu Tutor de Línguas para destravar sua fala!`,
    criado_em: new Date().toISOString(),
    adicionado_ao_grafo: false,
  };
}

function generateLocalWordContext(palavra: string, fraseContexto: string, idioma: string) {
  const lower = palavra.toLowerCase().trim();

  // Dicionário rico de palavras e expressões comuns
  const dictionary: Record<string, any> = {
    actually: {
      palavra: 'actually',
      lemma_raiz: 'actual',
      classe_gramatical: 'Advérbio',
      idioma: 'Inglês',
      nivel_cefr: 'B1',
      pronuncia_ipa: '/ˈæk.tʃu.ə.li/',
      traducao_principal: 'Na verdade, realmente',
      definicao_contextual: 'Usado para esclarecer ou corrigir uma informação, enfatizando a verdade de uma situação.',
      sinonimos: ['in fact', 'really', 'truly', 'as a matter of fact'],
      antonimos: ['supposedly', 'theoretically'],
      exemplos_uso: [
        {
          frase_original: 'I actually enjoyed the meeting today.',
          traducao_portugues: 'Na verdade, eu gostei da reunião hoje.',
        },
        {
          frase_original: "It's not that difficult, actually.",
          traducao_portugues: 'Não é tão difícil, na verdade.',
        },
      ],
      falso_amigo_alerta: '⚠️ CUIDADO: "Actually" NÃO significa "atualmente". Para "atualmente", use "currently" ou "nowadays".',
      dica_uso_ou_collocation: 'Muito usado no início ou fim de frases para dar tom cordial a uma correção.',
      origem_etimologia: 'Do latim *actualis* (ativo, em ato).',
    },
    pretend: {
      palavra: 'pretend',
      lemma_raiz: 'pretend',
      classe_gramatical: 'Verbo',
      idioma: 'Inglês',
      nivel_cefr: 'B1',
      pronuncia_ipa: '/prɪˈtend/',
      traducao_principal: 'Fingir, simular',
      definicao_contextual: 'Comportar-se como se algo fosse verdadeiro quando não é.',
      sinonimos: ['fake', 'simulate', 'feign', 'make believe'],
      antonimos: ['be genuine', 'reveal'],
      exemplos_uso: [
        {
          frase_original: "Let's pretend we are already fluent in English.",
          traducao_portugues: 'Vamos fingir que já somos fluentes em inglês.',
        },
        {
          frase_original: "Don't pretend you didn't hear me.",
          traducao_portugues: 'Não finja que você não me ouviu.',
        },
      ],
      falso_amigo_alerta: '⚠️ FALSO COGNATO: "Pretend" significa FINGIR. Se você quer dizer "pretender/ter intenção", use "intend" ou "plan to".',
      dica_uso_ou_collocation: 'Estrutura comum: pretend to + verbo infinitivo (ex: pretend to know).',
    },
    intend: {
      palavra: 'intend',
      lemma_raiz: 'intend',
      classe_gramatical: 'Verbo transitivo',
      idioma: 'Inglês',
      nivel_cefr: 'B2',
      pronuncia_ipa: '/ɪnˈtend/',
      traducao_principal: 'Pretender, ter a intenção de',
      definicao_contextual: 'Ter em mente como propósito ou objetivo futuro.',
      sinonimos: ['plan', 'aim', 'purpose', 'mean'],
      antonimos: ['neglect', 'disregard'],
      exemplos_uso: [
        {
          frase_original: 'I intend to practice conversation every morning.',
          traducao_portugues: 'Eu pretendo praticar conversação todas as manhãs.',
        },
      ],
      dica_uso_ou_collocation: 'Comum com infinitivo: intend to do something.',
    },
    fluent: {
      palavra: 'fluent',
      lemma_raiz: 'fluent',
      classe_gramatical: 'Adjetivo',
      idioma: 'Inglês',
      nivel_cefr: 'B2',
      pronuncia_ipa: '/ˈfluː.ənt/',
      traducao_principal: 'Fluente, desenvolto',
      definicao_contextual: 'Capaz de falar ou escrever uma língua de forma fácil, contínua e precisa.',
      sinonimos: ['articulate', 'eloquent', 'natural', 'smooth'],
      antonimos: ['hesitant', 'struggling'],
      exemplos_uso: [
        {
          frase_original: 'She is fluent in three languages.',
          traducao_portugues: 'Ela é fluente em três idiomas.',
        },
      ],
      dica_uso_ou_collocation: 'Collocation: fluent in + idioma (fluent in English/Spanish).',
    },
    collocation: {
      palavra: 'collocation',
      lemma_raiz: 'collocate',
      classe_gramatical: 'Substantivo',
      idioma: 'Inglês',
      nivel_cefr: 'B2',
      pronuncia_ipa: '/ˌkɑː.ləˈkeɪ.ʃən/',
      traducao_principal: 'Combinação natural de palavras (colocação)',
      definicao_contextual: 'O hábito de certas palavras ocorrerem juntas frequentemente na língua natural (ex: make a decision, take a break).',
      sinonimos: ['word partnership', 'natural phrasing', 'idiomatic pairing'],
      exemplos_uso: [
        {
          frase_original: 'Learning collocations will make you sound more natural.',
          traducao_portugues: 'Aprender colocações fará você soar mais natural.',
        },
      ],
      dica_uso_ou_collocation: 'Exemplo: "fast food" e não "quick food".',
    },
  };

  if (dictionary[lower]) {
    return dictionary[lower];
  }

  // Fallback inteligente baseado em morfologia e idioma
  return {
    palavra,
    lemma_raiz: palavra.toLowerCase().replace(/(ing|ed|ly|s|es)$/, ''),
    classe_gramatical: palavra.endsWith('ly')
      ? 'Advérbio'
      : palavra.endsWith('ing')
      ? 'Verbo / Gerúndio'
      : palavra.endsWith('ed')
      ? 'Verbo / Particípio'
      : 'Vocabulário Ativo',
    idioma,
    nivel_cefr: 'B1' as const,
    pronuncia_ipa: `/${palavra.toLowerCase()}/`,
    traducao_principal: `Tradução e conceito de "${palavra}"`,
    definicao_contextual: `Termo utilizado no contexto da frase "${fraseContexto || palavra}".`,
    sinonimos: ['termo similar', 'expressão equivalente', 'sinônimo natural'],
    antonimos: [],
    exemplos_uso: [
      {
        frase_original: fraseContexto || `Practice using "${palavra}" in daily conversations.`,
        traducao_portugues: `Pratique o uso de "${palavra}" nas suas conversas diárias.`,
      },
    ],
    dica_uso_ou_collocation: `Observe a preposição e o contexto em que "${palavra}" aparece nesta frase.`,
  };
}

function generateDefaultCalendarProposals(
  duracao: number,
  horario: string,
  topicosDificeis: string[] = [],
  revisoesPendentes: string[] = []
) {
  const propostas = [];
  const tipos: ('revisao_espacada' | 'novo_conceito' | 'correcao_erros')[] = [
    'revisao_espacada',
    'novo_conceito',
    'correcao_erros',
    'revisao_espacada',
    'novo_conceito',
    'revisao_espacada',
    'correcao_erros',
  ];

  const now = new Date();
  const [h, m] = (horario || '19:00').split(':').map(Number);

  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(h || 19, m || 0, 0, 0);

    const end = new Date(d);
    end.setMinutes(end.getMinutes() + duracao);

    const tipo = tipos[i];
    let topicosSessao = ['Prática Conversacional', 'Vocabulário Ativo'];
    let titulo = 'Sessão de Idiomas';

    if (tipo === 'revisao_espacada') {
      const topicoFoco = revisoesPendentes[i % (revisoesPendentes.length || 1)] || 'Fixação em Grafo';
      titulo = `Revisão Espaçada: ${topicoFoco}`;
      topicosSessao = [topicoFoco, 'Repetição Ativa'];
    } else if (tipo === 'correcao_erros') {
      const erroFoco = topicosDificeis[i % (topicosDificeis.length || 1)] || 'Falsos Amigos & Pronúncia';
      titulo = `Superando Desafios: ${erroFoco}`;
      topicosSessao = [erroFoco, 'Correção de Desvios'];
    } else {
      titulo = `Novo Conteúdo: Expressões & Diálogos Reais`;
      topicosSessao = ['Expansão Lexical', 'Fluência Conversacional'];
    }

    propostas.push({
      id: `prop-auto-${Date.now()}-${i}`,
      titulo,
      descricao: `Sessão personalizada de ${duracao} min com foco em ${topicosSessao.join(', ')} e retenção acelerada.`,
      inicio: d.toISOString(),
      fim: end.toISOString(),
      duracao_minutos: duracao,
      topicos: topicosSessao,
      prioridade: i === 0 || i === 2 ? ('alta' as const) : ('media' as const),
      tipo,
    });
  }

  return propostas;
}

function generateLocalOnboardingPlan(
  idioma: string,
  nivel: string,
  motivo: string,
  motivoDetalhado: string,
  interesses: string[],
  tempoDiario: number,
  estilo: string
) {
  const planId = `plan-local-${Date.now()}`;
  const firstInterest = interesses[0] || 'Conversação Prática';
  const secondInterest = interesses[1] || 'Vocabulário Ativo';

  const vocabMap: Record<string, any[]> = {
    'Inglês': [
      {
        termo: 'Touch base',
        pronuncia_ipa: '/tʌtʃ beɪs/',
        traducao: 'Fazer um contato rápido / Alinhar pontos',
        classe_gramatical: 'Expressão idiomática',
        exemplo: "Let's touch base tomorrow morning before the sprint planning.",
        traducao_exemplo: 'Vamos nos alinhar amanhã de manhã antes do planejamento da sprint.',
      },
      {
        termo: 'Actually',
        pronuncia_ipa: '/ˈæk.tʃu.ə.li/',
        traducao: 'Na verdade, realmente',
        classe_gramatical: 'Advérbio (Atenção a Falso Cognato)',
        exemplo: 'Actually, the requirements changed yesterday.',
        traducao_exemplo: 'Na verdade, os requisitos mudaram ontem.',
      },
      {
        termo: 'Wrap up',
        pronuncia_ipa: '/ræp ʌp/',
        traducao: 'Finalizar / Concluir',
        classe_gramatical: 'Phrasal Verb',
        exemplo: 'We need to wrap up this discussion in five minutes.',
        traducao_exemplo: 'Precisamos concluir esta discussão em cinco minutos.',
      },
      {
        termo: 'Insights',
        pronuncia_ipa: '/ˈɪn.saɪts/',
        traducao: 'Percepções valiosas / Ideias esclarecedoras',
        classe_gramatical: 'Substantivo plural',
        exemplo: 'Thank you for sharing your valuable insights on the project.',
        traducao_exemplo: 'Obrigado por compartilhar suas valiosas percepções sobre o projeto.',
      },
    ],
    'Espanhol': [
      {
        termo: 'Ponerse al día',
        pronuncia_ipa: '/poˈneɾ.se al ˈdi.a/',
        traducao: 'Colocar o papo em dia / Atualizar-se',
        classe_gramatical: 'Expressão idiomática',
        exemplo: 'Vamos a tomar un café para ponernos al día sobre el trabajo.',
        traducao_exemplo: 'Vamos tomar um café para nos atualizarmos sobre o trabalho.',
      },
      {
        termo: 'Actualmente',
        pronuncia_ipa: '/ak.twa.lˈmen.te/',
        traducao: 'Atualmente, hoje em dia',
        classe_gramatical: 'Advérbio',
        exemplo: 'Actualmente estoy liderando un nuevo proyecto de tecnología.',
        traducao_exemplo: 'Atualmente estou liderando um novo projeto de tecnologia.',
      },
      {
        termo: 'Tener en cuenta',
        pronuncia_ipa: '/teˈneɾ en ˈkwen.ta/',
        traducao: 'Levar em consideração / Ter em mente',
        classe_gramatical: 'Expressão idiomática',
        exemplo: 'Hay que tener en cuenta los plazos de entrega.',
        traducao_exemplo: 'É preciso levar em consideração os prazos de entrega.',
      },
    ],
    'Francês': [
      {
        termo: 'Faire le point',
        pronuncia_ipa: '/fɛʁ lə pwɛ̃/',
        traducao: 'Fazer um balanço / Alinhar a situação',
        classe_gramatical: 'Expressão idiomática',
        exemplo: 'Faisons le point sur les priorités de la semaine.',
        traducao_exemplo: 'Vamos fazer um balanço sobre as prioridades da semana.',
      },
      {
        termo: 'En fait',
        pronuncia_ipa: '/ɑ̃ fɛt/',
        traducao: 'Na verdade, de fato',
        classe_gramatical: 'Expressão / Advérbio',
        exemplo: 'En fait, je suis tout à fait d’accord avec cette approche.',
        traducao_exemplo: 'Na verdade, concordo plenamente com essa abordagem.',
      },
    ],
  };

  const vocabList = vocabMap[idioma] || vocabMap['Inglês'];

  const initialNodes = vocabList.map((v, idx) => ({
    id: `node-onb-${Date.now()}-${idx}`,
    tipo: (v.classe_gramatical.includes('Falso') ? 'falso_amigo' : 'vocabulario') as any,
    titulo: v.termo,
    descricao: v.traducao,
    dominio_estimado: 45,
    dificuldade: 2,
    frequencia_erro: 0,
    ultima_revisao: new Date().toISOString(),
    proxima_revisao: new Date(Date.now() + 86400000).toISOString(),
    idioma,
    pronuncia_ipa: v.pronuncia_ipa,
    traducao: v.traducao,
    exemplo_uso: v.exemplo,
    evidencias: ['Plano Inicial do Assistente'],
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  }));

  const recommendedTopic = `${idioma}: ${motivo} & ${firstInterest}`;

  return {
    id: planId,
    titulo_plano: `Trilha Sob Medida: ${idioma} para ${motivo}`,
    descricao_plano: `Plano estruturado de ${tempoDiario} minutos diários focado em ${firstInterest} e ${secondInterest}, calibrado para o nível ${nivel}.`,
    idioma,
    nivel_cefr: nivel,
    meta_diaria_minutos: tempoDiario,
    motivo_principal: motivo,
    interesses_principais: interesses,
    topico_inicial_recomendado: recommendedTopic,
    mensagem_boas_vindas_tutor: `Olá! Seu plano de ${idioma} foi montado especialmente para seus objetivos de "${motivo}". Preparei um ambiente focado nos seus interesses em ${firstInterest}. Vamos começar com um bate-papo leve e prático?`,
    estrategia_pedagogica: 'Imersão contextual com foco em vocabulário ativo, repetição espaçada no grafo relacional e conversação sem medo de errar.',
    cronograma_semanal: [
      {
        dia_semana: 'Segunda-feira',
        foco: `Vocabulário Essencial de ${firstInterest}`,
        duracao_minutos: tempoDiario,
        tipo_atividade: 'chat' as const,
        descricao_pratica: `Praticar termos e expressões chave de ${firstInterest} no chat conversacional.`,
      },
      {
        dia_semana: 'Terça-feira',
        foco: 'Repetição Espaçada & Flashcards SM-2',
        duracao_minutos: tempoDiario,
        tipo_atividade: 'flashcards' as const,
        descricao_pratica: 'Revisar os novos cartões gerados e consolidar a retenção.',
      },
      {
        dia_semana: 'Quarta-feira',
        foco: `Diálogo Situacional: ${secondInterest}`,
        duracao_minutos: tempoDiario,
        tipo_atividade: 'chat' as const,
        descricao_pratica: 'Simular uma situação real de conversação e foco em pronúncia natural.',
      },
      {
        dia_semana: 'Quinta-feira',
        foco: 'Duelo de Vocabulário Rápido',
        duracao_minutos: tempoDiario,
        tipo_atividade: 'duel' as const,
        descricao_pratica: 'Treinar reflexo rápido e precisão de termos sob pressão.',
      },
      {
        dia_semana: 'Sexta-feira',
        foco: 'Kit de Estudos & Leitura Guiada',
        duracao_minutos: tempoDiario,
        tipo_atividade: 'materials' as const,
        descricao_pratica: 'Explorar o kit de estudos gerado com áudio IPA e questões.',
      },
      {
        dia_semana: 'Sábado',
        foco: 'Conversação Livre & Feedback de Pronúncia',
        duracao_minutos: tempoDiario,
        tipo_atividade: 'chat' as const,
        descricao_pratica: 'Bate-papo por voz em tempo real para consolidar a semana.',
      },
      {
        dia_semana: 'Domingo',
        foco: 'Revisão do Grafo de Memória & Descanso Ativo',
        duracao_minutos: Math.max(10, Math.round(tempoDiario * 0.5)),
        tipo_atividade: 'flashcards' as const,
        descricao_pratica: 'Revisão leve de 10 minutos para manter o streak ativo.',
      },
    ],
    nos_iniciais_grafo: initialNodes,
    primeiro_material_estudo: {
      id: `mat-onboarding-${Date.now()}`,
      titulo: `${idioma}: Guia Prático para ${motivo}`,
      tipo_fonte: 'texto' as const,
      fonte_original: 'Assistente de Configuração Personalizado',
      idioma_alvo: idioma,
      nivel_cefr: nivel,
      resumo: `Kit fundamental com vocabulário prioritário, padrão de diálogo e flashcards calibrados para quem estuda para ${motivo}.`,
      vocabulario: vocabList,
      gramatica: [
        {
          topico: 'Conectivos e Fluência Conversacional',
          explicacao: 'Use conectivos naturais para estruturar suas ideias sem parecer engessado.',
          exemplos: [
            'On the other hand, we should consider alternative options.',
            'As far as I know, the team is already working on it.',
          ],
          dica_para_brasileiros: 'Evite pausas longas com "ééé...", use fillers naturais como "Well...", "You see...", "Actually..."',
        },
      ],
      dialogo_pratica: [
        {
          personagem: 'Alex',
          fala: 'Hi there! Have you had a chance to look at the project updates?',
          traducao: 'Olá! Você teve chance de olhar as atualizações do projeto?',
        },
        {
          personagem: 'Você',
          fala: 'Actually, yes! I reviewed them this morning and have some good insights.',
          traducao: 'Na verdade, sim! Eu revisei hoje de manhã e tenho algumas boas percepções.',
        },
      ],
      questoes_compreensao: [
        {
          pergunta: `Qual a melhor forma de usar "Actually" em uma reunião?`,
          opcoes: [
            'Como tradução de atualmente para indicar o presente momento',
            'Para esclarecer um ponto com cordialidade ("na verdade / de fato")',
            'Como substituto de "never"',
          ],
          resposta_correta: 'Para esclarecer um ponto com cordialidade ("na verdade / de fato")',
          explicacao: 'Actually é um falso cognato para brasileiros; significa "na verdade" e não "atualmente".',
        },
      ],
      flashcards: vocabList.map((v) => ({
        frente: v.termo,
        verso: `${v.traducao}\nEx: ${v.exemplo}`,
        dica: v.pronuncia_ipa || 'Pratique em voz alta',
      })),
      dicas_culturais_e_pronuncia: [
        'Pratique os termos novos em frases completas em vez de listas isoladas.',
        'Grave sua voz e compare a entonação no espectro de áudio do chat.',
      ],
      conteudo_markdown: `# ${idioma}: Guia Prático para ${motivo}\n\nBem-vindo ao seu plano de estudos! Explore este material para acelerar sua fluência.`,
      criado_em: new Date().toISOString(),
      adicionado_ao_grafo: true,
    },
    dicas_personalizadas: [
      `Ajuste sua rotina para estudar ${tempoDiario} min no mesmo horário todo dia.`,
      'Intercale momentos de fala por voz com momentos de revisão de flashcards no app.',
      'Sempre que o tutor apontar uma correção, repita a frase corrigida em voz alta.',
    ],
    criado_em: new Date().toISOString(),
  };
}

startServer();


