// tests/srsAlgorithm.test.ts
import { describe, expect, it } from 'vitest';
import { computeSM2Next, SM2_DEFAULTS } from '../src/services/srsAlgorithm';

describe('computeSM2Next (SM-2)', () => {
  it('grade 3 (Bom) em card novo: intervalo 1d, EF inalterado (2.5)', () => {
    const next = computeSM2Next({ ...SM2_DEFAULTS }, 3);
    expect(next.repeticoes).toBe(1);
    expect(next.intervalo_dias).toBe(1);
    expect(next.fator_facilidade).toBeCloseTo(2.5);
    expect(next.repetir_hoje).toBe(false);
  });

  it('grade 4 (Fácil) em card novo: EF sobe para 2.6', () => {
    const next = computeSM2Next({ ...SM2_DEFAULTS }, 4);
    expect(next.repeticoes).toBe(1);
    expect(next.intervalo_dias).toBe(1);
    expect(next.fator_facilidade).toBeCloseTo(2.6);
  });

  it('grade 1 (Novamente): zera sequência, repete hoje, EF cai para 1.96', () => {
    const next = computeSM2Next({ ...SM2_DEFAULTS }, 1);
    expect(next.repeticoes).toBe(0);
    expect(next.intervalo_dias).toBe(0);
    expect(next.repetir_hoje).toBe(true);
    expect(next.fator_facilidade).toBeCloseTo(1.96);
    expect(next.frequencia_erro).toBe(1);
  });

  it('segunda revisão boa: intervalo salta para 6 dias', () => {
    const next = computeSM2Next({ intervalo_dias: 1, repeticoes: 1, fator_facilidade: 2.5, frequencia_erro: 0 }, 3);
    expect(next.intervalo_dias).toBe(6);
  });

  it('revisões seguintes: intervalo × EF arredondado', () => {
    const next = computeSM2Next({ intervalo_dias: 6, repeticoes: 2, fator_facilidade: 2.5, frequencia_erro: 0 }, 3);
    expect(next.intervalo_dias).toBe(15);
  });

  it('EF nunca fica abaixo de 1.3', () => {
    const next = computeSM2Next({ intervalo_dias: 6, repeticoes: 2, fator_facilidade: 1.3, frequencia_erro: 0 }, 1);
    expect(next.fator_facilidade).toBe(1.3);
  });

  it('suspende leech: 5º erro consecutivo em falha', () => {
    const next = computeSM2Next({ intervalo_dias: 6, repeticoes: 2, fator_facilidade: 2.5, frequencia_erro: 4 }, 1);
    expect(next.suspender).toBe(true);
    expect(next.intervalo_dias).toBe(30);
  });

  it('acerto reduz a frequência de erro e não suspende', () => {
    const next = computeSM2Next({ intervalo_dias: 6, repeticoes: 2, fator_facilidade: 2.5, frequencia_erro: 4 }, 3);
    expect(next.suspender).toBe(false);
    expect(next.frequencia_erro).toBe(3);
  });

  it('intervalo máximo é 365 dias', () => {
    const next = computeSM2Next({ intervalo_dias: 300, repeticoes: 10, fator_facilidade: 2.8, frequencia_erro: 0 }, 4);
    expect(next.intervalo_dias).toBeLessThanOrEqual(365);
  });
});
