import {
  DailyGoal,
  GraphNode,
  MilestoneItem,
  PedagogicalCorrection,
  StudySession,
  UserStats,
} from '../types';

export interface DailyTrendPoint {
  dia: string;
  data: string;
  minutos: number;
  vocabulario: number;
  taxaConsistencia: number;
}

export interface ProgressMetricsInput {
  stats: UserStats;
  nodes: GraphNode[];
  corrections: PedagogicalCorrection[];
  sessions: StudySession[];
  now?: Date;
}

export function buildDailyGoals({ stats }: ProgressMetricsInput): DailyGoal[] {
  const accuracy = stats.total_respostas > 0
    ? Math.round((stats.respostas_corretas / stats.total_respostas) * 100)
    : 0;

  return [
    {
      id: 'goal-time',
      titulo: 'Estudo diário',
      descricao: 'Tempo medido em atividades concluídas',
      categoria: 'tempo',
      progresso_atual: stats.minutos_hoje,
      meta_total: stats.meta_diaria_minutos,
      unidade: 'min',
      concluida: stats.minutos_hoje >= stats.meta_diaria_minutos,
      xp_recompensa: 50,
      icone: 'clock',
    },
    {
      id: 'goal-accuracy',
      titulo: 'Acurácia de conversação',
      descricao: 'Percentual calculado apenas sobre respostas registradas',
      categoria: 'precisao',
      progresso_atual: accuracy,
      meta_total: 80,
      unidade: '%',
      concluida: stats.total_respostas > 0 && accuracy >= 80,
      xp_recompensa: 75,
      icone: 'target',
    },
    {
      id: 'goal-conversation',
      titulo: 'Prática ativa',
      descricao: 'Trocas registradas com o tutor',
      categoria: 'conversacao',
      progresso_atual: stats.total_respostas,
      meta_total: 5,
      unidade: 'respostas',
      concluida: stats.total_respostas >= 5,
      xp_recompensa: 40,
      icone: 'message',
    },
  ];
}

export function buildMilestones({ stats, nodes, corrections }: ProgressMetricsInput): MilestoneItem[] {
  const masteredNodes = nodes.filter((node) => node.dominio_estimado >= 80).length;
  const consolidatedCorrections = corrections.filter(
    (correction) =>
      correction.estado_posterior === 'compreendido' &&
      correction.respondido_corretamente === true
  ).length;

  return [
    {
      id: 'milestone-streak',
      titulo: 'Guardião da Constância',
      descricao: 'Mantenha cinco dias consecutivos de prática ativa',
      nivel: 'Ouro',
      progresso_atual: stats.sequencia_dias,
      meta_total: 5,
      unidade: 'dias',
      concluida: stats.sequencia_dias >= 5,
      xp_recompensa: 200,
      categoria: 'streak',
    },
    {
      id: 'milestone-mastery',
      titulo: 'Mestre da Topologia SRS',
      descricao: 'Alcance 80% de domínio em seis nós do grafo',
      nivel: 'Prata',
      progresso_atual: masteredNodes,
      meta_total: 6,
      unidade: 'nós',
      concluida: masteredNodes >= 6,
      xp_recompensa: 150,
      categoria: 'mastery',
    },
    {
      id: 'milestone-corrections',
      titulo: 'Superador de Equívocos',
      descricao: 'Consolide três correções pedagógicas',
      nivel: 'Bronze',
      progresso_atual: consolidatedCorrections,
      meta_total: 3,
      unidade: 'erros',
      concluida: consolidatedCorrections >= 3,
      xp_recompensa: 100,
      categoria: 'accuracy',
    },
  ];
}

export function buildWeeklyTrend(input: ProgressMetricsInput): DailyTrendPoint[] {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const targetMinutes = Math.max(1, input.stats.meta_diaria_minutos);
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return Array.from({ length: 7 }, (_, index) => {
    const daysAgo = 6 - index;
    const targetDate = new Date(now);
    targetDate.setUTCDate(now.getUTCDate() - daysAgo);
    const date = targetDate.toISOString().slice(0, 10);
    const sessionMinutes = input.sessions
      .filter((session) => session.concluida && session.inicio.startsWith(date))
      .reduce((sum, session) => sum + Math.max(0, session.duracao_minutos), 0);
    const minutes = date === today
      ? Math.max(sessionMinutes, Math.max(0, input.stats.minutos_hoje))
      : sessionMinutes;
    const vocabulary = input.nodes.filter(
      (node) =>
        ['vocabulario', 'expressao_idiomatica', 'falso_amigo'].includes(node.tipo) &&
        node.criado_em.slice(0, 10) <= date
    ).length;

    return {
      dia: dayNames[targetDate.getUTCDay()],
      data: date,
      minutos: minutes,
      vocabulario: vocabulary,
      taxaConsistencia: Math.min(100, Math.round((minutes / targetMinutes) * 100)),
    };
  });
}
