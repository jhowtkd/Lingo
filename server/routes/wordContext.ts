import express from 'express';
import { Type } from '@google/genai';
import type { GoogleGenAI } from '@google/genai';
import { generateWithFallback } from '../ai/generateWithFallback';
import { GeminiResponseCache } from '../ai/geminiCache';

export function createWordContextRouter(
  getClient: () => GoogleGenAI | null,
  timeoutMs?: number
): express.Router {
  const router = express.Router();

  // LRU de contextos de palavra: consultas repetidas (muito comuns em app de
  // idioma) deixam de virar chamada Gemini nova a cada clique.
  const wordContextCache = new GeminiResponseCache<any>(500, 10 * 60_000);

  // NOVO: Caixa de Contexto de Palavra com Sinônimos, IPA, Tradução e Exemplos
  router.post('/', async (req, res) => {
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

      const client = getClient();

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

      const cacheKey = `${idioma}|${topico}|${cleanWord.toLowerCase()}|${(frase_contexto || '').slice(0, 200)}`;
      const parsed = await wordContextCache.run(cacheKey, async () => {
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
        },
        route: 'word-context',
        // Timeout por tentativa configurável (GEMINI_TIMEOUT_MS via appEnv).
        timeoutMs: timeoutMs ?? 60_000,
      });
        return JSON.parse(response.text || '{}');
      });
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

  return router;
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
