import { CEFRLevel, SpeechRateMetrics, SpeechRatePacing } from '../types';

export interface CEFRRateTarget {
  level: CEFRLevel;
  nome: string;
  minWpm: number;
  maxWpm: number;
  idealWpm: number;
  descricao: string;
  ritmoEsperado: string;
}

export const CEFR_SPEECH_RATE_TARGETS: Record<CEFRLevel, CEFRRateTarget> = {
  A1: {
    level: 'A1',
    nome: 'Iniciante (A1)',
    minWpm: 70,
    maxWpm: 100,
    idealWpm: 85,
    descricao: 'Frases curtas, articulação deliberada e ênfase na clareza dos fonemas básicos.',
    ritmoEsperado: 'Ritmo pausado e consciente (70 a 100 PPM)',
  },
  A2: {
    level: 'A2',
    nome: 'Básico / Pré-Intermediário (A2)',
    minWpm: 85,
    maxWpm: 115,
    idealWpm: 100,
    descricao: 'Vocabulário do dia a dia, encadeamento simples com pausas breves para conexão.',
    ritmoEsperado: 'Ritmo moderado estruturado (85 a 115 PPM)',
  },
  B1: {
    level: 'B1',
    nome: 'Intermediário (B1)',
    minWpm: 110,
    maxWpm: 140,
    idealWpm: 125,
    descricao: 'Fluência conversacional natural, transições entre orações e ritmo dinâmico.',
    ritmoEsperado: 'Ritmo conversacional ágil (110 a 140 PPM)',
  },
  B2: {
    level: 'B2',
    nome: 'Intermediário Superior (B2)',
    minWpm: 130,
    maxWpm: 165,
    idealWpm: 145,
    descricao: 'Conectivos complexos, entonação natural de connected speech e ritmo espontâneo.',
    ritmoEsperado: 'Ritmo fluente e articulado (130 a 165 PPM)',
  },
  C1: {
    level: 'C1',
    nome: 'Avançado (C1)',
    minWpm: 145,
    maxWpm: 180,
    idealWpm: 162,
    descricao: 'Expressividade flexível, nuances idiomáticas e ritmo equivalente a falantes nativos.',
    ritmoEsperado: 'Ritmo nativo espontâneo (145 a 180 PPM)',
  },
  C2: {
    level: 'C2',
    nome: 'Domínio Pleno / Quase Nativo (C2)',
    minWpm: 160,
    maxWpm: 200,
    idealWpm: 180,
    descricao: 'Precisão prosódica, modulação de velocidade em ênfases e retórica refinada.',
    ritmoEsperado: 'Ritmo altamente dinâmico (160 a 200 PPM)',
  },
};

export class SpeechRateService {
  /**
   * Converte nível simplificado de estudante ('Iniciante', 'Intermediário', 'Avançado') para CEFRLevel
   */
  static mapStudentLevelToCEFR(studentLevel?: string): CEFRLevel {
    if (!studentLevel) return 'B1';
    const norm = studentLevel.toLowerCase();
    if (norm.includes('iniciante') || norm.includes('básico') || norm === 'a1') return 'A1';
    if (norm.includes('a2')) return 'A2';
    if (norm.includes('intermediário') || norm === 'b1') return 'B1';
    if (norm.includes('b2')) return 'B2';
    if (norm.includes('avançado') || norm === 'c1') return 'C1';
    if (norm === 'c2') return 'C2';
    return 'B1';
  }

