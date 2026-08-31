import { describe, it, expect } from 'vitest';
import { DeterministicProgressEngine } from '../server/ai/deterministicProgress';
import { normalizeCEFRLevel, countWordsForLanguage, getLanguageConfig } from '../src/config/languages';
import { TutorPromptBuilder } from '../server/ai/tutorPrompt';
import { sanitizeTutorChatPayload } from '../server/ai/tutorContracts';

describe('Language Normalization & CEFR Mapping', () => {
  it('correctly maps CEFR levels with strict precedence', () => {
    expect(normalizeCEFRLevel('A1')).toBe('A1');
    expect(normalizeCEFRLevel('Iniciante (A1)')).toBe('A1');
    expect(normalizeCEFRLevel('Básico / Pré-Intermediário (A2)')).toBe('A2');
    expect(normalizeCEFRLevel('Intermediário (B1)')).toBe('B1');
    expect(normalizeCEFRLevel('Intermediário Superior (B2)')).toBe('B2');
    expect(normalizeCEFRLevel('Avançado (C1)')).toBe('C1');
    expect(normalizeCEFRLevel('Domínio Pleno (C2)')).toBe('C2');
  });

  it('normalizes languages correctly', () => {
    const fr = getLanguageConfig('francês');
    expect(fr.id).toBe('frances');
    expect(fr.bcp47).toBe('fr-FR');

    const en = getLanguageConfig('inglês');
    expect(en.id).toBe('ingles');
    expect(en.bcp47).toBe('en-US');
  });

  it('counts words appropriately for languages', () => {
    expect(countWordsForLanguage('Hello, how are you today?', 'Inglês')).toBe(5);
    expect(countWordsForLanguage('Bonjour tout le monde', 'Francês')).toBe(4);
    expect(countWordsForLanguage('', 'Inglês')).toBe(0);
  });
});

describe('DeterministicProgressEngine', () => {
  it('calculates deterministic XP for interactions', () => {
    const xp = DeterministicProgressEngine.calculateInteractionXp({
      messageLength: 50,
      wordCount: 10,
      hasTargetLanguageAttempt: true,
    });

    expect(xp).toBeGreaterThanOrEqual(20);
    expect(xp).toBeLessThanOrEqual(35);
  });

  it('updates mastery deterministically with bounded intervals', () => {
    const upgraded = DeterministicProgressEngine.updateMastery(70, 'correct_use', 0.9);
    expect(upgraded).toBeGreaterThan(70);
    expect(upgraded).toBeLessThanOrEqual(100);

    const downgraded = DeterministicProgressEngine.updateMastery(60, 'error', 0.9);
    expect(downgraded).toBeLessThan(60);
    expect(downgraded).toBeGreaterThanOrEqual(0);
  });
});

describe('TutorPromptBuilder', () => {
  it('builds comprehensive system instructions', () => {
    const payload = sanitizeTutorChatPayload({
      message: 'I wants to learn English',
      language: 'Inglês',
      cefrLevel: 'B1',
      conversationMode: 'conversation',
      topic: 'Daily Routine',
      relevantMemories: [{ skillId: 'node-vocab-1', type: 'vocabulario', text: 'schedule', language: 'Inglês' }],
      recentCorrections: [],
    });
    const systemInstruction = TutorPromptBuilder.buildSystemInstruction(payload);

    expect(systemInstruction).toContain('MODO CONVERSAÇÃO');
    expect(systemInstruction).toContain('Inglês');
    expect(systemInstruction).toContain('schedule');
  });
});
