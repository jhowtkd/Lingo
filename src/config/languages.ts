import { CEFRLevel } from '../types';

export interface LanguageConfig {
  id: string;
  displayName: string;
  bcp47: string;
  ttsLocale: string;
  voiceCode: string;
  aliases: string[];
  usesWhitespaceSegmentation: boolean;
  defaultTopic: string;
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  ingles: {
    id: 'ingles',
    displayName: 'Inglês',
    bcp47: 'en-US',
    ttsLocale: 'en-US',
    voiceCode: 'en-US',
    aliases: ['ingles', 'inglês', 'english', 'en', 'en-us', 'en-gb'],
    usesWhitespaceSegmentation: true,
    defaultTopic: 'Conversação Geral & Apresentação',
  },
  espanhol: {
    id: 'espanhol',
    displayName: 'Espanhol',
    bcp47: 'es-ES',
    ttsLocale: 'es-ES',
    voiceCode: 'es-ES',
    aliases: ['espanhol', 'spanish', 'español', 'es', 'es-es', 'es-la'],
    usesWhitespaceSegmentation: true,
    defaultTopic: 'Conversación Cotidiana & Presentación',
  },
  frances: {
    id: 'frances',
    displayName: 'Francês',
    bcp47: 'fr-FR',
    ttsLocale: 'fr-FR',
    voiceCode: 'fr-FR',
    aliases: ['frances', 'francês', 'french', 'français', 'fr', 'fr-fr'],
    usesWhitespaceSegmentation: true,
    defaultTopic: 'Conversation et Présentation Personnelle',
  },
  alemao: {
    id: 'alemao',
    displayName: 'Alemão',
    bcp47: 'de-DE',
    ttsLocale: 'de-DE',
    voiceCode: 'de-DE',
    aliases: ['alemao', 'alemão', 'german', 'deutsch', 'de', 'de-de'],
    usesWhitespaceSegmentation: true,
    defaultTopic: 'Alltägliche Konversation & Vorstellung',
  },
  italiano: {
    id: 'italiano',
    displayName: 'Italiano',
    bcp47: 'it-IT',
    ttsLocale: 'it-IT',
    voiceCode: 'it-IT',
    aliases: ['italiano', 'italian', 'it', 'it-it'],
    usesWhitespaceSegmentation: true,
    defaultTopic: 'Conversazione Quotidiana & Presentazione',
  },
  japones: {
    id: 'japones',
    displayName: 'Japonês',
    bcp47: 'ja-JP',
    ttsLocale: 'ja-JP',
    voiceCode: 'ja-JP',
    aliases: ['japones', 'japonês', 'japanese', 'nihongo', 'ja', 'ja-jp'],
    usesWhitespaceSegmentation: false,
    defaultTopic: '日常会話と自己紹介 (Conversação Diária)',
  },
};

/**
 * Normaliza e identifica a configuração canônica de idioma
 */
export function getLanguageConfig(langInput?: string): LanguageConfig {
  if (!langInput) return SUPPORTED_LANGUAGES.ingles;

  const clean = langInput
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}-]/gu, '');

  for (const config of Object.values(SUPPORTED_LANGUAGES)) {
    if (config.id === clean || config.aliases.some((a) => a.toLowerCase() === clean)) {
      return config;
    }
  }

  // Busca parcial segura
  for (const config of Object.values(SUPPORTED_LANGUAGES)) {
    if (config.aliases.some((a) => clean.includes(a.toLowerCase()) || a.toLowerCase().includes(clean))) {
      return config;
    }
  }

  return SUPPORTED_LANGUAGES.ingles;
}

/**
 * Normaliza e mapeia qualquer descrição de nível para CEFRLevel canônico.
 * Ordem estrita de precedência: C2 -> C1 -> B2 -> B1 -> A2 -> A1
 * Isso garante que "Intermediário Superior B2" seja detectado como B2 (e não B1).
 */
export function normalizeCEFRLevel(levelInput?: string): CEFRLevel {
  if (!levelInput) return 'B1';

  const clean = levelInput.normalize('NFKC').toUpperCase().trim();

  // 1. Verificações explícitas de código CEFR têm prioridade absoluta
  if (/\bC2\b/.test(clean)) return 'C2';
  if (/\bC1\b/.test(clean)) return 'C1';
  if (/\bB2\b/.test(clean)) return 'B2';
  if (/\bB1\b/.test(clean)) return 'B1';
  if (/\bA2\b/.test(clean)) return 'A2';
  if (/\bA1\b/.test(clean)) return 'A1';

  // 2. Verificações por termos compostos em ordem decrescente
  if (clean.includes('DOMÍNIO PLENO') || clean.includes('DOMINIO PLENO') || clean.includes('QUASE NATIVO') || clean.includes('NATIVE') || clean.includes('PROFICIENT')) {
    return 'C2';
  }
  if (clean.includes('AVANÇADO SUPERIOR') || clean.includes('AVANCADO SUPERIOR') || clean.includes('AVANÇADO') || clean.includes('AVANCADO') || clean.includes('ADVANCED')) {
    return 'C1';
  }
  if (clean.includes('INTERMEDIÁRIO SUPERIOR') || clean.includes('INTERMEDIARIO SUPERIOR') || clean.includes('UPPER INTERMEDIATE')) {
    return 'B2';
  }
  if (clean.includes('PRÉ-INTERMEDIÁRIO') || clean.includes('PRE-INTERMEDIARIO') || clean.includes('ELEMENTAR') || clean.includes('ELEMENTARY')) {
    return 'A2';
  }
  if (clean.includes('INTERMEDIÁRIO') || clean.includes('INTERMEDIARIO') || clean.includes('INTERMEDIATE')) {
    return 'B1';
  }
  if (clean.includes('INICIANTE') || clean.includes('BÁSICO') || clean.includes('BASICO') || clean.includes('BEGINNER')) {
    return 'A1';
  }

  return 'B1';
}

/**
 * Normaliza texto preservando caracteres Unicode de alfabetos não-latinos (Japonês, Kanji, etc)
 */
export function normalizeUnicodeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Conta palavras ou unidades lexicais adequadamente para o idioma (suportando Japonês via Intl.Segmenter)
 */
export function countWordsForLanguage(text: string, languageId?: string): number {
  if (!text || !text.trim()) return 0;

  const lang = getLanguageConfig(languageId);

  if (!lang.usesWhitespaceSegmentation) {
    // Para idiomas sem separação por espaços (ex: Japonês)
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      try {
        const segmenter = new (Intl as any).Segmenter(lang.bcp47, { granularity: 'word' });
        const segments = Array.from(segmenter.segment(text)) as Array<{ segment: string; isWordLike: boolean }>;
        const wordLike = segments.filter((s) => s.isWordLike && s.segment.trim().length > 0);
        return Math.max(1, wordLike.length);
      } catch {
        // Fallback para contagem de caracteres japoneses com peso proporcional
        const cleanChars = text.replace(/\s+/g, '');
        return Math.max(1, Math.round(cleanChars.length / 2));
      }
    }
    const cleanChars = text.replace(/\s+/g, '');
    return Math.max(1, Math.round(cleanChars.length / 2));
  }

  // Idiomas ocidentais / com separação por espaço
  const clean = text
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»[\]]/g, ' ')
    .trim();
  const tokens = clean.split(/\s+/).filter((t) => t.length > 0);
  return tokens.length;
}
