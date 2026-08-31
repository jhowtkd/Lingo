import React, { useState } from 'react';
import {
  Trophy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UserStats, CEFRLevel } from '../types';
import { StorageService } from '../services/storage';
import { GraphEngine } from '../services/graphEngine';

interface TopicProficiencyBarProps {
  currentTopic: string;
  stats: UserStats;
  messagesCount: number;
  isFocusMode?: boolean;
}

export const TopicProficiencyBar: React.FC<TopicProficiencyBarProps> = ({
  currentTopic,
  stats,
  messagesCount,
  isFocusMode = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Consulta nós do grafo relacionados ao idioma ou tópico atual
  const allNodes = StorageService.getNodes();
  const normTopic = GraphEngine.normalize(currentTopic);

  const topicNodes = allNodes.filter((n) => {
    const normTitle = GraphEngine.normalize(n.titulo);
    const normDesc = GraphEngine.normalize(n.descricao);
    return (
      normTitle.includes(normTopic) ||
      normTopic.includes(normTitle) ||
      normDesc.includes(normTopic)
    );
  });

  const relevantNodes = topicNodes.length > 0 ? topicNodes : allNodes.slice(0, 10);
  const masteredNodes = relevantNodes.filter((n) => (n.dominio_estimado || 0) >= 70);

  // Cálculo de proficiência ponderado
  const avgNodeMastery =
    relevantNodes.length > 0
      ? relevantNodes.reduce((acc, n) => acc + (n.dominio_estimado || 50), 0) /
        relevantNodes.length
      : 50;

  const interactionScore = Math.min(100, Math.round((messagesCount / 12) * 100));

  const accuracyRate =
    stats.total_respostas > 0
      ? Math.round((stats.respostas_corretas / stats.total_respostas) * 100)
      : 75;

  const calculatedProficiency = Math.min(
    100,
    Math.max(
      15,
      Math.round(
        avgNodeMastery * 0.5 + interactionScore * 0.3 + accuracyRate * 0.2
      )
    )
  );

  // Mapeamento de Nível CEFR e Título
  const getProficiencyStage = (pct: number): { cefr: CEFRLevel; title: string; badgeBg: string } => {
    if (pct < 30) {
      return {
        cefr: 'A1',
        title: 'Iniciante',
        badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300',
      };
    }
    if (pct < 50) {
      return {
        cefr: 'A2',
        title: 'Básico',
        badgeBg: 'bg-blue-500/15 border-blue-500/30 text-blue-800 dark:text-blue-300',
      };
    }
    if (pct < 70) {
      return {
        cefr: 'B1',
        title: 'Intermediário',
        badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300',
      };
    }
    if (pct < 85) {
      return {
        cefr: 'B2',
        title: 'Fluente',
        badgeBg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-800 dark:text-indigo-300',
      };
    }
    if (pct < 95) {
      return {
        cefr: 'C1',
        title: 'Avançado',
        badgeBg: 'bg-purple-500/15 border-purple-500/30 text-purple-800 dark:text-purple-300',
      };
    }
    return {
      cefr: 'C2',
      title: 'Mestre',
      badgeBg: 'bg-amber-500/20 border-amber-500/50 text-amber-900 dark:text-amber-200',
    };
  };

  const stage = getProficiencyStage(calculatedProficiency);

  return (
    <div className="shrink-0 mb-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        {/* Lado Esquerdo: Identificação Compacta */}
        <div className="flex items-center space-x-2 min-w-0">
          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="text-xs font-bold text-[var(--fg)] truncate">
            Proficiência no Tópico:
          </span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold border ${stage.badgeBg}`}>
            {stage.cefr} • {stage.title}
          </span>
        </div>

        {/* Lado Direito: Barra Compacta e Porcentagem */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="w-24 sm:w-36 bg-[oklch(0.92_0.01_84)] dark:bg-stone-800 h-2 rounded-full overflow-hidden p-0.2 border border-[var(--border)]/60">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-amber-500 to-emerald-500"
              style={{ width: `${calculatedProficiency}%` }}
            />
          </div>

          <span className="text-xs font-extrabold font-mono text-[var(--fg)]">
            {calculatedProficiency}%
          </span>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 text-[var(--muted)] hover:text-[var(--fg)] rounded transition cursor-pointer"
            title={isExpanded ? 'Ocultar detalhes' : 'Ver detalhes do cálculo'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Painel Expandido com Métricas Pedagógicas */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] animate-in fade-in duration-150">
          <div className="p-1.5 bg-[oklch(0.97_0.01_84)] dark:bg-stone-900 rounded border border-[var(--border)]">
            <span className="text-[9px] text-[var(--muted)] font-mono block">INTERAÇÕES</span>
            <span className="font-bold text-[var(--fg)]">{messagesCount} turnos</span>
          </div>

          <div className="p-1.5 bg-[oklch(0.97_0.01_84)] dark:bg-stone-900 rounded border border-[var(--border)]">
            <span className="text-[9px] text-[var(--muted)] font-mono block">NÓS NO GRAFO</span>
            <span className="font-bold text-[var(--fg)]">{relevantNodes.length} conceitos</span>
          </div>

          <div className="p-1.5 bg-[oklch(0.97_0.01_84)] dark:bg-stone-900 rounded border border-[var(--border)]">
            <span className="text-[9px] text-[var(--muted)] font-mono block">DOMINADOS</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {masteredNodes.length} de {relevantNodes.length}
            </span>
          </div>

          <div className="p-1.5 bg-[oklch(0.97_0.01_84)] dark:bg-stone-900 rounded border border-[var(--border)]">
            <span className="text-[9px] text-[var(--muted)] font-mono block">PRECISÃO</span>
            <span className="font-bold text-[var(--fg)]">{accuracyRate}%</span>
          </div>
        </div>
      )}
    </div>
  );
};
