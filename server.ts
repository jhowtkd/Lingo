import http from 'http';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

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
 * Executa chamadas ao Gemini com retry exponencial e fallback de modelos para 503 (High Demand/UNAVAILABLE) e 429
 */
async function generateContentWithRetryAndFallback(
  client: GoogleGenAI,
  params: {
    model?: string;
    contents: any;
    config?: any;
  },
  fallbackModels: string[] = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest']
) {
  const preferredModel = params.model || 'gemini-3.7-flash';
  const modelsToTry = [preferredModel, ...fallbackModels.filter((m) => m !== preferredModel)];

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          ...params,
          model: modelName,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = (err?.message || String(err)).toLowerCase();
        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('unavailable') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('resource has been exhausted') ||
          errMsg.includes('overloaded') ||
          errMsg.includes('rate limit');

        console.warn(
          `[Gemini Resiliente] Modelo ${modelName} (tentativa ${attempt + 1}) retornou: ${err?.message || err}`
        );

        if (isTransient) {
          // Pequena pausa com backoff antes da próxima tentativa
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        } else {
          // Erro não transitório (ex: schema de formato), pula para próximo modelo
          break;
        }
      }
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

  // Chat com o Tutor de Línguas (com adaptação dinâmica e correções de idiomas)
  app.post('/api/chat', async (req, res) => {
    try {
      const {
        mensagem,
        historico = [],
        topico_atual = 'Conversação Geral',
        idioma_alvo = 'Inglês',
        nivel_estudante = 'Intermediário (B1)',
        modo_conversa = 'bilingue', // 'bilingue', 'imersao', 'roleplay'
        contexto_grafo = [],
        correcoes_recentes = [],
        preferencia_adaptacao,
      } = req.body;

      if (!mensagem || typeof mensagem !== 'string') {
        return res.status(400).json({ error: 'Mensagem é obrigatória' });
      }

      const client = getGeminiClient();

      if (!client) {
        // Fallback robusto para testes e modo local caso API key não esteja disponível
        return res.json(generateLocalLanguageTutorResponse(mensagem, topico_atual, idioma_alvo, contexto_grafo, preferencia_adaptacao));
      }

      const promptContext = `
Você é um Tutor de Línguas (Language Tutor) sênior de excelência mundial, especialista no ensino de ${idioma_alvo} para falantes de Português.
Seu objetivo é guiar o estudante pelo aprendizado ativo no tópico: "${topico_atual}".
Idioma Alvo de Estudo: "${idioma_alvo}".
Nível Geral Estimado (CEFR): "${nivel_estudante}".
Modo de Conversação Selecionado: "${modo_conversa}" (bilingue = respostas explicativas com foco prático; imersao = maior parte no idioma-alvo com suporte; roleplay = simulação interativa de diálogo real).
Preferência de adaptação explícita do usuário: ${preferencia_adaptacao || 'Nenhuma (calibrar automaticamente com base no grafo de idiomas)'}.

Memórias do Grafo de Conhecimento de Idiomas relevantes (vocabulários conhecidos, dificuldades gramaticais, falsos cognatos):
${JSON.stringify(contexto_grafo, null, 2)}

Dificuldades e correções linguísticas anteriores registradas:
${JSON.stringify(correcoes_recentes, null, 2)}

Histórico recente da conversa:
${JSON.stringify(historico.slice(-6), null, 2)}

Nova mensagem do estudante:
"${mensagem}"

DIRETRIZES DO TUTOR DE LÍNGUAS:
1. Adaptação Dinâmica de Nível (CEFR):
   - Domínio baixo (< 55% / A1-A2): use explicações claras, forneça traduções de suporte, analogias fonéticas com o português e divida as estruturas gramaticais em pedaços simples.
   - Domínio intermediário (55-79% / B1-B2): estimule o uso de tempos verbais variados, conectivos (linkers), collocations e expressões naturais, apontando nuances sutis.
   - Domínio alto (>= 80% / C1-C2): foque em precisão estilística, idioms, connected speech, phrasal verbs avançados e vocabulário sofisticado.
2. Identificação de Erros Linguísticos:
   - Detecte desvios gramaticais, preposições incorretas, conjugação errada, falsos cognatos (false friends) ou frases traduzidas literalmente do português que soem artificiais.
3. Se houver erro ou oportunidade de melhoria:
   - Seja extremamente acolhedor e encorajador.
   - Mostre como um falante nativo diria de forma natural ("Em ${idioma_alvo}, é mais natural dizer...").
   - Explique o motivo (ex: regra gramatical ou padrão de uso) e dê uma dica prática de memorização / pronúncia.
   - Faça uma pergunta de confirmação ou convite para o aluno tentar usar a expressão correta na próxima frase.
4. Se a frase estiver correta:
   - Valide positivamente e apresente uma variação de vocabulário mais rica ou faça uma pergunta que dê continuidade ao diálogo em ${idioma_alvo}.
5. Extraia novos nós de vocabulário, regras gramaticais ou pontos de atenção para o Grafo de Memória.
6. Atribua XP justo por esforço comunicativo (ex: 15-40 XP).
`;

      const response = await generateContentWithRetryAndFallback(client, {
        model: 'gemini-3.7-flash',
        contents: promptContext,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              resposta_tutor: {
                type: Type.STRING,
                description: 'A resposta acolhedora do tutor de línguas com exemplos práticos, diálogos e orientações claras.',
              },
              possui_erro: {
                type: Type.BOOLEAN,
                description: 'Verdadeiro se foi detectado erro gramatical, de vocabulário, falso amigo ou de concordância.',
              },
              adaptacao: {
                type: Type.OBJECT,
                description: 'Metadados da adaptação dinâmica de complexidade aplicada na explicação.',
                properties: {
                  nivel: {
                    type: Type.STRING,
                    enum: ['fundamental_analogico', 'intermediario_aplicado', 'avancado_analitico'],
                  },
                  rotulo: { type: Type.STRING },
                  dominio_avaliado: { type: Type.NUMBER },
                  justificativa: { type: Type.STRING },
                  estrategia_pedagogica: { type: Type.STRING },
                  conceitos_relacionados: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['nivel', 'rotulo', 'dominio_avaliado', 'justificativa', 'estrategia_pedagogica'],
              },
              correcao: {
                type: Type.OBJECT,
                description: 'Detalhes da correção linguística, se aplicável.',
                properties: {
                  conceito: { type: Type.STRING },
                  erro: { type: Type.STRING },
                  explicacao: { type: Type.STRING },
                  resposta_corrigida: { type: Type.STRING },
                  gravidade: {
                    type: Type.STRING,
                    enum: ['leve', 'moderada', 'critica'],
                  },
                  evidencia: { type: Type.STRING },
                  pergunta_confirmacao: { type: Type.STRING },
                  dica_pronuncia_ou_gramatica: { type: Type.STRING },
                },
              },
              novos_nos_grafo: {
                type: Type.ARRAY,
                description: 'Vocabulários, estruturas ou regras para adicionar ao grafo de memória de línguas.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tipo: {
                      type: Type.STRING,
                      enum: [
                        'topico',
                        'conceito',
                        'vocabulario',
                        'gramatica',
                        'falso_amigo',
                        'expressao_idiomatica',
                        'dificuldade',
                        'equivoco',
                        'objetivo_aprendizagem',
                        'anotacao',
                      ],
                    },
                    titulo: { type: Type.STRING },
                    descricao: { type: Type.STRING },
                    dominio_estimado: { type: Type.NUMBER },
                    dificuldade: { type: Type.NUMBER },
                    evidencia: { type: Type.STRING },
                    relacionado_com: { type: Type.STRING },
                    tipo_relacao: {
                      type: Type.STRING,
                      enum: [
                        'relacionado_a',
                        'pre_requisito_de',
                        'confundido_com',
                        'dificuldade_em',
                        'evidenciado_por',
                        'sinonimo_de',
                        'antonymo_de',
                        'derivado_de',
                      ],
                    },
                    pronuncia_ipa: { type: Type.STRING },
                    traducao: { type: Type.STRING },
                    exemplo_uso: { type: Type.STRING },
                  },
                  required: ['tipo', 'titulo', 'descricao'],
                },
              },
              xp_ganho: {
                type: Type.NUMBER,
                description: 'Pontos de experiência concedidos (10 a 50)',
              },
              conceitos_chave: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['resposta_tutor', 'possui_erro', 'xp_ganho', 'adaptacao'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        resposta_tutor: parsed.resposta_tutor || 'Great expression! Let\'s keep practicing.',
        possui_erro: Boolean(parsed.possui_erro),
        adaptacao: parsed.adaptacao || {
          nivel: 'intermediario_aplicado',
          rotulo: 'B1/B2 - Intermediário com Aplicação Prática',
          dominio_avaliado: 68,
          justificativa: 'Compreensão sólida identificada no grafo de idiomas.',
          estrategia_pedagogica: 'Imersão conversacional e expansão lexical.',
        },
        correcao: parsed.possui_erro ? parsed.correcao : null,
        novos_nos_grafo: parsed.novos_nos_grafo || [],
        xp_ganho: parsed.xp_ganho || 20,
        conceitos_chave: parsed.conceitos_chave || [topico_atual],
      });
    } catch (err: any) {
      console.error('Erro na rota /api/chat:', err);
      const fallback = generateLocalLanguageTutorResponse(
        req.body?.mensagem || '',
        req.body?.topico_atual || 'Geral',
        req.body?.idioma_alvo || 'Inglês',
        req.body?.contexto_grafo || [],
        req.body?.preferencia_adaptacao
      );
      return res.json(fallback);
    }
  });

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

  // Transcrição de Áudio (Gemini Multimodal)
  app.post('/api/transcribe', async (req, res) => {
    try {
      const { audio_base64, mime_type = 'audio/webm', idioma = 'pt-BR' } = req.body;

      if (!audio_base64) {
        return res.status(400).json({ error: 'Nenhum áudio recebido' });
      }

      const client = getGeminiClient();

      if (!client) {
        return res.json({
          texto: 'Explicação por voz recebida e processada com sucesso no ambiente local.',
          confianca: 0.95,
        });
      }

      const cleanBase64 = audio_base64.replace(/^data:[^;]+;base64,/, '');

      const response = await generateContentWithRetryAndFallback(client, {
        model: 'gemini-3.7-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mime_type,
                data: cleanBase64,
              },
            },
            {
              text: `Transcreva com exatidão todo o áudio falado pelo estudante no idioma ${idioma}. Retorne estritamente o texto transcrito, sem introduções ou explicações.`,
            },
          ],
        },
      });

      const transcribedText = response.text?.trim() || '';
      return res.json({
        texto: transcribedText,
        confianca: 0.98,
      });
    } catch (err: any) {
      console.error('Erro na transcrição:', err);
      return res.json({
        texto: 'Prática de conversação por voz registrada com sucesso.',
        confianca: 0.9,
      });
    }
  });

  // NOVO: Avaliação Detalhada de Pronúncia e Score Fonético com Análise IPA e Decomposição de Palavras
  app.post('/api/pronunciation-assessment', async (req, res) => {
    try {
      const {
        audio_base64,
        mime_type = 'audio/webm',
        texto_falado = '',
        texto_esperado = '',
        idioma = 'Inglês',
        topico = 'Conversação',
      } = req.body;

      const client = getGeminiClient();
      const cleanBase64 = audio_base64 ? audio_base64.replace(/^data:[^;]+;base64,/, '') : null;

      const promptInstrucao = `
Você é um Foneticista e Avaliador Especialista de Pronúncia de Línguas Estrangeiras (especialmente focado em falantes de Português Brasileiro aprendendo ${idioma}).
Analise a pronúncia da resposta falada pelo estudante.

Texto Falado/Transcrito: "${texto_falado || 'Áudio enviado'}"
Texto/Frase de Referência ou Contexto: "${texto_esperado || topico}"
Idioma Alvo: ${idioma}

Diretrizes de Avaliação:
1. Calcule scores realistas de 0 a 100 para:
   - overall_score: pontuação global ponderada
   - accuracy_score: precisão dos fonemas (consoantes, vogais abertas/fechadas, sons ausentes no português como TH, R retroflexo, vogais curtas /ɪ/ vs /iː/, -ed final)
   - fluency_score: encadeamento (connected speech, linking, ausência de pausas artificiais)
   - prosody_score: entonação, tonicidade de sílaba (stress timing) e ritmo
   - completeness_score: completude da sentença
2. Forneça o IPA Esperado (transcrição fonética padrão) e o IPA Transcrito/Pronunciado.
3. Faça uma decomposição de CADA palavra do texto falado (words_breakdown) contendo:
   - word
   - expected_ipa
   - transcribed_ipa
   - accuracy (0 a 100)
   - status: 'perfeito' (accuracy >= 88), 'bom' (accuracy >= 70), 'atencao' (accuracy >= 50), 'incorreto' (accuracy < 50)
   - feedback: dica curta do fonema específico
4. Destaque um Ponto Forte (ponto_forte), Ponto a Melhorar (ponto_a_melhorar) e uma Dica Anatômica de Articulação da Boca/Língua (dica_articulacao_boca).
`;

      if (client && cleanBase64) {
        // Avaliação multimodal direta com o áudio
        const response = await generateContentWithRetryAndFallback(client, {
          model: 'gemini-3.7-flash',
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
        });

        const assessment = JSON.parse(response.text || '{}');
        return res.json({ scoreData: assessment });
      } else if (client && texto_falado) {
        // Avaliação baseada no texto reconhecido e contexto
        const response = await generateContentWithRetryAndFallback(client, {
          model: 'gemini-3.7-flash',
          contents: promptInstrucao,
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
        });

        const assessment = JSON.parse(response.text || '{}');
        return res.json({ scoreData: assessment });
      }

      // Fallback algorítmico local
      const words = (texto_falado || 'Hello world').trim().split(/\s+/);
      const mockBreakdown = words.map((w) => ({
        word: w,
        expected_ipa: `/${w.toLowerCase()}/`,
        transcribed_ipa: `/${w.toLowerCase()}/`,
        accuracy: 88,
        status: 'bom' as const,
        feedback: 'Articulação clara e inteligível.',
      }));

      return res.json({
        scoreData: {
          overall_score: 85,
          accuracy_score: 84,
          fluency_score: 86,
          prosody_score: 83,
          completeness_score: 95,
          recognized_text: texto_falado || 'Hello world',
          expected_phonetics_ipa: '/həˈloʊ wɜːrld/',
          transcribed_phonetics_ipa: '/həˈloʊ wɜːld/',
          words_breakdown: mockBreakdown,
          ponto_forte: 'Boa entonação e velocidade de fala natural.',
          ponto_a_melhorar: 'Atenção à transição das consoantes finais sem adicionar vogais de apoio.',
          dica_articulacao_boca: 'Mantenha a língua relaxada no assoalho da boca para sons neutros como o Schwa /ə/.',
        },
      });
    } catch (err: any) {
      console.warn('Erro em /api/pronunciation-assessment:', err?.message || err);
      return res.status(500).json({ error: 'Erro ao avaliar pronúncia' });
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

      // Executa geração de fala com o modelo gemini-3.1-flash-tts-preview
      const response = await client.models.generateContent({
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
  preferenciaAdaptacao?: string
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
      resposta_tutor: `Muito bom você tentar formular a frase em **${idiomaAlvo}**! Notei um detalhe sutil de interferência do português: em inglês, dizemos *"ask a question"* (e não "make a question") ou *"I am 20 years old"* (usando o verbo to be para idade). Vamos tentar reformular?`,
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
          'Em línguas estrangeiras, certas combinações de palavras (collocations) são fixas. Por exemplo, usa-se "ask" com "question", e o verbo "to be" para expressar idade.',
        resposta_corrigida: `I would like to ask a question regarding ${topico}.`,
        gravidade: 'leve' as const,
        evidencia: mensagem,
        pergunta_confirmacao: `Como você diria agora "Posso fazer uma pergunta sobre isso?" usando "ask"?`,
        dica_pronuncia_ou_gramatica: 'Dica: pratique a ligação sonora /æsk ə ˈkwɛstʃən/ (ask-a question).',
      },
      novos_nos_grafo: [
        {
          tipo: 'falso_amigo' as const,
          titulo: `Collocation: Ask a question (vs Make a question)`,
          descricao: `Ajuste de uso natural identificado na prática: "${mensagem.slice(0, 50)}"`,
          dominio_estimado: 55,
          dificuldade: 2,
          evidencia: mensagem,
          relacionado_com: topico,
          tipo_relacao: 'dificuldade_em' as const,
          traducao: 'Fazer uma pergunta (literalmente: pedir/perguntar uma pergunta)',
          exemplo_uso: 'Can I ask you a quick question?',
        },
      ],
      xp_ganho: 25,
      conceitos_chave: [topico, 'Natural Collocations'],
    };
  }

  const isAdvanced = avgDominio >= 80 || preferenciaAdaptacao === 'avancado_analitico';

  return {
    resposta_tutor: isAdvanced
      ? `That was spot on! Your sentence structure in **${idiomaAlvo}** is very natural and articulate. To elevate it further, you could incorporate nuanced discourse markers like *"furthermore"* or idiomatic phrasing. How would you express this in a professional business meeting?`
      : `Great sentence in **${idiomaAlvo}**! You communicated your idea clearly regarding **${topico}**. To practice even more, how would you describe a personal experience or ask me a follow-up question about this?`,
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
        descricao: `Compreensão demonstrada com sucesso na conversa.`,
        dominio_estimado: Math.min(100, avgDominio + 6),
        dificuldade: 2,
        evidencia: mensagem,
        relacionado_com: topico,
        tipo_relacao: 'relacionado_a' as const,
        traducao: 'Vocabulário chave de conversação',
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

startServer();

