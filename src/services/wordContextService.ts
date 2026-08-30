import { WordContextInfo } from '../types';

/**
 * Serviço de Busca e Cache de Contexto de Palavras & Dicionário Ativo
 */
class WordContextService {
  private cache: Map<string, WordContextInfo> = new Map();

  private getCacheKey(word: string, lang: string): string {
    return `${lang.toLowerCase()}:${word.toLowerCase().trim()}`;
  }

  async getWordContext(
    word: string,
    contextSentence: string,
    language = 'Inglês',
    topic = 'Conversação'
  ): Promise<WordContextInfo> {
    const cleanWord = word.replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$/g, '').trim();
    if (!cleanWord) {
      throw new Error('Palavra vazia');
    }

    const cacheKey = this.getCacheKey(cleanWord, language);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const res = await fetch('/api/word-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          palavra: cleanWord,
          frase_contexto: contextSentence,
          idioma: language,
          topico: topic,
        }),
      });

      if (!res.ok) {
        throw new Error(`Erro na API de contexto: ${res.status}`);
      }

      const data = await res.json();
      const context: WordContextInfo = data.contexto;

      if (context && context.palavra) {
        this.cache.set(cacheKey, context);
        return context;
      }

      throw new Error('Resposta de contexto vazia');
    } catch (err) {
      console.warn('Erro ao consultar contexto de palavra no servidor, gerando fallback:', err);
      const fallback: WordContextInfo = {
        palavra: cleanWord,
        lemma_raiz: cleanWord.toLowerCase(),
        classe_gramatical: 'Vocabulário Ativo',
        idioma: language,
        nivel_cefr: 'B1',
        pronuncia_ipa: `/${cleanWord.toLowerCase()}/`,
        traducao_principal: `Tradução de "${cleanWord}"`,
        definicao_contextual: `Palavra em uso na sentença: "${contextSentence}".`,
        sinonimos: ['termo similar', 'expressão relacionada'],
        antonimos: [],
        exemplos_uso: [
          {
            frase_original: contextSentence || `How to use ${cleanWord} in daily context.`,
            traducao_portugues: `Como usar ${cleanWord} no contexto diário.`,
          },
        ],
        dica_uso_ou_collocation: `Preste atenção à pronúncia e à colocação de "${cleanWord}".`,
      };
      this.cache.set(cacheKey, fallback);
      return fallback;
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

export const wordContextService = new WordContextService();
