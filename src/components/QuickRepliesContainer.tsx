import React, { useState } from 'react';
import {
  Sparkles,
  Edit3,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import { ReplyTipOption } from '../services/quickRepliesService';

interface QuickRepliesContainerProps {
  tips: ReplyTipOption[];
  onApplyStarter: (starterText: string) => void;
  disabled?: boolean;
}

export const QuickRepliesContainer: React.FC<QuickRepliesContainerProps> = ({
  tips,
  onApplyStarter,
  disabled = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!tips || tips.length === 0) return null;

  return (
    <div className="shrink-0 mb-3 border border-[var(--border)] bg-[var(--surface)] shadow-xs rounded-[var(--r)] p-3 sm:p-3.5 transition-all text-xs text-left">
      {/* Cabeçalho da Dica Pedagógica */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[var(--border)]">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-deep)] flex items-center justify-center font-bold">
            <Lightbulb className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-display font-bold text-xs text-[var(--fg)]">
              Guia Pedagógico de Resposta (Aprenda a Estruturar)
            </span>
            <p className="text-[11px] text-[var(--muted)]">
              Em vez de responder por você, veja modelos de como você pode responder assim ou assado para treinar sua autonomia:
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[oklch(0.97_0.01_84)] flex items-center space-x-1 cursor-pointer transition"
          title={isCollapsed ? 'Mostrar modelos de frase' : 'Ocultar modelos de frase'}
        >
          <span>{isCollapsed ? 'Ver Modelos' : 'Ocultar'}</span>
          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Grid com Modelos Didáticos de Frase */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
          {tips.map((tip) => (
            <button
              key={tip.id}
              type="button"
              disabled={disabled}
              onClick={() => onApplyStarter(tip.starterText)}
              className="text-left p-3 rounded-[var(--r-sm)] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--fg)] hover:shadow-xs transition group cursor-pointer disabled:opacity-50 flex flex-col justify-between space-y-1.5"
              title="Clique para inserir o início da estrutura no campo de texto e completar com suas próprias ideias"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-extrabold text-[11px] text-[var(--accent-deep)] flex items-center space-x-1.5">
                  <span>{tip.icon || '💬'}</span>
                  <span>{tip.intent}</span>
                </span>
                <span className="text-[10px] font-bold text-[var(--muted)] group-hover:text-[var(--fg)] flex items-center space-x-0.5 shrink-0 bg-[oklch(0.96_0.01_84)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>Usar estrutura</span>
                </span>
              </div>

              {/* Template / Fórmula da frase */}
              <div className="text-xs font-bold text-[var(--fg)] font-mono bg-[oklch(0.98_0.01_84)] p-1.5 rounded border border-[var(--border)]/70">
                {tip.template}
              </div>

              {/* Tradução de apoio */}
              <div className="text-[11px] text-[var(--muted)] italic">
                {tip.translation}
              </div>

              {/* Nota pedagógica explicativa */}
              {tip.pedagogicalNote && (
                <div className="text-[10px] text-[var(--fg)]/80 font-medium bg-[var(--accent-soft)]/50 px-2 py-1 rounded border border-[var(--accent-deep)]/15 flex items-start space-x-1 mt-0.5">
                  <span className="font-bold text-[var(--accent-deep)] shrink-0">🎯 Meta:</span>
                  <span className="leading-tight">{tip.pedagogicalNote}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
