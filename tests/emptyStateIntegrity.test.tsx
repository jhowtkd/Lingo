import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyTipCard } from '../src/components/DailyTipCard';
import { StorageService } from '../src/services/storage';
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

    expect(html).toContain('domínio de apenas 0%');
    expect(html).not.toContain('domínio de apenas 50%');
  });

  it('clears multi-conversation state during an explicit reset', () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { removeItem });
    StorageService.setCurrentUser(null);

    StorageService.resetAllData();

    expect(removeItem).toHaveBeenCalledWith('tutor_conversations_v2');
    expect(removeItem).toHaveBeenCalledWith('tutor_active_conv_id_v2');
  });
});
