import { LanguageThemeConfig, LanguageThemeId } from '../types';
import { getLanguageConfig } from '../config/languages';

export type { LanguageThemeConfig, LanguageThemeId };

export const LANGUAGE_THEMES: Record<LanguageThemeId, LanguageThemeConfig> = {

  ingles: {
    id: 'ingles',
    nome: 'Inglês',
    bandeira: '🇺🇸 / 🇬🇧',
    codigo_voz: getLanguageConfig('ingles').ttsLocale,
    slogan: 'Connected speech, phrasal verbs & fluência global',
    cor_primaria: 'blue',
    badge_class: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    bg_gradient: 'from-blue-500/5 via-sky-500/5 to-transparent',
    card_accent: 'border-blue-500/20 shadow-blue-500/5',
    border_accent: 'border-blue-500/40',
    button_class: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20',
    ring_class: 'focus:ring-blue-500/40',
    texto_destaque: 'text-blue-600 dark:text-blue-400',
  },
  espanhol: {
    id: 'espanhol',
    nome: 'Espanhol',
    bandeira: '🇪🇸 / 🇲🇽',
    codigo_voz: getLanguageConfig('espanhol').ttsLocale,
    slogan: 'Ritmo hispânico, falsos cognatos & entonação viva',
    cor_primaria: 'rose',
    badge_class: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
    bg_gradient: 'from-rose-500/5 via-amber-500/5 to-transparent',
    card_accent: 'border-rose-500/20 shadow-rose-500/5',
    border_accent: 'border-rose-500/40',
    button_class: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20',
    ring_class: 'focus:ring-rose-500/40',
    texto_destaque: 'text-rose-600 dark:text-rose-400',
  },
  frances: {
    id: 'frances',
    nome: 'Francês',
    bandeira: '🇫🇷',
    codigo_voz: getLanguageConfig('frances').ttsLocale,
    slogan: 'Liaisons, vogais nasais & elegância parisiense',
    cor_primaria: 'purple',
    badge_class: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
    bg_gradient: 'from-purple-500/5 via-indigo-500/5 to-transparent',
    card_accent: 'border-purple-500/20 shadow-purple-500/5',
    border_accent: 'border-purple-500/40',
    button_class: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20',
    ring_class: 'focus:ring-purple-500/40',
    texto_destaque: 'text-purple-600 dark:text-purple-400',
  },
  alemao: {
    id: 'alemao',
    nome: 'Alemão',
    bandeira: '🇩🇪',
    codigo_voz: getLanguageConfig('alemao').ttsLocale,
    slogan: 'Declinações, palavras compostas & precisão analítica',
    cor_primaria: 'amber',
    badge_class: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    bg_gradient: 'from-amber-500/5 via-yellow-500/5 to-transparent',
    card_accent: 'border-amber-500/20 shadow-amber-500/5',
    border_accent: 'border-amber-500/40',
    button_class: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
    ring_class: 'focus:ring-amber-500/40',
    texto_destaque: 'text-amber-600 dark:text-amber-400',
  },
  italiano: {
    id: 'italiano',
    nome: 'Italiano',
    bandeira: '🇮🇹',
    codigo_voz: getLanguageConfig('italiano').ttsLocale,
    slogan: 'Consoantes duplas, melodia e gestualidade vocal',
    cor_primaria: 'emerald',
    badge_class: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    bg_gradient: 'from-emerald-500/5 via-teal-500/5 to-transparent',
    card_accent: 'border-emerald-500/20 shadow-emerald-500/5',
    border_accent: 'border-emerald-500/40',
    button_class: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
    ring_class: 'focus:ring-emerald-500/40',
    texto_destaque: 'text-emerald-600 dark:text-emerald-400',
  },
  japones: {
    id: 'japones',
    nome: 'Japonês',
    bandeira: '🇯🇵',
    codigo_voz: getLanguageConfig('japones').ttsLocale,
    slogan: 'Hiragana, Kanji, partículas & respeito contextual',
    cor_primaria: 'red',
    badge_class: 'bg-red-500/10 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
    bg_gradient: 'from-red-500/5 via-rose-500/5 to-transparent',
    card_accent: 'border-red-500/20 shadow-red-500/5',
    border_accent: 'border-red-500/40',
    button_class: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20',
    ring_class: 'focus:ring-red-500/40',
    texto_destaque: 'text-red-600 dark:text-red-400',
  },
};

/**
 * Detecta o ID do tema com base no texto do tópico ou idioma selecionado
 */
export function detectLanguageTheme(topicOrLang: string): LanguageThemeId {
  const norm = (topicOrLang || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (norm.includes('espanhol') || norm.includes('spanish') || norm.includes('castellano')) {
    return 'espanhol';
  }
  if (norm.includes('frances') || norm.includes('french') || norm.includes('francais')) {
    return 'frances';
  }
  if (norm.includes('alemao') || norm.includes('german') || norm.includes('deutsch')) {
    return 'alemao';
  }
  if (norm.includes('italiano') || norm.includes('italian')) {
    return 'italiano';
  }
  if (norm.includes('japones') || norm.includes('japanese') || norm.includes('nihongo')) {
    return 'japones';
  }

  // Padrão: Inglês
  return 'ingles';
}

export function getLanguageTheme(topicOrLang: string): LanguageThemeConfig {
  const id = detectLanguageTheme(topicOrLang);
  return LANGUAGE_THEMES[id];
}
