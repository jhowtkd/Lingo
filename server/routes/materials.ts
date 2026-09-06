import express from 'express';
import { Type } from '@google/genai';
import type { GoogleGenAI } from '@google/genai';
import { generateWithFallback } from '../ai/generateWithFallback';

export function createMaterialsRouter(getClient: () => GoogleGenAI | null): express.Router {
  const router = express.Router();

  // NOVO: GERADOR DE MATERIAIS DE ESTUDO (A partir de Vídeos do YouTube ou Arquivos de Texto)
  router.post('/', async (req, res) => {
    try {
      const {
        tipo_fonte = 'texto', // 'youtube' | 'texto' | 'arquivo'
        conteudo_ou_url,
        transcricao_manual,
        idioma_alvo = 'Inglês',
        nivel_cefr = 'B1',
        foco_aprendizagem = 'Vocabulário, Expressões e Diálogo',
      } = req.body;

      if (typeof conteudo_ou_url === 'string' && conteudo_ou_url.length > 20_000) {
        return res.status(413).json({ error: 'Conteúdo excede o limite de 20.000 caracteres.' });
      }
      if (typeof transcricao_manual === 'string' && transcricao_manual.length > 50_000) {
        return res.status(413).json({ error: 'Transcrição excede o limite de 50.000 caracteres.' });
      }
      if (!conteudo_ou_url && !transcricao_manual) {
        return res.status(400).json({ error: 'Conteúdo, texto ou link do YouTube é obrigatório.' });
      }

      const client = getClient();

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

      const response = await generateWithFallback({
        client,
        params: {
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
        },
        route: 'materials',
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

  return router;
}

function extractYouTubeVideoId(url: string): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : undefined;
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
