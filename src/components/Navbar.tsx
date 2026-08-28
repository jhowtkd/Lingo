import React from 'react';
import {
  BookOpen,
  MessageSquare,
  Layers,
  Swords,
  Video,
  AlertCircle,
  Network,
  Trophy,
  BarChart3,
  Flame,
  RotateCcw,
  Sparkles,
  Camera,
} from 'lucide-react';
import { UserStats } from '../types';
import { getLanguageTheme } from '../services/languageThemes';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  stats: UserStats;
  currentTopic: string;
  onTopicClick: () => void;
  onResetData: () => void;
  onOpenScreenshotModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  stats,
  currentTopic,
  onTopicClick,
  onResetData,
  onOpenScreenshotModal,
}) => {
  const activeTheme = getLanguageTheme(stats.idioma_ativo || currentTopic);

  const navLinks = [
    { id: 'home', label: 'Início', icon: Sparkles },
    { id: 'chat', label: 'Conversar', icon: MessageSquare },
    { id: 'flashcards', label: 'Flashcards', icon: Layers },
    { id: 'duel', label: 'Duelo', icon: Swords },
    { id: 'materials', label: 'Materiais', icon: Video },
    { id: 'misconceptions', label: 'Equívocos', icon: AlertCircle },
    { id: 'graph', label: 'Grafo', icon: Network },
    { id: 'achievements', label: 'Conquistas', icon: Trophy },
    { id: 'dashboard', label: 'Painel', icon: BarChart3 },
  ];

  return (
    <div className="sticky top-3.5 z-50 px-4 sm:px-6 max-w-6xl mx-auto w-full">
      <nav
        className="flex items-center gap-2 bg-[oklch(1_0_0_/_0.90)] backdrop-blur-md border border-[var(--border)] rounded-full p-2 pl-4 pr-3 shadow-[var(--shadow-sm)] transition-all"
        aria-label="Navegação principal"
      >
        {/* Brand Logo */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2.5 font-display font-bold text-lg text-[var(--fg)] hover:opacity-90 transition cursor-pointer shrink-0"
        >
          <span className="w-8 h-8 rounded-xl bg-[var(--accent)] flex items-center justify-center text-[var(--fg)] shadow-[inset_0_-3px_0_oklch(0.55_0.15_48)] shrink-0">
            <svg
              viewBox="0 0 24 24"
              className="w-4.5 h-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5V6a2 2 0 0 1 2-2h13v14H6.5A2.5 2.5 0 0 0 4 20.5z" />
              <path d="M9 8h6M9 11.5h4" />
            </svg>
          </span>
          <span className="tracking-tight hidden sm:inline">Lingo</span>
        </button>

        {/* Language & Topic Pill */}
        <button
          onClick={onTopicClick}
          className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--fg)] px-3 py-1 text-xs font-bold text-[var(--fg)] transition cursor-pointer shadow-xs ml-1"
          title="Trocar idioma ou tópico de estudo"
        >
          <span className="text-sm leading-none">{activeTheme.bandeira.split(' ')[0]}</span>
          <span className="font-semibold">{stats.idioma_ativo || activeTheme.nome}</span>
          <span className="opacity-40">•</span>
          <span className="text-[11px] text-[var(--muted)] font-mono truncate max-w-[140px]">
            {currentTopic.split(':')[1]?.trim() || currentTopic}
          </span>
        </button>

        {/* Nav Links */}
        <div className="flex items-center gap-0.5 ml-auto overflow-x-auto scrollbar-none py-0.5">
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                id={`nav-link-${link.id}`}
                onClick={() => setActiveTab(link.id)}
                className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm whitespace-nowrap transition-all duration-180 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--fg)] text-[oklch(0.97_0.01_84)] shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[oklch(0.955_0.012_84)]'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        {/* Streak & Avatar Actions */}
        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          {/* Quick Streak Pill */}
          <div
            className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--sunny)] text-[var(--fg)] text-xs font-extrabold"
            title={`${stats.sequencia_dias} dias seguidos`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-700 fill-amber-700" />
            <span>{stats.sequencia_dias}d</span>
          </div>

          {/* Screenshot capture trigger */}
          {onOpenScreenshotModal && (
            <button
              onClick={onOpenScreenshotModal}
              className="p-2 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[oklch(0.955_0.012_84)] rounded-full transition cursor-pointer"
              title="Captura de telas em PNG"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}

          {/* User Avatar Button */}
          <button
            onClick={() => setActiveTab('achievements')}
            className="w-8.5 h-8.5 rounded-full bg-[var(--sky)] border-2 border-[var(--fg)] flex items-center justify-center font-extrabold text-xs text-[var(--fg)] shadow-[2px_2px_0_var(--fg)] hover:scale-105 transition cursor-pointer"
            title={`Nível ${stats.nivel} · ${stats.xp} XP`}
            aria-label="Seu perfil e conquistas"
          >
            JM
          </button>
        </div>
      </nav>
    </div>
  );
};
