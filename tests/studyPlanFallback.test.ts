import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFallbackStudyPlan } from '../src/services/studyPlanFallback';
import { StorageService } from '../src/services/storage';
import { OnboardingAnswers } from '../src/types';

const cases = [
  ['Inglês', 'Hello'],
  ['Espanhol', 'Hola'],
  ['Francês', 'Bonjour'],
  ['Alemão', 'Hallo'],
  ['Italiano', 'Ciao'],
  ['Japonês', 'こんにちは'],
] as const;

afterEach(() => vi.unstubAllGlobals());

describe('local onboarding plan', () => {
  it.each(cases)('creates a coherent seven-day %s plan', (language, expectedTerm) => {
    const answers: OnboardingAnswers = {
      idioma_alvo: language,
      nivel_atual: 'A1',
      motivo_principal: 'Viagens',
      motivo_detalhado: 'pedir comida e transporte',
      interesses: ['Gastronomia & Culinária'],
      tempo_diario_minutos: 30,
      estilo_aprendizado: 'conversacao_voz',
    };

    const plan = createFallbackStudyPlan(
      answers,
      new Date('2026-08-30T12:00:00.000Z')
    );

    expect(plan.idioma).toBe(language);
    expect(plan.nivel_cefr).toBe('A1');
    expect(plan.meta_diaria_minutos).toBe(30);
    expect(plan.motivo_principal).toBe('Viagens');
    expect(plan.interesses_principais).toEqual(['Gastronomia & Culinária']);
    expect(plan.estilo_aprendizado).toBe('conversacao_voz');
    expect(JSON.stringify(plan)).toContain('pedir comida e transporte');
    expect(plan.cronograma_semanal).toHaveLength(7);
    expect(plan.nos_iniciais_grafo[0]?.titulo).toBe(expectedTerm);
    expect(plan.nos_iniciais_grafo.every((node) => node.idioma === language)).toBe(true);
    expect(plan.primeiro_material_estudo.idioma_alvo).toBe(language);
  });

  it('does not leak English fallback vocabulary into French', () => {
    const plan = createFallbackStudyPlan({
      idioma_alvo: 'Francês',
      nivel_atual: 'A1',
      motivo_principal: 'Viagens',
      interesses: ['Gastronomia & Culinária'],
      tempo_diario_minutos: 15,
      estilo_aprendizado: 'equilibrio_completo',
    });
    const serialized = JSON.stringify(plan);

    expect(serialized).not.toContain('Touch base');
    expect(serialized).not.toContain('Actually');
  });

  it('does not turn an initial zero-mastery term into sample progress', () => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    });
    StorageService.setCurrentUser(null);

    const plan = createFallbackStudyPlan({
      idioma_alvo: 'Francês',
      nivel_atual: 'A1',
      motivo_principal: 'Viagens',
      interesses: ['Gastronomia & Culinária'],
      tempo_diario_minutos: 15,
      estilo_aprendizado: 'equilibrio_completo',
    });

    StorageService.applyGeneratedPlan(plan);

    expect(StorageService.getNodes()[0]?.dominio_estimado).toBe(0);
  });
});
