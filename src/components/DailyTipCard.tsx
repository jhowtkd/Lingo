import React, { useState, useMemo, useEffect } from 'react';
import {
  Lightbulb,
  Sparkles,
  Play,
  FileText,
  Youtube,
  Volume2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  BookOpen,
  MessageSquare,
  Zap,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Brain,
  Layers,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GraphNode, StudyMaterialItem, UserStats } from '../types';
import { StorageService } from '../services/storage';
import { SpeechService } from '../services/speechSynthesisService';
import { getLanguageConfig, normalizeUnicodeText } from '../config/languages';

interface DailyTipCardProps {
  stats: UserStats;
  currentTopic?: string;
  onNavigateToMaterials: (materialId?: string) => void;
  onNavigateToChat: (topic: string) => void;
  onUpdateStats?: (newStats: UserStats) => void;
}

export interface LearningGapInsight {
  node: GraphNode;
  urgencyScore: number;
  gapReason: string;
  gapDiagnosis: string;
  recommendedMaterial?: StudyMaterialItem;
  curatedContent: {
    formatType: 'video' | 'article';
    headline: string;
    mediaSource: string;
    youtubeId?: string;
    readOrWatchTime: string;
    coreRule: string;
    contrastExample: {
      incorrect: string;
      correct: string;
      explanation: string;
    };
    audioPhrase: string;
    quiz: {
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    };
  };
}

