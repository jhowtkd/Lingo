import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDailyGoals,
  buildMilestones,
  buildWeeklyTrend,
  ProgressMetricsInput,
} from '../src/services/progressMetrics';
import { GraphEngine } from '../src/services/graphEngine';
import { StorageService } from '../src/services/storage';

const cleanInput = (): ProgressMetricsInput => ({
  now: new Date('2026-08-30T12:00:00.000Z'),
  stats: {
    xp: 0,
    nivel: 1,
    sequencia_dias: 0,
    ultimo_dia_estudo: '2026-08-30',
    meta_diaria_minutos: 30,
    minutos_hoje: 0,
    conquistas_desbloqueadas: [],
    total_respostas: 0,
    respostas_corretas: 0,
    erros_corrigidos: 0,
    idioma_ativo: 'Inglês',
    nivel_cefr: 'A1',
    materiais_gerados: 0,
  },
  nodes: [],
  corrections: [],
  sessions: [],
});

describe('progress metrics', () => {
  it('returns only zero progress for a clean profile', () => {
    const input = cleanInput();

    expect(buildDailyGoals(input).every((goal) => goal.progresso_atual === 0)).toBe(true);
    expect(buildMilestones(input).every((item) => item.progresso_atual === 0)).toBe(true);
    expect(buildWeeklyTrend(input)).toHaveLength(7);
    expect(buildWeeklyTrend(input).every((point) =>
      point.minutos === 0 && point.vocabulario === 0 && point.taxaConsistencia === 0
    )).toBe(true);
  });

  it('uses only recorded sessions, nodes, corrections, and answers', () => {
    const input = cleanInput();
    input.stats = {
      ...input.stats,
      minutos_hoje: 20,
      total_respostas: 5,
      respostas_corretas: 4,
      sequencia_dias: 2,
    };
    input.sessions = [{
      id: 'session-1',
      titulo: 'Conversa real',
      topico: 'Viagens',
      inicio: '2026-08-30T10:00:00.000Z',
      fim: '2026-08-30T10:20:00.000Z',
      duracao_minutos: 20,
      respostas_totais: 5,
      respostas_corretas: 4,
      conceitos_trabalhados: ['bonjour'],
      erros_identificados: 1,
      xp_obtido: 80,
      concluida: true,
    }];
    input.nodes = [{
      id: 'node-1',
      tipo: 'vocabulario',
      titulo: 'bonjour',
      descricao: 'saudação',
      dominio_estimado: 85,
      dificuldade: 1,
      frequencia_erro: 0,
      ultima_revisao: '2026-08-30T10:00:00.000Z',
      proxima_revisao: '2026-09-02T10:00:00.000Z',
      evidencias: ['usado em conversa'],
      criado_em: '2026-08-30T10:00:00.000Z',
      atualizado_em: '2026-08-30T10:00:00.000Z',
      idioma: 'Francês',
    }];

    expect(buildDailyGoals(input).map((goal) => goal.progresso_atual)).toEqual([20, 80, 5]);
    expect(buildMilestones(input).map((item) => item.progresso_atual)).toEqual([2, 1, 0]);
    expect(buildWeeklyTrend(input).at(-1)).toMatchObject({
      minutos: 20,
      vocabulario: 1,
      taxaConsistencia: 67,
    });
  });
});

afterEach(() => vi.restoreAllMocks());

describe('GraphEngine dashboard integrity', () => {
  it('returns zero metrics and no priorities for clean storage', () => {
    vi.spyOn(StorageService, 'getNodes').mockReturnValue([]);
    vi.spyOn(StorageService, 'getRelations').mockReturnValue([]);
    vi.spyOn(StorageService, 'getSessions').mockReturnValue([]);
    vi.spyOn(StorageService, 'getCorrections').mockReturnValue([]);
    vi.spyOn(StorageService, 'getStats').mockReturnValue(cleanInput().stats);

    const metrics = GraphEngine.calculateWeeklyMetrics();

    expect(metrics).toMatchObject({
      sessoes_realizadas: 0,
      minutos_estudados: 0,
      total_respostas: 0,
      respostas_corretas: 0,
      taxa_acerto: 0,
      revisoes_pendentes: 0,
      topicos_dificeis: [],
      evolucao_dominio: [],
    });
    expect(metrics.comparativo_semana_anterior).toEqual({
      minutos_delta_pct: 0,
      taxa_acerto_delta_pct: 0,
      xp_delta_pct: 0,
    });
    expect(GraphEngine.getPriorityTopicsFromMemoryGraph(3)).toEqual([]);
  });
});
