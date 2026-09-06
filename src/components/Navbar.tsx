import React, { useState } from 'react';
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
  Volume2,
  VolumeX,
  Crown,
  Share2,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { UserStats, UserProfile } from '../types';
import { getLanguageTheme } from '../services/languageThemes';
import { playSfx, sfx } from '../services/soundEffects';
import { UserProfileMenu } from './UserProfileMenu';
import { SyncStatusIndicator } from './SyncStatusIndicator';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  stats: UserStats;
  currentTopic: string;
  currentUser: UserProfile | null;
  onTopicClick: () => void;
  onResetData: () => void;
  onOpenScreenshotModal?: () => void;
  onOpenAuthModal: () => void;
  onOpenSharedPacksModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  stats,
  currentTopic,
  currentUser,
  onTopicClick,
  onResetData,
  onOpenScreenshotModal,
  onOpenAuthModal,
  onOpenSharedPacksModal,
  onLogout,
}) => {
  const activeTheme = getLanguageTheme(stats.idioma_ativo || currentTopic);
  const [isSfxMuted, setIsSfxMuted] = useState(sfx.getIsMuted());
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  const handleTabClick = (tabId: string, sound: 'click' | 'pop' = 'click') => {
    playSfx(sound);
    setActiveTab(tabId);
    setIsMobileMoreOpen(false);
  };

  const handleToggleSfx = () => {
    const muted = sfx.toggleMute();
    setIsSfxMuted(muted);
  };

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

  // Adiciona a aba ADM na barra quando o usuário é administrador
  if (currentUser?.role === 'admin') {
    navLinks.push({ id: 'admin', label: '👑 ADM', icon: Crown });
  }

  const mobilePrimaryIds = ['home', 'chat', 'flashcards', 'materials'];
  const mobilePrimaryLinks = navLinks.filter((link) => mobilePrimaryIds.includes(link.id));
  const mobileMoreLinks = navLinks.filter((link) => !mobilePrimaryIds.includes(link.id));

  return (
    <div className="sticky top-3.5 z-50 px-4 sm:px-6 max-w-6xl mx-auto w-full">
      <nav
        className="flex items-center gap-2 bg-[oklch(1_0_0_/_0.90)] backdrop-blur-md border border-[var(--border)] rounded-full p-2 pl-4 pr-3 shadow-[var(--shadow-sm)] transition-all"
        aria-label="Navegação principal"
      >
        {/* Brand Logo */}
        <button
          onClick={() => handleTabClick('home', 'pop')}
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
          onClick={() => {
            playSfx('click');
            onTopicClick();
          }}
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

        {/* Status de sincronização com a nuvem (desktop; invisível até o 1º evento de sync) */}
        <div className="hidden md:flex items-center">
          <SyncStatusIndicator />
        </div>

        {/* Nav Links */}
        <div className="hidden lg:flex items-center gap-0.5 ml-auto overflow-x-auto scrollbar-none py-0.5">
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                id={`nav-link-${link.id}`}
                onClick={() => handleTabClick(link.id)}
                aria-current={isActive ? 'page' : undefined}
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

          {/* Sound Effects Toggle */}
          <button
            onClick={handleToggleSfx}
            className={`hidden sm:inline-flex p-2 rounded-full transition cursor-pointer ${
              isSfxMuted
                ? 'text-[var(--muted)]/60 hover:text-[var(--fg)] hover:bg-[oklch(0.955_0.012_84)]'
                : 'text-[var(--fg)] bg-[oklch(0.955_0.012_84)] hover:bg-[oklch(0.94_0.015_84)]'
            }`}
            title={isSfxMuted ? 'Efeitos sonoros desativados (clique para ativar)' : 'Efeitos sonoros ativos (clique para silenciar)'}
            aria-label="Controle de efeitos sonoros"
          >
            {isSfxMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[var(--accent-deep)]" />}
          </button>

          {/* Shared Knowledge Base Explorer Button */}
          <button
            onClick={() => {
              playSfx('click');
              onOpenSharedPacksModal();
            }}
            className="hidden sm:inline-flex p-2 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[oklch(0.955_0.012_84)] rounded-full transition cursor-pointer"
            title="Bases de Conhecimento Compartilhadas"
            aria-label="Bases de Conhecimento"
          >
            <Share2 className="w-4 h-4 text-[var(--accent-deep)]" />
          </button>

          {/* Screenshot capture trigger */}
          {onOpenScreenshotModal && (
            <button
              onClick={() => {
                playSfx('click');
                onOpenScreenshotModal();
              }}
              className="hidden sm:inline-flex p-2 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[oklch(0.955_0.012_84)] rounded-full transition cursor-pointer"
              title="Captura de telas em PNG"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}

          {/* User Profile & Authentication Trigger */}
          <UserProfileMenu
            currentUser={currentUser}
            onOpenAuthModal={onOpenAuthModal}
            onOpenSharedPacksModal={onOpenSharedPacksModal}
            onOpenAdminPanel={() => handleTabClick('admin')}
            onLogout={onLogout}
            onResetData={onResetData}
          />
        </div>
      </nav>

      {isMobileMoreOpen && (
        <div
          id="mobile-more-menu"
          className="fixed inset-x-3 bottom-20 z-50 grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow)] lg:hidden"
        >
          {mobileMoreLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleTabClick(link.id)}
                aria-current={isActive ? 'page' : undefined}
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-left text-xs font-bold text-[var(--fg)] hover:bg-[oklch(0.955_0.012_84)]"
              >
                <Icon className="h-4 w-4" />
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <nav
        data-testid="mobile-navigation"
        aria-label="Navegação principal móvel"
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-1.5 shadow-[var(--shadow)] backdrop-blur-md lg:hidden"
      >
        {mobilePrimaryLinks.map((link) => {
          const Icon = link.icon;
          const isActive = activeTab === link.id;
          return (
            <button
              key={link.id}
              type="button"
              onClick={() => handleTabClick(link.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${
                isActive ? 'bg-[var(--fg)] text-white' : 'text-[var(--muted)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{link.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setIsMobileMoreOpen((open) => !open)}
          aria-expanded={isMobileMoreOpen}
          aria-controls="mobile-more-menu"
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-[var(--muted)]"
        >
          {isMobileMoreOpen ? <X className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
          <span>Mais</span>
        </button>
      </nav>
    </div>
  );
};
