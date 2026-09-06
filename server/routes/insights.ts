import express from 'express';
import { Type } from '@google/genai';
import type { GoogleGenAI } from '@google/genai';
import { generateWithFallback } from '../ai/generateWithFallback';

/**
 * Rotas de insights pedagógicos (calendar/suggest, recommendation,
 * dashboard/priority-topics). Montada em `/api` — os subpaths completos de
 * cada endpoint vivem aqui dentro da fábrica (um único router com três POSTs).
 */
export function createInsightsRouter(
  getClient: () => GoogleGenAI | null,
  timeoutMs?: number
): express.Router {
  const router = express.Router();

  // Sugestões de Planejamento no Calendário
  router.post('/calendar/suggest', async (req, res) => {
    try {
      const {
        dias_disponiveis = 7,
        duracao_sessao_min = 45,
        horario_preferido = '19:00',
        topicos_dificeis = [],
        revisoes_pendentes = [],
      } = req.body;

      const client = getClient();

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

      const response = await generateWithFallback({
        client,
        params: {
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
        },
        route: 'calendar',
        // Timeout por tentativa configurável (GEMINI_TIMEOUT_MS via appEnv).
        timeoutMs: timeoutMs ?? 60_000,
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
  router.post('/recommendation', async (req, res) => {
    try {
      const { metricas, grafo_resumo } = req.body;
      const client = getClient();

      if (!client) {
        return res.json({
          recomendacao:
            'Foque 20 minutos diários na revisão de conceitos com domínio inferior a 60% e pratique mais questões de aplicação direta.',
        });
      }

      const response = await generateWithFallback({
        client,
        params: {
          model: 'gemini-3.7-flash',
          contents: `
Analise estas métricas de estudo dos últimos 7 dias:
${JSON.stringify(metricas)}
Resumo do grafo de conhecimento:
${JSON.stringify(grafo_resumo)}

Gere uma recomendação pedagógica objetiva, motivadora e acionável em 2 a 3 frases em Português para a próxima semana.`,
        },
        route: 'recommendation',
        // Timeout por tentativa configurável (GEMINI_TIMEOUT_MS via appEnv).
        timeoutMs: timeoutMs ?? 60_000,
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
  router.post('/dashboard/priority-topics', async (req, res) => {
    try {
      const { nos_grafo = [], correcoes = [], metricas = {} } = req.body;
      const client = getClient();

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

      const response = await generateWithFallback({
        client,
        params: {
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
        },
        route: 'priority-topics',
        // Timeout por tentativa configurável (GEMINI_TIMEOUT_MS via appEnv).
        timeoutMs: timeoutMs ?? 60_000,
      });

      const prioridades = JSON.parse(response.text || '[]');
      return res.json({ prioridades: Array.isArray(prioridades) ? prioridades.slice(0, 3) : [] });
    } catch (err: any) {
      console.warn('Erro ao gerar tópicos prioritários com Gemini:', err?.message || err);
      return res.json({ prioridades: [] });
    }
  });

  return router;
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
