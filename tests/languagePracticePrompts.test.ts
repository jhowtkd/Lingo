import { describe, expect, it } from 'vitest';
import { getLanguageConfig } from '../src/config/languages';
import { getLanguageTheme } from '../src/services/languageThemes';
import {
  buildListenOnlyPrompts,
  buildQuickPrompts,
} from '../src/services/languagePracticePrompts';

describe('language practice prompts', () => {
  it('builds French prompts for a French plan', () => {
    const prompts = buildQuickPrompts(
      'Francês',
      'Francês: Gastronomia e viagens',
      { motivo_principal: 'Viagens' }
    );

    expect(prompts).toHaveLength(4);
    expect(prompts.join(' ')).toContain('français');
    expect(getLanguageConfig('Francês').ttsLocale).toBe('fr-FR');
  });

  it('names the active language in listen-only prompts', () => {
    const prompts = buildListenOnlyPrompts('Japonês', 'Restaurantes');

    expect(prompts).toHaveLength(2);
    expect(prompts.every((item) => item.prompt.includes('Japonês'))).toBe(true);
    expect(getLanguageConfig('Japonês').ttsLocale).toBe('ja-JP');
  });

  it('keeps Spanish prompts in the Spanish path', () => {
    expect(buildQuickPrompts('Espanhol', 'Viagens')[0]).toContain('¡Hola!');
    expect(getLanguageConfig('Espanhol').ttsLocale).toBe('es-ES');
  });

  it('derives theme voice locales from the language registry', () => {
    for (const language of ['Inglês', 'Espanhol', 'Francês', 'Alemão', 'Italiano', 'Japonês']) {
      expect(getLanguageTheme(language).codigo_voz).toBe(getLanguageConfig(language).ttsLocale);
    }
  });
});
