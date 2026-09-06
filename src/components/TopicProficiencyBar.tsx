import React, { useMemo, useState } from 'react';
import {
  Trophy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UserStats, CEFRLevel } from '../types';
import { StorageService } from '../services/storage';
import { GraphEngine } from '../services/graphEngine';
import { getLanguageConfig } from '../config/languages';

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

  // Consulta nós do grafo relacionados ao idioma ou tópico atual.
  // Memoizado: este componente re-renderiza a cada tecla do chat (pai com
  // estado de input) e a leitura anterior parseava/filtrava tudo por render.
  const relevantNodes = useMemo(() => {
    const allNodes = StorageService.getNodes();
    const normTopic = GraphEngine.normalize(currentTopic);
    const activeLanguage = getLanguageConfig(stats.idioma_ativo || currentTopic);
    const languageNodes = allNodes.filter(
      (node) => getLanguageConfig(node.idioma || 'ingles').id === activeLanguage.id
    );

    const topicNodes = languageNodes.filter((node) => {
      const normTitle = GraphEngine.normalize(node.titulo);
      const normDesc = GraphEngine.normalize(node.descricao);
      return (
        normTitle.includes(normTopic) ||
        normTopic.includes(normTitle) ||
        normDesc.includes(normTopic)
      );
    });

    return topicNodes.length > 0 ? topicNodes : languageNodes.slice(0, 10);
  }, [currentTopic, stats.idioma_ativo]);
  const hasProficiencyEvidence =
    stats.total_respostas > 0 ||
    relevantNodes.some((node) => node.dominio_estimado > 0 || node.frequencia_erro > 0);
  const masteredNodes = relevantNodes.filter((node) => (node.dominio_estimado ?? 0) >= 70);

  // Cálculo de proficiência ponderado
  const avgNodeMastery =
    relevantNodes.length > 0
      ? relevantNodes.reduce((sum, node) => sum + Math.max(0, node.dominio_estimado ?? 0), 0) /
        relevantNodes.length
      : 0;

  const interactionScore = Math.min(100, Math.round((messagesCount / 12) * 100));

  const accuracyRate =
    stats.total_respostas > 0
      ? Math.round((stats.respostas_corretas / stats.total_respostas) * 100)
      : 0;

  const calculatedProficiency = hasProficiencyEvidence
    ? Math.min(
        100,
        Math.round(avgNodeMastery * 0.5 + interactionScore * 0.3 + accuracyRate * 0.2)
      )
    : 0;

  if (!hasProficiencyEvidence) {
    return (
      <div className="shrink-0 mb-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[var(--fg)]">Proficiência no tópico</span>
        <span className="text-[10px] font-bold text-[var(--muted)]">
          Aguardando evidências da primeira prática
        </span>
      </div>
    );
  }

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
