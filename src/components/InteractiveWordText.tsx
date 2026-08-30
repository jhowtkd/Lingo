import React from 'react';
import { playSfx } from '../services/soundEffects';

interface InteractiveWordTextProps {
  text: string;
  onWordClick: (word: string, fullSentence: string) => void;
  className?: string;
  enableWordClick?: boolean;
}

export const InteractiveWordText: React.FC<InteractiveWordTextProps> = ({
  text,
  onWordClick,
  className = '',
  enableWordClick = true,
}) => {
  if (!text) return null;

  // Se desativado, retorna o texto simples
  if (!enableWordClick) {
    return <span className={className}>{text}</span>;
  }

  // Divide o texto em parágrafos / linhas para preservar estrutura
  const lines = text.split('\n');

  // Encontra a frase completa que contém o token para fornecer contexto
  const getContainingSentence = (fullText: string, word: string, lineText: string): string => {
    // Tenta encontrar por pontuações comuns de término de frase (. ? !)
    const sentences = lineText.split(/(?<=[.?!])\s+/);
    const matchedSentence = sentences.find((s) => s.includes(word));
    return (matchedSentence || lineText || fullText).trim();
  };

  const handleWordClick = (
    e: React.MouseEvent,
    wordToken: string,
    lineText: string
  ) => {
    e.stopPropagation();
    const cleanWord = wordToken.replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$/g, '').trim();
    if (!cleanWord || cleanWord.length < 1) return;

    playSfx('word_tap');
    const sentence = getContainingSentence(text, cleanWord, lineText);
    onWordClick(cleanWord, sentence);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} className="h-2" />;
        }

        // Divide a linha em tokens mantendo espaços e pontuações
        const tokens = line.split(/(\s+|[.,!?;:()[\]{}"'`~*]+)/g);

        return (
          <p key={lineIdx} className="leading-relaxed">
            {tokens.map((token, tokenIdx) => {
              // Verifica se é uma palavra clicável (contém caracteres alfabéticos)
              const cleanWord = token.replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$/g, '').trim();
              const isClickableWord =
                cleanWord.length > 0 &&
                /[a-zA-ZÀ-ÿ]/.test(cleanWord) &&
                !/^\d+$/.test(cleanWord);

              if (isClickableWord) {
                return (
                  <span
                    key={tokenIdx}
                    onClick={(e) => handleWordClick(e, cleanWord, line)}
                    className="inline-block cursor-pointer px-0.5 -mx-0.5 rounded-sm hover:bg-[var(--accent)] hover:text-black hover:font-semibold transition-all duration-100 underline decoration-dotted decoration-[var(--accent-deep)]/60 underline-offset-3 hover:no-underline"
                    title={`Clique para ver sinônimos, IPA e tradução de "${cleanWord}"`}
                  >
                    {token}
                  </span>
                );
              }

              return <span key={tokenIdx}>{token}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
};
