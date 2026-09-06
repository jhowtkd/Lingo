import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyTipCard } from '../src/components/DailyTipCard';
import { StorageService } from '../src/services/storage';
import { VocabDuelEngine } from '../src/services/vocabDuelEngine';
import { FlashcardsEngine } from '../src/services/flashcardsEngine';
import { GraphNode, UserStats } from '../src/types';

const stats: UserStats = {
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
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('honest empty learning states', () => {
  it('does not invent a graph gap for a clean profile', () => {
    vi.spyOn(StorageService, 'getNodes').mockReturnValue([]);
    vi.spyOn(StorageService, 'getMaterials').mockReturnValue([]);
    vi.spyOn(StorageService, 'getCorrections').mockReturnValue([]);

    const html = renderToStaticMarkup(
      <DailyTipCard
        stats={stats}
        currentTopic="Francês: Viagens"
        onNavigateToMaterials={() => undefined}
        onNavigateToChat={() => undefined}
      />
    );

    expect(html).toContain('Ainda não há uma lacuna detectada');
    expect(html).toContain('Começar conversa');
    expect(html).not.toContain('Actually');
    expect(html).not.toContain('45%');
  });

  it('keeps an unscored graph node at zero mastery', () => {
    const unscoredNode = {
      id: 'node-unscored',
      tipo: 'vocabulario',
      titulo: 'bonjour',
      descricao: 'saudação',
      dificuldade: 1,
      frequencia_erro: 0,
      ultima_revisao: '2026-08-30T00:00:00.000Z',
      proxima_revisao: '2026-09-02T00:00:00.000Z',
      evidencias: [],
      criado_em: '2026-08-30T00:00:00.000Z',
      atualizado_em: '2026-08-30T00:00:00.000Z',
      idioma: 'Francês',
    } as GraphNode;
    vi.spyOn(StorageService, 'getNodes').mockReturnValue([unscoredNode]);
    vi.spyOn(StorageService, 'getMaterials').mockReturnValue([]);
    vi.spyOn(StorageService, 'getCorrections').mockReturnValue([]);

    const html = renderToStaticMarkup(
      <DailyTipCard
        stats={stats}
        onNavigateToMaterials={() => undefined}
        onNavigateToChat={() => undefined}
      />
    );

    expect(html).toContain('0% domínio');
    expect(html).not.toContain('50% domínio');
  });

  it('clears multi-conversation state during an explicit reset', () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { removeItem });
    StorageService.setCurrentUser(null);

    StorageService.resetAllData();

    expect(removeItem).toHaveBeenCalledWith('tutor_conversations_v2');
    expect(removeItem).toHaveBeenCalledWith('tutor_active_conv_id_v2');
  });

  it('does not synthesize duel questions when the graph is empty', () => {
    vi.spyOn(StorageService, 'getNodes').mockReturnValue([]);

    expect(VocabDuelEngine.generateDuelQuestions('Francês', 8)).toEqual([]);
    expect(VocabDuelEngine.getEligibleNodes('Francês')).toEqual([]);

    const node: GraphNode = {
      id: 'node-one',
      tipo: 'vocabulario',
      titulo: 'Bonjour',
      descricao: 'Saudação em francês',
      dominio_estimado: 0,
      dificuldade: 1,
      frequencia_erro: 0,
      ultima_revisao: '2026-08-30T10:00:00.000Z',
      proxima_revisao: '2026-08-31T10:00:00.000Z',
      evidencias: [],
      criado_em: '2026-08-30T10:00:00.000Z',
      atualizado_em: '2026-08-30T10:00:00.000Z',
      idioma: 'Francês',
    };
    vi.spyOn(StorageService, 'getNodes').mockReturnValue([node, { ...node, id: 'node-duplicate' }]);

    expect(VocabDuelEngine.generateDuelQuestions('Francês', 8)).toHaveLength(1);
    expect(VocabDuelEngine.generateDistractors(node)).toEqual([]);
  });

  it('preserves zero mastery in cards and duel outcomes', () => {
    const node: GraphNode = {
      id: 'node-zero',
      tipo: 'vocabulario',
      titulo: 'Bonjour',
      descricao: 'Saudação em francês',
      dominio_estimado: 0,
      dificuldade: 1,
      frequencia_erro: 0,
      ultima_revisao: '2026-08-30T10:00:00.000Z',
      proxima_revisao: '2026-08-31T10:00:00.000Z',
      evidencias: ['Plano local'],
      criado_em: '2026-08-30T10:00:00.000Z',
      atualizado_em: '2026-08-30T10:00:00.000Z',
      idioma: 'Francês',
    };
    vi.spyOn(StorageService, 'getNodes').mockReturnValue([node]);
    vi.spyOn(StorageService, 'saveNodes').mockImplementation(() => undefined);

    expect(FlashcardsEngine.convertNodeToFlashcard(node).dominio_atual).toBe(0);

    VocabDuelEngine.updateNodeWithDuelResult(node.id, true, false);
    expect(node.dominio_estimado).toBe(8);

    node.dominio_estimado = 0;
    VocabDuelEngine.updateNodeWithDuelResult(node.id, false, false);
    expect(node.dominio_estimado).toBe(0);
  });
});