export const DailyTipCard: React.FC<DailyTipCardProps> = ({
  stats,
  currentTopic = 'Inglês',
  onNavigateToMaterials,
  onNavigateToChat,
  onUpdateStats,
}) => {
  const [selectedGapIndex, setSelectedGapIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'explanation' | 'quiz' | 'media'>('explanation');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isMarkedUnderstood, setIsMarkedUnderstood] = useState(false);

  const activeLanguage = stats.idioma_ativo || 'Inglês';
  const langConfig = getLanguageConfig(activeLanguage);

  // Analisa o Grafo de Conhecimento e identifica as maiores lacunas
  const learningGaps: LearningGapInsight[] = useMemo(() => {
    const nodes = StorageService.getNodes();
    const materials = StorageService.getMaterials();
    const corrections = StorageService.getCorrections();
    const now = new Date();

    // Filtra nós do idioma ativo
    const langNodes = nodes.filter((n) => {
      const nodeLang = getLanguageConfig(n.idioma || 'ingles');
      return nodeLang.id === langConfig.id;
    });

    const candidateNodes = langNodes.length > 0 ? langNodes : nodes;

    // Calcula a pontuação de criticidade da lacuna
    const scoredGaps = candidateNodes.map((node) => {
      let score = 0;
      const mastery = node.dominio_estimado ?? 50;
      const errorFreq = node.frequencia_erro ?? 0;
      const difficulty = node.dificuldade ?? 3;
      const isOverdue = node.proxima_revisao ? new Date(node.proxima_revisao) <= now : false;

      // 1. Domínio frágil (baixo domínio = maior urgência)
      if (mastery < 45) score += 40;
      else if (mastery < 60) score += 28;
      else if (mastery < 75) score += 12;

      // 2. Frequência de erro registrada
      score += Math.min(errorFreq * 15, 45);

      // 3. Falsos cognatos e dificuldades têm prioridade de correção
      if (node.tipo === 'falso_amigo') score += 35;
      else if (node.tipo === 'dificuldade' || node.tipo === 'equivoco') score += 38;
      else if (node.tipo === 'gramatica') score += 20;

      // 4. Revisão espaçada vencida
      if (isOverdue) score += 25;

      // 5. Correções pedagógicas associadas não assimiladas
      const normTitle = normalizeUnicodeText(node.titulo);
      const pendingCorrs = corrections.filter((c) => {
        const normConceito = normalizeUnicodeText(c.conceito);
        return (
          (normConceito.includes(normTitle) || normTitle.includes(normConceito)) &&
          (c.estado_posterior === 'precisa_revisar' || !c.respondido_corretamente)
        );
      });
      score += pendingCorrs.length * 18;

      // Procura material existente no Estúdio correspondente
      const matchingMaterial = materials.find((m) => {
        const normMatTitle = normalizeUnicodeText(m.titulo);
        const normMatSummary = normalizeUnicodeText(m.resumo);
        const normVocab = m.vocabulario.map((v) => normalizeUnicodeText(v.termo)).join(' ');
        return (
          normMatTitle.includes(normTitle) ||
          normTitle.includes(normMatTitle) ||
          normMatSummary.includes(normTitle) ||
          normVocab.includes(normTitle)
        );
      });

      // Gera diagnóstico pedagógico
      let gapReason = 'Baixo Domínio & Equívocos Frequentes';
      let gapDiagnosis = `Grafo identificou domínio de apenas ${mastery}% com interferência do português.`;

      if (node.tipo === 'falso_amigo') {
        gapReason = 'Falso Cognato / Vício de Tradução';
        gapDiagnosis = `Confusão semântica detectada entre "${node.titulo}" e o português.`;
      } else if (node.tipo === 'dificuldade') {
        gapReason = 'Gargalo Fonético ou Estrutural';
        gapDiagnosis = `Dificuldade registrada na emissão oral e compreensão fluida.`;
      } else if (isOverdue) {
        gapReason = 'Revisão Espaçada (SRS) Atrasada';
        gapDiagnosis = `Conceito prestes a sofrer regressão pela curva do esquecimento.`;
      }

      // Constrói cápsula de estudo rica adaptada ao nó
      const curated = buildCuratedContentForNode(node, matchingMaterial);

      return {
        node,
        urgencyScore: score,
        gapReason,
        gapDiagnosis,
        recommendedMaterial: matchingMaterial,
        curatedContent: curated,
      };
    });

    // Ordena pelo maior score de criticidade
    scoredGaps.sort((a, b) => b.urgencyScore - a.urgencyScore);

    // Sem evidência no grafo, não há lacuna a sugerir.
    if (scoredGaps.length === 0) {
      return [];
    }

    return scoredGaps;
  }, [stats, langConfig.id, activeLanguage]);

  // Garante que o índice atual é válido
  const currentGap: LearningGapInsight | null = learningGaps[selectedGapIndex] ?? null;

  // Reseta estado local ao trocar de lacuna
  useEffect(() => {
    setSelectedOption(null);
    setHasAnswered(false);
    setIsAnswerCorrect(false);
    setIsMarkedUnderstood(false);
  }, [selectedGapIndex]);

  // Função auxiliar de áudio TTS
  const handlePlayAudio = (text: string) => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    SpeechService.speak(text, {
      lang: langConfig.voiceCode || 'en-US',
      rate: 0.88,
      onEnd: () => setIsPlayingAudio(false),
      onError: () => setIsPlayingAudio(false),
    });
  };

  // Submissão do Micro-Quiz da Dica
  const handleAnswerOption = (index: number) => {
    if (!currentGap || hasAnswered) return;
    setSelectedOption(index);
    setHasAnswered(true);

    const isCorrect = index === currentGap.curatedContent.quiz.correctIndex;
    setIsAnswerCorrect(isCorrect);

    if (isCorrect) {
      try {
        confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#059669', '#10b981', '#f59e0b', '#3b82f6'],
        });
      } catch {
        // Fallback silencioso
      }

      // Bonificação de XP e atualização do nó no Grafo
      const currentStats = StorageService.getStats();
      const updatedStats: UserStats = {
        ...currentStats,
        xp: currentStats.xp + 25,
        respostas_corretas: (currentStats.respostas_corretas || 0) + 1,
        total_respostas: (currentStats.total_respostas || 0) + 1,
      };
      StorageService.saveStats(updatedStats);
      if (onUpdateStats) onUpdateStats(updatedStats);

      // Incrementa domínio do nó
      const nodes = StorageService.getNodes();
      const targetNode = nodes.find((n) => n.id === currentGap.node.id);
      if (targetNode) {
        targetNode.dominio_estimado = Math.min(100, (targetNode.dominio_estimado ?? 0) + 12);
        targetNode.frequencia_erro = Math.max(0, (targetNode.frequencia_erro ?? 0) - 1);
        targetNode.ultima_revisao = new Date().toISOString();
        targetNode.proxima_revisao = new Date(Date.now() + 3 * 86400000).toISOString();
        StorageService.saveNodes(nodes);
      }
    }
  };

  // Marcar como assimilado / compreendido
  const handleMarkAsUnderstood = () => {
    if (!currentGap) return;
    setIsMarkedUnderstood(true);
    const nodes = StorageService.getNodes();
    const targetNode = nodes.find((n) => n.id === currentGap.node.id);
    if (targetNode) {
      targetNode.dominio_estimado = Math.min(100, (targetNode.dominio_estimado ?? 0) + 15);
      targetNode.proxima_revisao = new Date(Date.now() + 4 * 86400000).toISOString();
      StorageService.saveNodes(nodes);
    }
  };

  const nextGap = () => {
    setSelectedGapIndex((prev) => (prev + 1) % learningGaps.length);
  };

  if (!currentGap) {
    return (
      <section className="view-card p-6 sm:p-8 text-left space-y-4">
        <div className="space-y-1">
          <h2 className="font-display font-bold text-lg text-[var(--fg)]">
            Ainda não há uma lacuna detectada
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Converse com o tutor ou adicione um material. Quando houver evidências no grafo, sua próxima revisão aparecerá aqui.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigateToChat(currentTopic)}
            className="rounded-full px-4 py-2 text-xs font-extrabold bg-[var(--accent)] text-[var(--fg)]"
          >
            Começar conversa
          </button>
          <button
            type="button"
            onClick={() => onNavigateToMaterials()}
            className="rounded-full px-4 py-2 text-xs font-extrabold border border-[var(--border)] text-[var(--fg)]"
          >
            Adicionar material
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      id="daily-tip-card"
      className="view-card border-2 border-[var(--accent-deep)] p-6 sm:p-8 space-y-6 text-left relative overflow-hidden transition-all duration-300"
    >
      {/* Decorative Accent Background Glow */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[var(--accent-soft)] opacity-40 blur-2xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Header com Identificação da Lacuna */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent-deep)] shadow-inner shrink-0">
            <Lightbulb className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--accent-deep)]">
                Dica do Dia · Inteligência de Grafo
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 border border-rose-200">
                {currentGap.gapReason}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-[var(--fg)] mt-0.5">
              Superando: <span className="text-[var(--accent-deep)]">{currentGap.node.titulo}</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Seletor de Próxima Lacuna */}
          {learningGaps.length > 1 && (
            <button
              onClick={nextGap}
              title="Analisar próxima lacuna identificada pelo grafo"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)] transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ver Outra ({selectedGapIndex + 1}/{Math.min(learningGaps.length, 5)})</span>
            </button>
          )}

          {/* Indicador de Domínio Atual */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[oklch(0.96_0.01_84)] border border-[var(--border)] text-xs font-bold text-[var(--fg)]">
            <Brain className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
            <span>{currentGap.node.dominio_estimado ?? 0}% domínio</span>
          </div>
        </div>
      </div>

      {/* Navegação de Abas da Dica (Artigo / Mídia / Checagem Rápida) */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('explanation')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition cursor-pointer ${
            activeTab === 'explanation'
              ? 'bg-[var(--fg)] text-[oklch(0.98_0.01_84)]'
              : 'text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Micro-Artigo & Regra</span>
        </button>

        <button
          onClick={() => setActiveTab('media')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition cursor-pointer ${
            activeTab === 'media'
              ? 'bg-[var(--fg)] text-[oklch(0.98_0.01_84)]'
              : 'text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          {currentGap.curatedContent.formatType === 'video' ? (
            <Youtube className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <BookOpen className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
          )}
          <span>
            {currentGap.curatedContent.formatType === 'video' ? 'Vídeo Sugerido' : 'Material Completo'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('quiz')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition cursor-pointer ${
            activeTab === 'quiz'
              ? 'bg-[var(--fg)] text-[oklch(0.98_0.01_84)]'
              : 'text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Checagem Rápida (+25 XP)</span>
          {hasAnswered && (
            <span
              className={`w-2 h-2 rounded-full ${
                isAnswerCorrect ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
          )}
        </button>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {activeTab === 'explanation' && (
        <div className="space-y-4 animate-fade-in">
          {/* Diagnóstico Curto */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300 text-xs sm:text-sm text-amber-950 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-extrabold block">Por que esta dica hoje?</strong>
              <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                {currentGap.gapDiagnosis} {currentGap.curatedContent.coreRule}
              </p>
            </div>
          </div>

          {/* Comparativo Visual Contraste: Erro Comum vs Forma Correta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-200 text-left space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1">
                <span>❌</span> Como brasileiros costumam errar
              </span>
              <p className="text-sm font-mono text-rose-950 font-bold">
                "{currentGap.curatedContent.contrastExample.incorrect}"
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-300 text-left space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Como falar naturalmente
              </span>
              <p className="text-sm font-mono text-emerald-950 font-bold">
                "{currentGap.curatedContent.contrastExample.correct}"
              </p>
            </div>
          </div>

          {/* Explicação Pedagógica & Áudio Pronúncia */}
          <div className="bg-[oklch(0.97_0.01_84)] rounded-xl p-4 border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 text-xs sm:text-sm text-[var(--fg)]">
              <span className="text-[10px] font-black uppercase text-[var(--muted)]">Explicação Direta</span>
              <p className="leading-relaxed text-[var(--fg)]">
                {currentGap.curatedContent.contrastExample.explanation}
              </p>
            </div>

            {currentGap.curatedContent.audioPhrase && (
              <button
                onClick={() => handlePlayAudio(currentGap.curatedContent.audioPhrase)}
                disabled={isPlayingAudio}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-bold text-xs bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--fg)] text-[var(--fg)] transition shrink-0 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Volume2 className={`w-4 h-4 text-[var(--accent-deep)] ${isPlayingAudio ? 'animate-bounce' : ''}`} />
                <span>{isPlayingAudio ? 'Ouvindo...' : 'Ouvir Exemplo Nativo'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'media' && (
        <div className="space-y-4 animate-fade-in">
          {/* Card do Material Sugerido */}
          <div className="bg-[oklch(0.97_0.01_84)] border border-[var(--border)] rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                {currentGap.curatedContent.formatType === 'video' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white font-extrabold text-[11px]">
                    <Youtube className="w-3.5 h-3.5" />
                    <span>VÍDEO DE REFORÇO</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--accent-deep)] text-white font-extrabold text-[11px]">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>ARTIGO DO ESTÚDIO</span>
                  </span>
                )}
                <span className="text-xs text-[var(--muted)] font-medium">
                  ⏱️ {currentGap.curatedContent.readOrWatchTime}
                </span>
              </div>

              {currentGap.recommendedMaterial && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-200">
                  Disponível no seu Estúdio
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-display font-bold text-[var(--fg)]">
              {currentGap.curatedContent.headline}
            </h3>

            {/* Embed do Vídeo (se houver YouTube ID) */}
            {currentGap.curatedContent.youtubeId ? (
              <div className="aspect-video w-full rounded-xl overflow-hidden shadow-inner border border-[var(--border)] bg-black">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${currentGap.curatedContent.youtubeId}?rel=0`}
                  title={currentGap.curatedContent.headline}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs sm:text-sm text-[var(--fg)] space-y-2">
                <p className="leading-relaxed font-serif text-[var(--fg)]">
                  {currentGap.curatedContent.mediaSource}
                </p>
              </div>
            )}

            {/* Ações do Estúdio */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                onClick={() => onNavigateToMaterials(currentGap.recommendedMaterial?.id)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition cursor-pointer shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Abrir no Estúdio de Materiais</span>
              </button>

              <button
                onClick={() => onNavigateToChat(`${activeLanguage}: Superando ${currentGap.node.titulo}`)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--fg)] text-[var(--fg)] transition cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Praticar este Tópico no Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'quiz' && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 rounded-xl bg-[oklch(0.97_0.01_84)] border border-[var(--border)] space-y-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase text-[var(--accent-deep)] flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Desafio Rápido de Fixação</span>
              </span>
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                +25 XP de Bônus
              </span>
            </div>

            <p className="text-sm sm:text-base font-bold text-[var(--fg)]">
              {currentGap.curatedContent.quiz.question}
            </p>

            <div className="space-y-2 pt-1">
              {currentGap.curatedContent.quiz.options.map((option, idx) => {
                let btnStyle = 'bg-[var(--surface)] border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)]';

                if (hasAnswered) {
                  if (idx === currentGap.curatedContent.quiz.correctIndex) {
                    btnStyle = 'bg-emerald-500/15 border-emerald-500 text-emerald-950 font-bold';
                  } else if (idx === selectedOption) {
                    btnStyle = 'bg-rose-500/15 border-rose-400 text-rose-950 line-through';
                  } else {
                    btnStyle = 'opacity-40 bg-[var(--surface)] border-[var(--border)]';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={hasAnswered}
                    onClick={() => handleAnswerOption(idx)}
                    className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm transition flex items-center justify-between gap-3 cursor-pointer ${btnStyle}`}
                  >
                    <span>{option}</span>
                    {hasAnswered && idx === currentGap.curatedContent.quiz.correctIndex && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Feedback pós-resposta */}
            {hasAnswered && (
              <div
                className={`p-3 rounded-xl text-xs sm:text-sm font-medium animate-fade-in ${
                  isAnswerCorrect
                    ? 'bg-emerald-500/10 border border-emerald-300 text-emerald-950'
                    : 'bg-rose-500/10 border border-rose-300 text-rose-950'
                }`}
              >
                <strong className="block font-bold">
                  {isAnswerCorrect ? '🎉 Resposta Correta! +25 XP' : '⚠️ Quase lá! Veja a explicação:'}
                </strong>
                <p className="mt-0.5 text-xs">
                  {currentGap.curatedContent.quiz.explanation}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer com Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
          <span>Após aplicar a dica, seu domínio no Grafo sobe automaticamente.</span>
        </div>

        <div className="flex items-center gap-2.5">
          {!isMarkedUnderstood ? (
            <button
              onClick={handleMarkAsUnderstood}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full font-bold text-xs bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--fg)] text-[var(--fg)] transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Marcar como Entendido</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full font-bold text-xs bg-emerald-500/10 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Consolidado no Grafo!</span>
            </span>
          )}

          <button
            onClick={() => onNavigateToChat(`${activeLanguage}: Praticar ${currentGap.node.titulo}`)}
            className="inline-flex items-center gap-2 px-4.5 py-2 rounded-full font-extrabold text-xs bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition shadow-[0_2px_0_oklch(0.55_0.15_48)] hover:-translate-y-0.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Treinar no Chat</span>
          </button>
        </div>
      </div>
    </section>
  );
};

// Construtor Inteligente de Conteúdo de Apoio para cada tipo de nó
function buildCuratedContentForNode(
  node: GraphNode,
  matchingMaterial?: StudyMaterialItem
): LearningGapInsight['curatedContent'] {
  const normTitle = normalizeUnicodeText(node.titulo);

  // 1. Actually vs Currently
  if (normTitle.includes('actually') || normTitle.includes('atualmente')) {
    return {
      formatType: 'video',
      headline: 'Actually vs Currently: Pare de Confundir em Reuniões e Conversas',
      mediaSource:
        '"Actually" em inglês NÃO significa atualmente. Significa "na verdade / para ser exato". Para expressar o que você está fazendo no presente, use "currently" ou "nowadays".',
      youtubeId: matchingMaterial?.youtube_video_id || 'y3k1Q-P3d6w',
      readOrWatchTime: '3 min',
      coreRule: 'Actually = "Na verdade" | Currently = "Atualmente".',
      contrastExample: {
        incorrect: 'Actually I am working at Google.',
        correct: 'Currently, I am working at Google. (Actually, I started last month!)',
        explanation:
          'Use "Currently" para falar do momento presente. "Actually" serve para corrigir ou retificar uma suposição.',
      },
      audioPhrase: 'Currently, I am working on a new project. Actually, it is almost finished!',
      quiz: {
        question: 'Como dizer "Atualmente moro em São Paulo" corretamente em inglês?',
        options: [
          'Actually I live in São Paulo.',
          'Currently I live in São Paulo.',
          'Presently I pretend to live in São Paulo.',
        ],
        correctIndex: 1,
        explanation: '"Currently" é o termo correto para o tempo presente. "Actually" significaria "Na verdade eu moro...".',
      },
    };
  }

  // 2. Pretend vs Intend
  if (normTitle.includes('pretend') || normTitle.includes('intend')) {
    return {
      formatType: 'video',
      headline: 'Pretend vs Intend: O Falso Amigo que Altera Todo o Sentido da Frase',
      mediaSource:
        '"Pretend" significa "fingir". Para dizer que você tem a intenção de fazer algo, utilize "intend to" ou "plan to".',
      youtubeId: 'kpv2B883bH4',
      readOrWatchTime: '2 min',
      coreRule: 'Pretend = "Fingir" | Intend = "Pretender / Ter intenção".',
      contrastExample: {
        incorrect: 'I pretend to travel to Canada next year.',
        correct: 'I intend to travel to Canada next year. (ou "I plan to travel")',
        explanation:
          'Dizer "I pretend to travel" soa como "Eu finjo que vou viajar". Use "intend" para expressar suas metas reais.',
      },
      audioPhrase: 'I intend to master conversational English this year, I am not pretending!',
      quiz: {
        question: 'O que significa "He is pretending to understand the presentation"?',
        options: [
          'Ele pretende entender a apresentação mais tarde.',
          'Ele está fingindo que entende a apresentação.',
          'Ele começou a entender a apresentação agora.',
        ],
        correctIndex: 1,
        explanation: '"Pretend" é fingir. Ele está apenas fingindo compreender.',
      },
    };
  }

  // 3. Pronúncia do -ed
  if (normTitle.includes('-ed') || normTitle.includes('pronuncia') || normTitle.includes('passado')) {
    return {
      formatType: 'video',
      headline: 'A Regra dos 3 Sons do "-ED" Final: Elimine o Vício do "edji"',
      mediaSource:
        'O sufixo -ed não adiciona uma nova sílaba, exceto após sons de T ou D (wanted /wɒn.tɪd/). Em verbos como worked, soa apenas como /t/ em sílaba única: /wɜːkt/.',
      youtubeId: 'f20BN_fW1zM',
      readOrWatchTime: '4 min',
      coreRule: 'Worked tem apenas 1 sílaba: /wɜːkt/ (som de T seco). Nunca fale "work-edji".',
      contrastExample: {
        incorrect: 'I work-edji yesterday (/wɜːk.e.dʒi/).',
        correct: 'I worked yesterday (/wɜːkt/).',
        explanation:
          'O som /k/ é surdo, fazendo o "-ed" virar som de /t/ colado diretamente na raiz.',
      },
      audioPhrase: 'She worked hard and called her friend yesterday.',
      quiz: {
        question: 'Quantas sílabas são pronunciadas na palavra "watched" em inglês?',
        options: ['1 sílaba (/wɒtʃt/)', '2 sílabas (/wɒtʃ-ed/)', '3 sílabas (/wɒ-tʃe-dʒi/)'],
        correctIndex: 0,
        explanation: '"Watched" é monossilábico: o "ed" soa como um simples estalo /t/.',
      },
    };
  }

  // 4. Borrow vs Lend
  if (normTitle.includes('borrow') || normTitle.includes('lend')) {
    return {
      formatType: 'article',
      headline: 'Borrow vs Lend: Quem Pega vs Quem Dá Emprestado',
      mediaSource:
        '"Borrow" é tomar emprestado ("Can I borrow?"). "Lend" é conceder emprestado ("Can you lend me?"). A direção do objeto determina o verbo.',
      readOrWatchTime: '2 min',
      coreRule: 'Borrow = Pegar de alguém | Lend = Conceder a alguém.',
      contrastExample: {
        incorrect: 'Can you borrow me your book?',
        correct: 'Can you lend me your book? (ou "Can I borrow your book?")',
        explanation:
          'Com "you", usa-se "lend". Com "I", usa-se "borrow from".',
      },
      audioPhrase: 'Could you lend me your pen? I will borrow it for just a second.',
      quiz: {
        question: 'Complete: "I need some money. Can you _____ me twenty dollars?"',
        options: ['borrow', 'lend', 'borrowing'],
        correctIndex: 1,
        explanation: 'Quem empresta (você) realiza a ação de "lend".',
      },
    };
  }

  // 5. Embarazada vs Apenada (Espanhol)
  if (normTitle.includes('embarazada') || normTitle.includes('apenada') || normTitle.includes('espanhol')) {
    return {
      formatType: 'video',
      headline: 'Embarazada vs Apenada: Evite a Maior Gafe do Espanhol',
      mediaSource:
        'Em espanhol, "Embarazada" significa gestante / grávida. Para dizer envergonhada ou sem jeito, usa-se "apenada" ou "avergonzada".',
      youtubeId: 'kpv2B883bH4',
      readOrWatchTime: '3 min',
      coreRule: 'Embarazada = Grávida | Apenada / Avergonzada = Envergonhada.',
      contrastExample: {
        incorrect: 'Estoy embarazada por llegar tarde a la reunión.',
        correct: 'Estoy muy apenada por llegar tarde a la reunión.',
        explanation:
          'Dizer "estoy embarazada" anuncia uma gravidez para toda a sala!',
      },
      audioPhrase: 'Estoy muy apenada por la confusión, no volverá a ocurrir.',
      quiz: {
        question: 'O que significa a frase em espanhol: "Ella está embarazada de cuatro meses"?',
        options: [
          'Ela está muito envergonhada há quatro meses.',
          'Ela está grávida de quatro meses.',
          'Ela está com medo de um projeto há quatro meses.',
        ],
        correctIndex: 1,
        explanation: '"Embarazada" em espanhol sempre se refere à gestação.',
      },
    };
  }

  // Fallback Geral Dinâmico baseado nas propriedades do nó
  return {
    formatType: matchingMaterial ? (matchingMaterial.tipo_fonte === 'youtube' ? 'video' : 'article') : 'article',
    headline: `Como Dominar: ${node.titulo}`,
    mediaSource: node.descricao || 'Conceito chave mapeado no seu grafo de conhecimento relacional.',
    youtubeId: matchingMaterial?.youtube_video_id,
    readOrWatchTime: '3 min',
    coreRule: node.traducao || `Consolide ${node.titulo} através de prática deliberada no chat e revisão espaçada.`,
    contrastExample: {
      incorrect: node.evidencias && node.evidencias[0] ? node.evidencias[0] : `Uso impreciso de ${node.titulo}`,
      correct: node.exemplo_uso || `Uso correto e natural de ${node.titulo}`,
      explanation: node.descricao || `Estrutura essencial para atingir fluência no idioma ${node.idioma || 'alvo'}.`,
    },
    audioPhrase: node.exemplo_uso || node.titulo,
    quiz: {
      question: `Qual a melhor forma de aplicar "${node.titulo}" em uma conversa?`,
      options: [
        node.exemplo_uso || `Utilizar em frases reais com contexto nativo`,
        `Traduzir literalmente palavra por palavra do português`,
        `Evitar falar para não cometer erros`,
      ],
      correctIndex: 0,
      explanation: `Aprender por contexto relacional no grafo acelera a assimilação duradoura.`,
    },
  };
}
