import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyTipCard } from '../src/components/DailyTipCard';
import { StorageService } from '../src/services/storage';
import { UserStats } from '../src/types';

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

  it('clears multi-conversation state during an explicit reset', () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { removeItem });
    StorageService.setCurrentUser(null);

    StorageService.resetAllData();

    expect(removeItem).toHaveBeenCalledWith('tutor_conversations_v2');
    expect(removeItem).toHaveBeenCalledWith('tutor_active_conv_id_v2');
  });
});
