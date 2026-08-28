import React from 'react';
import { Check, Globe, Sparkles } from 'lucide-react';
import { LANGUAGE_THEMES, LanguageThemeConfig } from '../services/languageThemes';
import { LanguageThemeId } from '../types';

interface LanguageThemeSelectorProps {
  currentLanguage: string;
  onSelectLanguage: (languageName: string, themeId: LanguageThemeId) => void;
  compact?: boolean;
}

export const LanguageThemeSelector: React.FC<LanguageThemeSelectorProps> = ({
  currentLanguage,
  onSelectLanguage,
  compact = false,
}) => {
  const normCurrent = (currentLanguage || '').toLowerCase();

  const themesList = Object.values(LANGUAGE_THEMES);

  if (compact) {
    return (
      <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
        {themesList.map((t) => {
          const isSelected = normCurrent.includes(t.id) || normCurrent.includes(t.nome.toLowerCase());
          return (
            <button
              key={t.id}
              onClick={() => onSelectLanguage(t.nome, t.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-mono transition flex items-center space-x-1.5 cursor-pointer whitespace-nowrap border ${
                isSelected
                  ? 'bg-foreground text-background border-foreground font-bold shadow-2xs'
                  : 'bg-card/70 border-border text-foreground hover:bg-muted'
              }`}
              title={`${t.nome}: ${t.slogan}`}
            >
              <span>{t.bandeira.split(' ')[0]}</span>
              <span>{t.nome}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" />
          <span>Idioma de Estudo & Paleta Temática:</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {themesList.map((t) => {
          const isSelected = normCurrent.includes(t.id) || normCurrent.includes(t.nome.toLowerCase());
          return (
            <button
              key={t.id}
              onClick={() => onSelectLanguage(t.nome, t.id)}
              className={`p-3 rounded-xl border text-left transition relative cursor-pointer group flex flex-col justify-between ${
                isSelected
                  ? `bg-card border-foreground/80 shadow-sm ring-1 ring-ring`
                  : 'bg-card/50 border-border hover:border-border/80 hover:bg-muted/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{t.bandeira.split(' ')[0]}</span>
                  <div>
                    <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition">
                      {t.nome}
                    </h4>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Voz: {t.codigo_voz}
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                {t.slogan}
              </p>

              <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[10px] font-mono">
                <span className={`px-1.5 py-0.5 rounded border ${t.badge_class}`}>
                  Tema {t.cor_primaria}
                </span>
                <span className="text-muted-foreground">Clique para ativar</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
