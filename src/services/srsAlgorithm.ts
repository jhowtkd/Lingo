import type { SRSGrade } from '../types';

export interface SM2State {
  intervalo_dias: number;
  repeticoes: number;
  fator_facilidade: number;
  frequencia_erro: number;
}

export interface SM2Next {
  intervalo_dias: number;
  repeticoes: number;
  fator_facilidade: number;
  frequencia_erro: number;
  repetir_hoje: boolean;
  suspender: boolean;
}

export const SM2_DEFAULTS: SM2State = {
  intervalo_dias: 1,
  repeticoes: 0,
  fator_facilidade: 2.5,
  frequencia_erro: 0,
};

const MIN_EF = 1.3;
const MAX_INTERVALO_DIAS = 365;
const LEECH_ERROS = 5;
const LEECH_INTERVALO_DIAS = 30;

/**
 * SM-2 clássico: EF' = EF + (0.1 - (5-q) × (0.08 + (5-q) × 0.02)); intervalos
 * 1d → 6d → intervalo × EF; falha zera a sequência e repete no mesmo dia.
 * Mapeamento de nota: 1=Novamente(q1), 2=Difícil(q3), 3=Bom(q4), 4=Fácil(q5).
 * A "qualidade de resposta" é derivada da grade; os deltas de domínio/XP
 * continuam no flashcardsEngine.
 */
export function computeSM2Next(state: SM2State, grade: SRSGrade): SM2Next {
  const q = grade === 1 ? 1 : grade === 2 ? 3 : grade === 3 ? 4 : 5;
  let { intervalo_dias, repeticoes } = state;
  let fator_facilidade = Math.max(
    MIN_EF,
    state.fator_facilidade + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );
  let frequencia_erro = state.frequencia_erro;

  let repetir_hoje = false;
  if (q < 3) {
    repeticoes = 0;
    intervalo_dias = 0;
    repetir_hoje = true;
    frequencia_erro += 1;
  } else {
    repeticoes += 1;
    if (repeticoes === 1) intervalo_dias = 1;
    else if (repeticoes === 2) intervalo_dias = 6;
    else intervalo_dias = Math.min(MAX_INTERVALO_DIAS, Math.round(intervalo_dias * fator_facilidade));
    if (frequencia_erro > 0) frequencia_erro -= 1;
  }

  const suspender = frequencia_erro >= LEECH_ERROS;
  if (suspender) intervalo_dias = LEECH_INTERVALO_DIAS;

  return { intervalo_dias, repeticoes, fator_facilidade, frequencia_erro, repetir_hoje, suspender };
}
