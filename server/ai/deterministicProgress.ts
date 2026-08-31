export interface XpCalculationInput {
  messageLength: number;
  wordCount: number;
  hasTargetLanguageAttempt: boolean;
  isCorrectionRetry?: boolean;
  correctionSucceeded?: boolean;
  hasGrammarError?: boolean;
}

export class DeterministicProgressEngine {
  /**
   * Calcula o XP de forma determinística e testável sem alucinação de LLM
   */
  static calculateInteractionXp(input: XpCalculationInput): number {
    if (input.messageLength === 0 || input.wordCount === 0) {
      return 0;
    }

    let xp = 10; // Base por participação ativa

    if (input.hasTargetLanguageAttempt) {
      xp += 5;
    }

    if (input.wordCount >= 5) {
      xp += 5; // Bônus por formulação completa
    }

    if (input.isCorrectionRetry) {
      if (input.correctionSucceeded) {
        xp += 10; // Bônus por aplicar correção com sucesso
      } else {
        xp += 3; // Reconhecimento pelo esforço de tentativa
      }
    }

    // Limite máximo de segurança por turno individual
    return Math.min(35, Math.max(5, xp));
  }

  /**
   * Atualiza o domínio de um conceito no Grafo com base em evidências acumuladas
   */
  static updateMastery(
    currentMastery: number,
    eventType: 'correct_use' | 'error' | 'retry_success',
    confidence: number = 0.9
  ): number {
    const safeConfidence = Math.max(0.1, Math.min(1.0, confidence));
    const safeCurrent = Math.max(0, Math.min(100, currentMastery || 30));

    let delta = 0;
    if (eventType === 'correct_use') {
      // Avanço conservador: 2 a 5 pontos por evidência positiva
      delta = Math.round(4 * safeConfidence);
    } else if (eventType === 'retry_success') {
      // Recuperação bem-sucedida após erro
      delta = Math.round(6 * safeConfidence);
    } else if (eventType === 'error') {
      // Queda moderada: 4 a 7 pontos
      delta = -Math.round(5 * safeConfidence);
    }

    const newMastery = safeCurrent + delta;
    return Math.max(5, Math.min(100, newMastery));
  }
}
