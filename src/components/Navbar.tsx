import React from 'react';
import {
  MessageSquare,
  Network,
  Calendar,
  BookOpen,
  BarChart3,
  Trophy,
  Flame,
  RotateCcw,
  CreditCard,
  Target,
  Swords,
  Zap,
  Layers,
} from 'lucide-react';
import { UserStats } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { getLanguageTheme } from '../services/languageThemes';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  stats: UserStats;
  currentTopic: string;
  onTopicClick: () => void;
  onResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  stats,
  currentTopic,
  onTopicClick,
  onResetData,
}) => {
  const activeTheme = getLanguageTheme(stats.idioma_ativo || currentTopic);

  const tabs = [
    { id: 'chat', label: 'Tutor de Línguas', icon: MessageSquare },
    { id: 'flashcards', label: 'Flashcards SRS', icon: Layers, isGame: true, badge: 'SRS' },
    { id: 'duel', label: 'Duelo de Vocabulário', icon: Swords, isGame: true, badge: 'GAME' },
    { id: 'materials', label: 'Materiais & Vídeos', icon: BookOpen },
    { id: 'graph', label: 'Grafo de Vocabulário', icon: Network },
    { id: 'calendar', label: 'Plano de Imersão', icon: Calendar },
    { id: 'dashboard', label: 'Estatísticas & Fluência', icon: BarChart3 },
    { id: 'achievements', label: 'Conquistas & Metas', icon: Trophy },
    { id: 'pricing', label: 'Planos & Preços', icon: CreditCard },
  ];

  // Cálculo para o progresso do nível
  const xpCurrentLevelBase = Math.pow(stats.nivel - 1, 2) * 80;
  const xpNextLevelBase = Math.pow(stats.nivel, 2) * 80;
  const xpNeeded = Math.max(1, xpNextLevelBase - xpCurrentLevelBase);
  const xpCurrent = Math.max(0, stats.xp - xpCurrentLevelBase);
  const progressPercent = Math.min(100, Math.round((xpCurrent / xpNeeded) * 100));

  return (
    <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-border/80 text-foreground transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo e Tópico Ativo com Indicador de Tema */}
          <div className="flex items-center space-x-3">
            <div
              className={`w-9 h-9 text-white rounded-xl flex items-center justify-center font-bold text-sm tracking-tight shadow-sm transition-all duration-300 ${
                activeTheme.button_class.split(' ')[0]
              }`}
            >
              TL
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                  Tutor de Línguas
                </h1>
                <button
                  onClick={onTopicClick}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition cursor-pointer hover:opacity-90 ${activeTheme.badge_class}`}
                  title="Clique para trocar o idioma ou tema de estudos"
                >
                  <span>{activeTheme.bandeira.split(' ')[0]}</span>
                  <span>{stats.idioma_ativo || activeTheme.nome}</span>
                  <span className="opacity-40">•</span>
                  <span className="font-mono">{stats.nivel_cefr || 'B1'}</span>
                </button>
              </div>
              <button
                onClick={onTopicClick}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center space-x-1.5 transition text-left cursor-pointer mt-0.5"
                title="Clique para alterar o tópico de estudos ou idioma"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  FOCO:
                </span>
                <span className="font-medium text-foreground/90 hover:text-foreground truncate max-w-[180px] sm:max-w-[320px]">
                  {currentTopic}
                </span>
              </button>
            </div>
          </div>

          {/* Gamificação: Sequência, Nível e XP */}
          <div className="hidden md:flex items-center space-x-2.5">
            {/* Botão Rápido para o Duelo de Vocabulário */}
            <button
              onClick={() => setActiveTab('duel')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs ${
                activeTab === 'duel'
                  ? 'bg-foreground text-background border-foreground shadow-sm'
                  : 'bg-secondary/60 hover:bg-secondary border-border/80 text-foreground'
              }`}
              title="Jogar Duelo de Vocabulário rápido contra o relógio"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Duelo Rápido</span>
            </button>

            {/* Nível e Barra de XP */}
            <div className="flex flex-col items-end px-2 py-1 rounded-xl bg-secondary/50 border border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  NÍVEL {stats.nivel}
                </span>
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden border border-border/40">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      activeTheme.button_class.split(' ')[0]
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <span className="text-[9px] text-muted-foreground font-mono">
                {stats.xp} XP ({progressPercent}%)
              </span>
            </div>

            {/* Sequência de Dias */}
            <div
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-border/60 bg-secondary/50 text-foreground"
              title={`${stats.sequencia_dias} dias de estudo consecutivos`}
            >
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span className="text-xs font-bold font-mono">
                {stats.sequencia_dias}D
              </span>
            </div>

            {/* Meta Diária */}
            <div
              className="text-xs text-muted-foreground px-2.5 py-1.5 rounded-xl border border-border/60 bg-secondary/50 flex items-center space-x-1.5"
              title={`Meta diária: ${stats.minutos_hoje}/${stats.meta_diaria_minutos} min`}
            >
              <Target className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground font-bold font-mono">{stats.minutos_hoje}m</span>
              <span className="text-muted-foreground/70 font-mono">/{stats.meta_diaria_minutos}m</span>
            </div>

            {/* Botão de Reset */}
            <button
              onClick={onResetData}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl border border-transparent hover:border-border/60 transition cursor-pointer"
              title="Restaurar dados padrão do MVP"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <nav className="flex space-x-1 overflow-x-auto pb-2 scrollbar-none border-t border-border/60 pt-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-foreground text-background font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.isGame ? 'text-amber-500' : ''}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold ml-0.5">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};


