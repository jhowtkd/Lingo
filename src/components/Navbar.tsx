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
  Camera,
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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#171719]/10 text-[#171719] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo e Tópico Ativo com Indicador de Tema */}
          <div className="flex items-center space-x-3">
            <div
              className="w-9 h-9 bg-[#08ba61] text-white rounded-[9px] flex items-center justify-center font-extrabold text-sm tracking-tighter shadow-sm border border-[#171719]/15"
            >
              TL
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#171719]">
                  Tutor de Línguas
                </h1>
                <button
                  onClick={onTopicClick}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#171719]/20 bg-[#1ff98c] text-[#171719] px-2.5 py-0.5 text-[11px] font-bold tracking-tight transition cursor-pointer hover:bg-[#1ae07d] shadow-xs"
                  title="Clique para trocar o idioma ou tema de estudos"
                >
                  <span>{activeTheme.bandeira.split(' ')[0]}</span>
                  <span>{stats.idioma_ativo || activeTheme.nome}</span>
                  <span className="opacity-30">•</span>
                  <span className="font-mono text-[10px]">{stats.nivel_cefr || 'B1'}</span>
                </button>
              </div>
              <button
                onClick={onTopicClick}
                className="text-xs text-[#71717a] hover:text-[#171719] flex items-center space-x-1.5 transition text-left cursor-pointer mt-0.5"
                title="Clique para alterar o tópico de estudos ou idioma"
              >
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#171719]/60">
                  FOCO:
                </span>
                <span className="font-semibold text-[#171719] truncate max-w-[180px] sm:max-w-[320px]">
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
              className={`px-3 py-1.5 rounded-[9px] border text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs ${
                activeTab === 'duel'
                  ? 'bg-[#171719] text-white border-[#171719]'
                  : 'bg-[#ededed] hover:bg-[#e2e2e2] border-[#171719]/10 text-[#171719]'
              }`}
              title="Jogar Duelo de Vocabulário rápido contra o relógio"
            >
              <Zap className="w-3.5 h-3.5 text-[#08ba61] fill-[#08ba61]" />
              <span>Duelo Rápido</span>
            </button>

            {/* Nível e Barra de XP */}
            <div className="flex flex-col items-end px-2.5 py-1 rounded-[9px] bg-[#ededed] border border-[#171719]/10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-[#171719] uppercase tracking-wider">
                  NÍVEL {stats.nivel}
                </span>
                <div className="w-16 h-1.5 bg-white rounded-full overflow-hidden border border-[#171719]/15">
                  <div
                    className="h-full transition-all duration-500 rounded-full bg-[#08ba61]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <span className="text-[9px] text-[#71717a] font-mono font-medium">
                {stats.xp} XP ({progressPercent}%)
              </span>
            </div>

            {/* Sequência de Dias */}
            <div
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-[9px] border border-[#171719]/10 bg-[#ededed] text-[#171719]"
              title={`${stats.sequencia_dias} dias de estudo consecutivos`}
            >
              <Flame className="w-4 h-4 text-[#08ba61] fill-[#08ba61]" />
              <span className="text-xs font-extrabold font-mono">
                {stats.sequencia_dias}D
              </span>
            </div>

            {/* Meta Diária */}
            <div
              className="text-xs text-[#71717a] px-2.5 py-1.5 rounded-[9px] border border-[#171719]/10 bg-[#ededed] flex items-center space-x-1.5"
              title={`Meta diária: ${stats.minutos_hoje}/${stats.meta_diaria_minutos} min`}
            >
              <Target className="w-3.5 h-3.5 text-[#171719]" />
              <span className="text-[#171719] font-bold font-mono">{stats.minutos_hoje}m</span>
              <span className="text-[#71717a] font-mono">/{stats.meta_diaria_minutos}m</span>
            </div>

            {/* Botão de Captura de Telas em PNG */}
            {onOpenScreenshotModal && (
              <button
                onClick={onOpenScreenshotModal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[#171719] bg-[#1ff98c] hover:bg-[#1ae07d] rounded-[9px] border border-[#171719]/20 transition cursor-pointer shadow-xs"
                title="Tirar print de todas as telas em PNG HD"
              >
                <Camera className="w-3.5 h-3.5 text-[#171719]" />
                <span className="hidden sm:inline">Prints PNG</span>
              </button>
            )}

            {/* Botão de Reset */}
            <button
              onClick={onResetData}
              className="p-2 text-[#71717a] hover:text-[#171719] hover:bg-[#ededed] rounded-[9px] border border-transparent hover:border-[#171719]/10 transition cursor-pointer"
              title="Restaurar dados padrão do MVP"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <nav className="flex space-x-1.5 overflow-x-auto pb-2 scrollbar-none border-t border-[#171719]/10 pt-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-[9px] text-xs sm:text-sm font-semibold tracking-tight whitespace-nowrap transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'bg-[#171719] text-white shadow-xs'
                    : 'text-[#71717a] hover:text-[#171719] hover:bg-[#ededed]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#1ff98c]' : ''}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-[#1ff98c] text-[#171719] font-extrabold ml-0.5">
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


