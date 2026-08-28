import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award,
  Flame,
  Star,
  CheckCircle2,
  Lock,
  Sparkles,
  Shield,
  Clock,
  Target,
  Zap,
  RotateCcw,
  Network,
  Mic,
  Brain,
  BookOpen,
  PartyPopper,
  X,
  ChevronRight,
  ExternalLink,
  Crown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { UserStats, Achievement } from '../types';
import { StorageService } from '../services/storage';
import { AchievementEngine } from '../services/achievementEngine';

interface AchievementsViewProps {
  stats: UserStats;
  onUpdateStats: (newStats: UserStats) => void;
  onResetData: () => void;
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({
  stats,
  onUpdateStats,
  onResetData,
}) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [dailyGoal, setDailyGoal] = useState(stats.meta_diaria_minutos || 30);
  const [savedGoalMsg, setSavedGoalMsg] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  
  // Estado para modal / toast de celebração de nova conquista
  const [celebrationAchievement, setCelebrationAchievement] = useState<Achievement | null>(null);
  // Estado para modal de inspeção detalhada
  const [inspectAchievement, setInspectAchievement] = useState<Achievement | null>(null);

  // Disparo de confetti customizado e potente
  const triggerCelebrationConfetti = () => {
    try {
      // Confetti dos dois lados (efeito canhão)
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { x: 0.2, y: 0.6 },
        colors: ['#f59e0b', '#6366f1', '#10b981', '#ec4899', '#eab308'],
      });
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { x: 0.8, y: 0.6 },
        colors: ['#f59e0b', '#6366f1', '#10b981', '#ec4899', '#eab308'],
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // Avalia conquistas atualizadas
    const evalRes = AchievementEngine.evaluateAll();
    setAchievements(evalRes.achievements);
    if (evalRes.newlyUnlocked.length > 0) {
      onUpdateStats(StorageService.getStats());
      setCelebrationAchievement(evalRes.newlyUnlocked[0]);
      triggerCelebrationConfetti();
    }
  }, []);

  const handleSaveDailyGoal = (val: number) => {
    setDailyGoal(val);
    const currStats = StorageService.getStats();
    currStats.meta_diaria_minutos = val;
    StorageService.saveStats(currStats);
    onUpdateStats(currStats);
    setSavedGoalMsg(true);
    setTimeout(() => setSavedGoalMsg(false), 2000);
  };

  // Simula / Reivindica desbloqueio de conquista para teste e feedback imediato
  const handleSimulateUnlock = (ach: Achievement) => {
    const all = StorageService.getAchievements();
    const updated = all.map((a) => {
      if (a.id === ach.id) {
        return {
          ...a,
          desbloqueada: true,
          data_desbloqueio: new Date().toISOString(),
          progresso_atual: a.progresso_meta || 1,
        };
      }
      return a;
    });
    StorageService.saveAchievements(updated);
    StorageService.addXP(ach.xp_recompensa);
    onUpdateStats(StorageService.getStats());
    setAchievements(updated);

    const unlockedObj = updated.find((a) => a.id === ach.id) || ach;
    setCelebrationAchievement(unlockedObj);
    setInspectAchievement(null);
    triggerCelebrationConfetti();
  };

  // Cálculo de XP e Nível
  const xpCurrentLevelBase = Math.pow(stats.nivel - 1, 2) * 80;
  const xpNextLevelBase = Math.pow(stats.nivel, 2) * 80;
  const xpNeeded = Math.max(1, xpNextLevelBase - xpCurrentLevelBase);
  const xpCurrent = Math.max(0, stats.xp - xpCurrentLevelBase);
  const progressPercent = Math.min(100, Math.round((xpCurrent / xpNeeded) * 100));

  const unlockedCount = achievements.filter((c) => c.desbloqueada).length;

  const renderIcon = (iconName: string, unlocked: boolean) => {
    const className = `w-5 h-5 ${unlocked ? 'text-amber-500' : 'text-slate-400'}`;
    switch (iconName) {
      case 'Flame':
        return <Flame className={className} />;
      case 'Award':
        return <Award className={className} />;
      case 'CheckCircle2':
        return <CheckCircle2 className={className} />;
      case 'Network':
        return <Network className={className} />;
      case 'Mic':
        return <Mic className={className} />;
      case 'Brain':
        return <Brain className={className} />;
      case 'BookOpen':
        return <BookOpen className={className} />;
      case 'Sparkles':
      default:
        return <Sparkles className={className} />;
    }
  };

  const filteredAchievements = achievements.filter((ach) => {
    if (selectedCategory === 'todos') return true;
    if (selectedCategory === 'desbloqueadas') return ach.desbloqueada;
    if (selectedCategory === 'pendentes') return !ach.desbloqueada;
    return ach.categoria === selectedCategory;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toast / Banner Flutuante de Celebração de Nova Conquista */}
      <AnimatePresence>
        {celebrationAchievement && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
          >
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 p-[2px] rounded-2xl shadow-2xl">
              <div className="bg-slate-900 text-white rounded-[14px] p-4 flex items-center justify-between gap-3 relative overflow-hidden">
                {/* Efeito de brilho de fundo animado */}
                <motion.div
                  animate={{
                    opacity: [0.2, 0.4, 0.2],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute -right-8 -top-8 w-32 h-32 bg-amber-400/30 rounded-full blur-2xl pointer-events-none"
                />

                <div className="flex items-center space-x-3.5 relative z-10">
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.15, 1] }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shrink-0 border border-amber-300"
                  >
                    <Trophy className="w-6 h-6 fill-slate-950 text-slate-950" />
                  </motion.div>

                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                        🎉 Conquista Desbloqueada!
                      </span>
                      <span className="text-xs font-bold text-amber-300">
                        +{celebrationAchievement.xp_recompensa} XP
                      </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-white leading-tight">
                      {celebrationAchievement.titulo}
                    </h4>
                    <p className="text-xs text-slate-300 line-clamp-1">
                      {celebrationAchievement.descricao}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 relative z-10">
                  <button
                    onClick={() => {
                      setInspectAchievement(celebrationAchievement);
                      setCelebrationAchievement(null);
                    }}
                    className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Ver
                  </button>
                  <button
                    onClick={() => setCelebrationAchievement(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabeçalho */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#171719]/10 rounded-[25px] p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-[9px] bg-[#171719] text-[#1ff98c] flex items-center justify-center font-bold">
              <Trophy className="w-4 h-4 text-[#1ff98c]" />
            </div>
            <h2 className="text-xl font-extrabold text-[#171719]">Conquistas & Progressão</h2>
          </div>
          <p className="text-xs sm:text-sm text-[#71717a] mt-1 font-mono">
            Recompensas personalizadas por marcos de aprendizagem, superação de dificuldades e consistência.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="px-3.5 py-1.5 rounded-[9px] bg-[#ededed] border border-[#171719]/15 text-[#171719] text-xs font-bold flex items-center space-x-1.5 shadow-xs font-mono"
          >
            <Flame className="w-4 h-4 fill-[#08ba61] text-[#08ba61]" />
            <span>{stats.sequencia_dias} Dias Consecutivos</span>
          </motion.div>

          <div className="px-3.5 py-1.5 rounded-[9px] bg-[#171719] text-[#1ff98c] text-xs font-bold shadow-xs font-mono">
            {unlockedCount} / {achievements.length} Conquistas
          </div>
        </div>
      </motion.div>

      {/* Grid: Nível & Meta Diária com Animações Fluidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card de Nível */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white border border-[#171719]/10 rounded-[25px] p-6 shadow-xs space-y-4 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-[9px] bg-[#171719] text-[#1ff98c] flex items-center justify-center">
                <Star className="w-4 h-4 text-[#1ff98c] fill-[#1ff98c]" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#171719]">Nível de Domínio: Nível {stats.nivel}</h3>
                <span className="text-[11px] text-[#71717a] font-mono">Fluência e Consolidação</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-[#171719] bg-[#ededed] px-2.5 py-1 rounded-[9px] border border-[#171719]/15">
              {stats.xp} XP Total
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[#71717a] font-mono font-bold">
              <span>Progresso para o Nível {stats.nivel + 1}</span>
              <span className="text-[#171719]">{progressPercent}%</span>
            </div>
            <div className="w-full bg-[#ededed] rounded-full h-3 overflow-hidden p-0.5 border border-[#171719]/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="bg-[#08ba61] h-full rounded-full shadow-xs"
              />
            </div>
            <div className="flex justify-between text-[11px] text-[#71717a] font-mono">
              <span>{xpCurrent} XP no nível atual</span>
              <span>Faltam {Math.max(0, xpNeeded - xpCurrent)} XP</span>
            </div>
          </div>

          <p className="text-xs text-[#171719] bg-[#ededed] p-3 rounded-[14px] border border-[#171719]/10 font-mono">
            💡 <strong>Como ganhar XP:</strong> +25 XP por resposta reflexiva, +40 XP por checagem superada, +20 XP/minuto em voz Live.
          </p>
        </motion.div>

        {/* Card de Meta Diária e Hábito */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white border border-[#171719]/10 rounded-[25px] p-6 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-[9px] bg-[#1ff98c] text-[#171719] flex items-center justify-center font-bold">
                <Target className="w-4 h-4 text-[#171719]" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#171719]">Meta Diária de Estudos</h3>
                <span className="text-[11px] text-[#71717a] font-mono">Consistência sustentável</span>
              </div>
            </div>
            <span className="text-xs font-bold text-[#08ba61] bg-[#1ff98c]/20 px-2.5 py-1 rounded-[9px] border border-[#08ba61]/30 font-mono">
              {stats.minutos_hoje} / {dailyGoal} min hoje
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-[#71717a] font-mono font-bold">Selecione sua meta diária de foco:</span>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((mins) => (
                <motion.button
                  key={mins}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSaveDailyGoal(mins)}
                  className={`py-2 rounded-[9px] text-xs font-bold transition border shadow-xs cursor-pointer font-mono ${
                    dailyGoal === mins
                      ? 'bg-[#171719] text-[#1ff98c] border-[#171719]'
                      : 'bg-white text-[#171719] border-[#171719]/15 hover:bg-[#ededed]'
                  }`}
                >
                  {mins} min
                </motion.button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {savedGoalMsg && (
              <motion.span
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-[#08ba61] font-bold block font-mono"
              >
                ✓ Meta diária atualizada com sucesso!
              </motion.span>
            )}
          </AnimatePresence>

          <div className="p-3 bg-[#ededed] rounded-[14px] border border-[#171719]/10 text-[11px] text-[#71717a] font-mono">
            🛡️ <strong>Hábito Sem Frustração:</strong> Pausas de até 48 horas mantêm sua sequência protegida, estimulando o ritmo de estudos sustentável.
          </div>
        </motion.div>
      </div>

      {/* Galeria de Conquistas */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#71717a] flex items-center space-x-2 font-mono">
            <Award className="w-4 h-4 text-[#08ba61]" />
            <span>Conquistas Personalizadas ({filteredAchievements.length})</span>
          </h3>

          {/* Filtros por Categoria com Transição Animada */}
          <div className="flex flex-wrap gap-1.5 text-xs font-mono">
            {[
              { id: 'todos', label: 'Todas' },
              { id: 'desbloqueadas', label: 'Desbloqueadas' },
              { id: 'pendentes', label: 'Em Progresso' },
              { id: 'dominio', label: 'Domínio' },
              { id: 'consistencia', label: 'Consistência' },
              { id: 'correcao', label: 'Correção' },
              { id: 'voz', label: 'Voz Live' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-[9px] font-bold transition-all cursor-pointer ${
                  selectedCategory === tab.id
                    ? 'bg-[#171719] text-[#1ff98c] shadow-xs'
                    : 'bg-white border border-[#171719]/15 text-[#71717a] hover:text-[#171719] hover:bg-[#ededed]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Cards de Conquista Animados */}
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence>
            {filteredAchievements.map((ach) => {
              const hasProgress =
                ach.progresso_atual !== undefined && ach.progresso_meta !== undefined;
              const pct = hasProgress
                ? Math.min(100, Math.round((ach.progresso_atual! / ach.progresso_meta!) * 100))
                : ach.desbloqueada
                ? 100
                : 0;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  key={ach.id}
                  onClick={() => setInspectAchievement(ach)}
                  className={`rounded-[20px] p-5 border transition-all flex flex-col justify-between cursor-pointer group relative shadow-xs hover:shadow-md ${
                    ach.desbloqueada
                      ? 'bg-white border-[#08ba61]/40 hover:border-[#08ba61]'
                      : 'bg-[#ededed]/50 border-[#171719]/10 hover:bg-white hover:border-[#171719]/25'
                  }`}
                >
                  {/* Badge de Desbloqueado */}
                  {ach.desbloqueada && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 rounded-full bg-[#1ff98c] text-[#171719] text-[9px] font-extrabold uppercase font-mono">
                        ★ Ativa
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-start space-x-3.5">
                      {/* Ícone */}
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        className={`w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 border transition-all ${
                          ach.desbloqueada
                            ? 'bg-[#171719] text-[#1ff98c] border-[#171719]'
                            : 'bg-white text-[#71717a] border-[#171719]/15'
                        }`}
                      >
                        {ach.desbloqueada ? (
                          renderIcon(ach.icone, true)
                        ) : (
                          <Lock className="w-4 h-4 text-[#71717a]" />
                        )}
                      </motion.div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between pr-4">
                          <h4
                            className={`font-extrabold text-xs sm:text-sm truncate transition ${
                              ach.desbloqueada ? 'text-[#171719]' : 'text-[#71717a]'
                            }`}
                          >
                            {ach.titulo}
                          </h4>
                        </div>

                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-[6px] border font-mono ${
                            ach.desbloqueada
                              ? 'text-[#08ba61] bg-[#1ff98c]/20 border-[#08ba61]/30'
                              : 'text-[#71717a] bg-white border-[#171719]/15'
                          }`}
                        >
                          +{ach.xp_recompensa} XP
                        </span>

                        <p className="text-xs text-[#71717a] leading-relaxed line-clamp-2">
                          {ach.descricao}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Barra de Progresso da Conquista */}
                  <div className="mt-4 pt-3 border-t border-[#171719]/10 space-y-1.5">
                    {hasProgress && !ach.desbloqueada && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-[#71717a] font-mono font-bold">
                          <span>Progresso</span>
                          <span className="text-[#171719]">
                            {ach.progresso_atual} / {ach.progresso_meta} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-[#ededed] rounded-full h-1.5 overflow-hidden border border-[#171719]/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className="bg-[#171719] h-full rounded-full"
                          />
                        </div>
                      </div>
                    )}

                    {ach.desbloqueada ? (
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#08ba61] font-mono">
                        <span className="flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#08ba61]" />
                          <span>Desbloqueada</span>
                        </span>
                        {ach.data_desbloqueio && (
                          <span className="text-[10px] text-[#71717a] font-normal">
                            {new Date(ach.data_desbloqueio).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[10px] text-[#71717a] font-mono">
                        <span>Clique para detalhes</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition text-[#71717a]" />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Modal de Detalhes da Conquista & Simulação de Desbloqueio */}
      <AnimatePresence>
        {inspectAchievement && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white border border-[#171719]/10 rounded-[25px] max-w-md w-full p-6 space-y-5 shadow-2xl text-[#171719] relative overflow-hidden"
            >
              {/* Header do Modal */}
              <div className="flex items-start justify-between border-b border-[#171719]/10 pb-3">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-12 h-12 rounded-[14px] flex items-center justify-center border shadow-xs ${
                      inspectAchievement.desbloqueada
                        ? 'bg-[#171719] border-[#171719] text-[#1ff98c]'
                        : 'bg-[#ededed] border-[#171719]/15 text-[#71717a]'
                    }`}
                  >
                    {renderIcon(inspectAchievement.icone, inspectAchievement.desbloqueada)}
                  </div>
                  <div>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full font-mono ${
                        inspectAchievement.desbloqueada
                          ? 'bg-[#1ff98c]/20 text-[#08ba61] border border-[#08ba61]/30'
                          : 'bg-[#ededed] text-[#71717a] border border-[#171719]/10'
                      }`}
                    >
                      {inspectAchievement.desbloqueada ? '✓ Conquistada' : '🔒 Em Andamento'}
                    </span>
                    <h3 className="text-base font-extrabold text-[#171719] mt-0.5">
                      {inspectAchievement.titulo}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setInspectAchievement(null)}
                  className="p-1 text-[#71717a] hover:text-[#171719] rounded-[9px] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Descrição & Recompensa */}
              <div className="space-y-3 text-xs sm:text-sm text-left">
                <p className="text-[#71717a] leading-relaxed bg-[#ededed] p-3.5 rounded-[16px] border border-[#171719]/10 font-mono">
                  {inspectAchievement.descricao}
                </p>

                <div className="flex items-center justify-between p-3.5 rounded-[16px] bg-[#1ff98c]/15 border border-[#08ba61]/30 text-[#171719]">
                  <div className="flex items-center space-x-2 font-mono">
                    <Sparkles className="w-4 h-4 text-[#08ba61]" />
                    <span className="font-bold">Recompensa ao Concluir:</span>
                  </div>
                  <span className="font-extrabold text-sm text-[#08ba61] font-mono">
                    +{inspectAchievement.xp_recompensa} XP
                  </span>
                </div>

                {/* Barra de Progresso Interna */}
                {inspectAchievement.progresso_meta !== undefined && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-[#71717a] font-mono font-bold">
                      <span>Progresso Atual</span>
                      <span className="text-[#171719]">
                        {inspectAchievement.progresso_atual} / {inspectAchievement.progresso_meta}
                      </span>
                    </div>
                    <div className="w-full bg-[#ededed] rounded-full h-2.5 overflow-hidden border border-[#171719]/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((inspectAchievement.progresso_atual || 0) /
                                (inspectAchievement.progresso_meta || 1)) *
                                100
                            )
                          )}%`,
                        }}
                        transition={{ duration: 0.6 }}
                        className="bg-[#08ba61] h-full rounded-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Ações do Modal */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#171719]/10">
                {!inspectAchievement.desbloqueada ? (
                  <button
                    onClick={() => handleSimulateUnlock(inspectAchievement)}
                    className="w-full py-2.5 bg-[#171719] hover:bg-[#171719]/90 text-[#1ff98c] font-bold rounded-[9px] text-xs transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer font-mono"
                  >
                    <PartyPopper className="w-4 h-4" />
                    <span>Testar Efeito de Desbloqueio (+XP)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      triggerCelebrationConfetti();
                      setCelebrationAchievement(inspectAchievement);
                      setInspectAchievement(null);
                    }}
                    className="w-full py-2.5 bg-[#ededed] hover:bg-[#ededed]/80 text-[#171719] font-bold rounded-[9px] text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer border border-[#171719]/15 font-mono"
                  >
                    <Sparkles className="w-4 h-4 text-[#08ba61]" />
                    <span>Reexibir Celebração e Confetes</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zona de Manutenção de Dados */}
      <div className="bg-white border border-[#171719]/10 rounded-[20px] p-4 flex flex-col sm:flex-row items-center justify-between text-xs text-[#71717a] gap-3 shadow-xs font-mono">
        <span>
          Ambiente MVP com persistência local confiável, animações em tempo real e sincronização reativa.
        </span>

        <button
          onClick={onResetData}
          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-[9px] transition flex items-center space-x-1 font-bold cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restaurar Dados Padrão</span>
        </button>
      </div>
    </div>
  );
};
