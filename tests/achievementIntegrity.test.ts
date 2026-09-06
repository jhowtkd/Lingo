import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AchievementEngine } from '../src/services/achievementEngine';
import { GraphEngine } from '../src/services/graphEngine';
import { StorageService } from '../src/services/storage';
import { UserStats } from '../src/types';

const cleanStats = (overrides: Partial<UserStats> = {}): UserStats => ({
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
  idioma_ativo: 'Francês',
  nivel_cefr: 'A1',
  materiais_gerados: 0,
  ...overrides,
});

const mockStorage = (stats: UserStats) => {
  vi.spyOn(StorageService, 'getAchievements').mockReturnValue([]);
  vi.spyOn(StorageService, 'getNodes').mockReturnValue([]);
  vi.spyOn(StorageService, 'getRelations').mockReturnValue([]);
  vi.spyOn(StorageService, 'getCorrections').mockReturnValue([]);
  vi.spyOn(StorageService, 'getMaterials').mockReturnValue([]);
  vi.spyOn(StorageService, 'getStats').mockReturnValue(stats);
  vi.spyOn(StorageService, 'saveAchievements').mockImplementation(() => undefined);
  vi.spyOn(StorageService, 'addXP').mockReturnValue({
    stats,
    subiu_nivel: false,
    novo_nivel: 1,
  });
};

afterEach(() => vi.restoreAllMocks());

describe('AchievementEngine integrity', () => {
  it('does not unlock or award XP for a clean profile', () => {
    mockStorage(cleanStats());

    const result = AchievementEngine.evaluateAll();

    expect(result.newlyUnlocked).toEqual([]);
    expect(result.achievements.find((item) => item.id === 'primeira_conversa')).toMatchObject({
      desbloqueada: false,
      progresso_atual: 0,
    });
    expect(StorageService.addXP).not.toHaveBeenCalled();
  });

  it('unlocks the first conversation after one recorded response', () => {
    mockStorage(cleanStats({ total_respostas: 1, respostas_corretas: 1 }));

    const result = AchievementEngine.evaluateAll();

    expect(result.newlyUnlocked.map((item) => item.id)).toContain('primeira_conversa');
    expect(StorageService.addXP).toHaveBeenCalledTimes(1);
  });

  it('does not infer mastery when the graph has no evidence', () => {
    vi.spyOn(StorageService, 'getNodes').mockReturnValue([]);

    expect(
      GraphEngine.analyzeStudentComprehension('Viagens', 'Bonjour', 'Francês')
    ).toBeNull();
  });

  it('stores new tutor graph nodes as unscored when mastery is omitted', () => {
    vi.spyOn(StorageService, 'getNodes').mockReturnValue([]);
    vi.spyOn(StorageService, 'getRelations').mockReturnValue([]);
    const saveNodes = vi
      .spyOn(StorageService, 'saveNodes')
      .mockImplementation(() => undefined);

    GraphEngine.processNewNodesFromTutor([{ titulo: 'Viagens' }], 'Bonjour', 'Francês');

    expect(saveNodes).toHaveBeenCalledWith([
      expect.objectContaining({ dominio_estimado: 0 }),
    ]);
  });

  it('keeps topic proficiency unscored before recorded evidence', () => {
    const source = readFileSync(
      new URL('../src/components/TopicProficiencyBar.tsx', import.meta.url),
      'utf8'
    );

    expect(source).toContain('hasProficiencyEvidence');
    expect(source).toContain('Aguardando evidências');
  });

  it('does not persist the tutor API adaptation text', () => {
    const source = readFileSync(
      new URL('../src/components/ChatTutor.tsx', import.meta.url),
      'utf8'
    );

    expect(source).not.toContain('adaptacao: data.adaptacao');
  });

  it('publishes stats after recording every successful tutor answer', () => {
    const source = readFileSync(
      new URL('../src/components/ChatTutor.tsx', import.meta.url),
      'utf8'
    );
    const recordedAnswer = source.indexOf('StorageService.recordAnswer(!data.possui_erro,');
    const publishedStats = source.indexOf('onUpdateStats(StorageService.getStats());', recordedAnswer);

    expect(recordedAnswer).toBeGreaterThan(-1);
    expect(publishedStats).toBeGreaterThan(recordedAnswer);
  });
});