  /**
   * Conta palavras limpas em um texto
   */
  static countWords(text: string): number {
    if (!text || !text.trim()) return 0;
    const cleanText = text.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»]/g, ' ');
    const tokens = cleanText.split(/\s+/).filter((t) => t.length > 0);
    return tokens.length;
  }

  /**
   * Calcula as métricas de taxa de fala (PPM / WPM) com base no texto, duração e nível CEFR
   */
  static calculateSpeechRate(
    text: string,
    durationSeconds: number,
    cefrLevel: CEFRLevel = 'B1',
    _language: string = 'Inglês'
  ): SpeechRateMetrics {
    const wordsCount = this.countWords(text);
    const safeDuration = Math.max(1, durationSeconds || 1);

    // WPM = (palavras / segundos) * 60
    const rawWpm = Math.round((wordsCount / safeDuration) * 60);
    // Limita para evitar valores anômalos por cliques curtos (< 2s)
    const wpm = Math.min(300, Math.max(15, rawWpm));

    const target = CEFR_SPEECH_RATE_TARGETS[cefrLevel] || CEFR_SPEECH_RATE_TARGETS.B1;
    const { minWpm, maxWpm, idealWpm } = target;

    // Determina classificação de ritmo (pacing)
    let pacing: SpeechRatePacing = 'ideal';
    if (wpm < minWpm - 20) {
      pacing = 'muito_lento';
    } else if (wpm < minWpm) {
      pacing = 'lento';
    } else if (wpm > maxWpm + 25) {
      pacing = 'muito_rapido';
    } else if (wpm > maxWpm) {
      pacing = 'rapido';
    } else {
      pacing = 'ideal';
    }

    // Percentual em relação ao ponto ideal (100% = ideal exato)
    const percentageOfTarget = Math.round((wpm / idealWpm) * 100);

    // Geração de feedback e dicas pedagógicas personalizadas
    const { feedbackText, pacingTip } = this.generatePedagogicalFeedback(
      wpm,
      pacing,
      target,
      wordsCount,
      safeDuration
    );

    return {
      wpm,
      wordsCount,
      durationSeconds: Math.round(safeDuration * 10) / 10,
      pacing,
      targetMinWpm: minWpm,
      targetMaxWpm: maxWpm,
      cefrLevel,
      feedbackText,
      pacingTip,
      percentageOfTarget,
    };
  }

  /**
   * Gera feedback pedagógico estruturado para o estudante
   */
  private static generatePedagogicalFeedback(
    wpm: number,
    pacing: SpeechRatePacing,
    target: CEFRRateTarget,
    wordsCount: number,
    duration: number
  ): { feedbackText: string; pacingTip: string } {
    const { minWpm, maxWpm, nome } = target;

    switch (pacing) {
      case 'muito_lento':
        return {
          feedbackText: `Taxa de ${wpm} PPM está bastante abaixo da faixa ideal de ${minWpm}-${maxWpm} PPM para o nível ${nome}.`,
          pacingTip:
            '💡 Dica de Ritmo: Reduza as pausas entre palavras agrupando termos em "Sense Groups" (pequenos blocos de 3-4 palavras conectadas).',
        };

      case 'lento':
        return {
          feedbackText: `Taxa de ${wpm} PPM está ligeiramente abaixo da faixa recomendada (${minWpm}-${maxWpm} PPM).`,
          pacingTip:
            '💡 Dica de Ritmo: Pratique a respiração ritmada no início da frase para ganhar continuidade e reduzir a tradução mental.',
        };

      case 'ideal':
        return {
          feedbackText: `Excelente! Sua taxa de ${wpm} PPM está na faixa ideal (${minWpm}-${maxWpm} PPM) para o nível ${nome}.`,
          pacingTip:
            '✨ Pacing Perfeito: Ritmo equilibrado, proporcionando clareza fonética e naturalidade sem hesitações excessivas.',
        };

      case 'rapido':
        return {
          feedbackText: `Taxa de ${wpm} PPM está ligeiramente acima da faixa ideal (${minWpm}-${maxWpm} PPM) para o nível ${nome}.`,
          pacingTip:
            '⚠️ Dica de Clareza: Falar um pouco mais devagar ajudará a articular vogais abertas e tônicas com maior precisão.',
        };

      case 'muito_rapido':
        return {
          feedbackText: `Taxa de ${wpm} PPM está muito acelerada para o nível ${nome} (ideal: ${minWpm}-${maxWpm} PPM).`,
          pacingTip:
            '🚨 Alerta de Ritmo: Diminua a velocidade para evitar "engolir" consoantes finais (ex: -ed, -s) e manter a entonação prosódica.',
        };
    }
  }

  /**
   * Retorna cores e rótulos para UI
   */
  static getPacingBadgeProps(pacing: SpeechRatePacing) {
    switch (pacing) {
      case 'muito_lento':
        return {
          label: 'Muito Lento',
          color: 'text-amber-700 dark:text-amber-300',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          dot: 'bg-amber-500',
          emoji: '🐢',
        };
      case 'lento':
        return {
          label: 'Lento',
          color: 'text-sky-700 dark:text-sky-300',
          bg: 'bg-sky-500/10',
          border: 'border-sky-500/30',
          dot: 'bg-sky-500',
          emoji: '⏳',
        };
      case 'ideal':
        return {
          label: 'Ritmo Ideal',
          color: 'text-emerald-700 dark:text-emerald-300',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          dot: 'bg-emerald-500',
          emoji: '🎯',
        };
      case 'rapido':
        return {
          label: 'Acelerado',
          color: 'text-amber-700 dark:text-amber-300',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          dot: 'bg-amber-500',
          emoji: '⚡',
        };
      case 'muito_rapido':
        return {
          label: 'Muito Rápido',
          color: 'text-rose-700 dark:text-rose-300',
          bg: 'bg-rose-500/10',
          border: 'border-rose-500/30',
          dot: 'bg-rose-500',
          emoji: '🚀',
        };
    }
  }
}
