import { Type } from '@google/genai';
import { ModelRouter } from './modelRouter';
import {
  SanitizedTutorPayload,
  PedagogicalEventCandidate,
  PedagogicalAnalysisResult,
} from './tutorContracts';
import { DeterministicProgressEngine } from './deterministicProgress';
import { getLanguageConfig, countWordsForLanguage } from '../../src/config/languages';

export class PedagogicalAnalyzer {
  /**
   * Analisa a produção linguística do estudante em segundo plano (Estágio B)
   * Produz apenas candidatos a eventos pedagógicos; XP e domínio são calculados deterministicamente.
   */
  static async analyzeTurn(
    payload: SanitizedTutorPayload,
    tutorResponseText: string,
    signal?: AbortSignal
  ): Promise<PedagogicalAnalysisResult> {
    const langConfig = getLanguageConfig(payload.language);
    const wordsCount = countWordsForLanguage(payload.message, payload.language);

    // Prompt estrito de classificação de eventos para o modelo Lite
    const analysisPrompt = `Você é um Analisador Pedagógico especializado em linguística aplicada.
Analise a mensagem do estudante de ${langConfig.displayName} (${payload.cefrLevel}).

MENSAGEM DO ALUNO:
"${payload.message}"

RESPOSTA DO TUTOR:
"${tutorResponseText}"

TÓPICO ATUAL:
"${payload.topic}"

REGRAS ESTREITAS DE ANÁLISE:
1. "Actually, I live in Brazil." é 100% CORRETO. Não classifique "Actually" como erro de falso amigo se usado no sentido de 'na verdade / realmente'.
2. "I intend to travel" é 100% CORRETO. Não confunda com pretend.
3. "I pretend to be a doctor" é 100% CORRETO se estiver em contexto de roleplay/simulação.
4. "I have 20 years" é um erro gramatical ("I am 20 years old").
5. "Yesterday I go to the gym" é um erro gramatical ("Yesterday I went to the gym").
6. "Can you borrow me your book" é um erro ("Can you lend me your book / Can I borrow your book").
7. Extraia eventos com base em evidências concretas. Se a frase estiver correta, registre um evento 'correct_use'.`;

    try {
      const result = await ModelRouter.generateContent(
        {
          contents: analysisPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                has_error: {
                  type: Type.BOOLEAN,
                  description: 'Verdadeiro apenas se houver desvio gramatical ou lexical real.',
                },
                events: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      skillId: {
                        type: Type.STRING,
                        description: 'Identificador do conceito (ex: past_simple, age_expression, false_friend_actually)',
                      },
                      type: {
                        type: Type.STRING,
                        enum: [
                          'correct_use',
                          'grammar_error',
                          'vocabulary_error',
                          'false_friend',
                          'pronunciation_issue',
                          'fluency_signal',
                          'needs_review',
                        ],
                      },
                      evidence: { type: Type.STRING },
                      correctedForm: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      confidence: { type: Type.NUMBER },
                      severity: {
                        type: Type.STRING,
                        enum: ['low', 'medium', 'high'],
                      },
                    },
                    required: ['skillId', 'type', 'evidence', 'confidence', 'severity'],
                  },
                },
                adaptationNotice: { type: Type.STRING },
              },
              required: ['has_error', 'events'],
            },
          },
        },
        {
          preferredModel: 'gemini-3.1-flash-lite',
          fallbackModels: ['gemini-3.7-flash'],
          perAttemptTimeoutMs: 8000,
          deadlineMs: 12000,
          signal,
        }
      );

      const parsed = JSON.parse(result.data.text || '{}');
      const hasError = Boolean(parsed.has_error);
      const rawEvents: any[] = Array.isArray(parsed.events) ? parsed.events : [];

      const cleanEvents: PedagogicalEventCandidate[] = rawEvents
        .filter((e) => e && e.skillId && e.type)
        .map((e) => ({
          skillId: String(e.skillId).toLowerCase().replace(/\s+/g, '_'),
          type: e.type,
          evidence: String(e.evidence || payload.message).slice(0, 200),
          correctedForm: e.correctedForm ? String(e.correctedForm).slice(0, 200) : undefined,
          explanation: e.explanation ? String(e.explanation).slice(0, 300) : undefined,
          confidence: Math.max(0.1, Math.min(1.0, Number(e.confidence) || 0.85)),
          severity: e.severity === 'high' || e.severity === 'low' ? e.severity : 'medium',
          language: langConfig.id,
        }));

      // Calcula XP determinístico
      const xpEarned = DeterministicProgressEngine.calculateInteractionXp({
        messageLength: payload.message.length,
        wordCount: wordsCount,
        hasTargetLanguageAttempt: true,
        hasGrammarError: hasError,
        isCorrectionRetry: payload.recentCorrections.length > 0,
        correctionSucceeded: !hasError && payload.recentCorrections.length > 0,
      });

      return {
        hasError,
        events: cleanEvents,
        xpEarned,
        adaptationNotice: parsed.adaptationNotice,
      };
    } catch (err: any) {
      console.warn('[PedagogicalAnalyzer] Análise em segundo plano falhou ou foi abortada:', err?.message || err);

      // Fallback determinístico seguro: nunca trava o chat e nunca inventa dados fictícios
      const xpEarned = DeterministicProgressEngine.calculateInteractionXp({
        messageLength: payload.message.length,
        wordCount: wordsCount,
        hasTargetLanguageAttempt: true,
      });

      return {
        hasError: false,
        events: [],
        xpEarned,
      };
    }
  }
}
