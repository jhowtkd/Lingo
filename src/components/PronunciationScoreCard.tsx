import React, { useState } from 'react';
import {
  Mic,
  Volume2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Award,
  Zap,
  Gauge,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PronunciationScoreData, PhonemeAccuracy, CEFRLevel } from '../types';
import { SpeechService } from '../services/speechSynthesisService';
import { SpeechRateService } from '../services/speechRateService';
import { SpeechRateVisualizer } from './SpeechRateVisualizer';
import { CornerPlus } from './ui/corner-plus';
import { Button } from './ui/button';

interface PronunciationScoreCardProps {
  scoreData: PronunciationScoreData;
  targetLang?: string;
  studentLevel?: string;
}

export const PronunciationScoreCard: React.FC<PronunciationScoreCardProps> = ({
  scoreData,
  targetLang = 'en-US',
  studentLevel = 'B1',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedWord, setSelectedWord] = useState<PhonemeAccuracy | null>(
    scoreData.words_breakdown?.[0] || null
  );
  const [isPlayingReference, setIsPlayingReference] = useState(false);

  // Calcula ou obtém métricas de taxa de fala
  const cefrLevel: CEFRLevel = SpeechRateService.mapStudentLevelToCEFR(studentLevel);
  const speechRate =
    scoreData.speech_rate ||
    (scoreData.audio_duration_seconds && scoreData.recognized_text
      ? SpeechRateService.calculateSpeechRate(
          scoreData.recognized_text,
          scoreData.audio_duration_seconds,
          cefrLevel
        )
      : null);

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'text-amber-500 dark:text-amber-400';
    return 'text-rose-500 dark:text-rose-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 85) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400';
    return 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400';
  };

  const getWordStatusBadge = (status: PhonemeAccuracy['status']) => {
    switch (status) {
      case 'perfeito':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25';
      case 'bom':
        return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40 hover:bg-sky-500/25';
      case 'atencao':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25';
      case 'incorreto':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/25';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const handlePlayReference = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlayingReference) {
      SpeechService.stop();
      setIsPlayingReference(false);
      return;
    }

    setIsPlayingReference(true);
    SpeechService.speak(
      scoreData.recognized_text,
      {
        lang: targetLang,
        rate: 0.85,
        onEnd: () => setIsPlayingReference(false),
        onError: () => setIsPlayingReference(false),
      },
      `pron-card-${Date.now()}`
    );
  };

  const metrics = [
    { label: 'Acurácia Fonética', score: scoreData.accuracy_score, weight: '40%' },
    { label: 'Fluência & Ritmo', score: scoreData.fluency_score, weight: '30%' },
    { label: 'Prosódia & Entonação', score: scoreData.prosody_score, weight: '20%' },
    { label: 'Completude', score: scoreData.completeness_score, weight: '10%' },
  ];

  return (
    <div className="relative mt-2 border border-border/80 bg-card/95 rounded-lg p-3 sm:p-4 text-xs font-mono shadow-xs overflow-hidden select-text">
      <CornerPlus size="size-2" />

      {/* Cabeçalho Compacto do Score */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          {/* Circular Score Badge */}
          <div className="relative flex items-center justify-center w-11 h-11 rounded-full border border-border bg-muted/30">
            <svg className="w-11 h-11 transform -rotate-90">
              <circle
                cx="22"
                cy="22"
                r="18"
                stroke="currentColor"
                strokeWidth="3"
                className="text-muted/40"
                fill="transparent"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={113}
                strokeDashoffset={113 - (113 * scoreData.overall_score) / 100}
                strokeLinecap="round"
                className={getScoreColor(scoreData.overall_score)}
                fill="transparent"
              />
            </svg>
            <span className="absolute font-mono font-extrabold text-xs text-foreground">
              {scoreData.overall_score}%
            </span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-foreground text-xs uppercase tracking-tight flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-foreground" />
                Score de Pronúncia
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${getScoreBg(
                  scoreData.overall_score
                )}`}
              >
                {scoreData.overall_score >= 85
                  ? 'Excelente'
                  : scoreData.overall_score >= 70
                  ? 'Bom Desempenho'
                  : 'Atenção Fonética'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
              {scoreData.ponto_forte || 'Análise fonética e entonação computadas.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePlayReference}
            className="h-7 px-2 text-[10px] font-mono cursor-pointer gap-1"
            title="Ouvir pronúncia nativa de referência"
          >
            <Volume2 className={`w-3 h-3 ${isPlayingReference ? 'text-primary animate-pulse' : ''}`} />
            <span className="hidden sm:inline">Ouvir Nativo</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 px-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
            title={isExpanded ? 'Recolher detalhes' : 'Ver gráfico e IPA'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Visualizador de Palavras Rápido (Inline) */}
      <div className="mt-2.5 pt-2.5 border-t border-border flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase font-bold mr-1">
          Palavras:
        </span>
        {scoreData.words_breakdown?.map((wb, idx) => (
          <button
            key={idx}
            onClick={() => {
              setSelectedWord(wb);
              setIsExpanded(true);
            }}
            className={`text-[11px] px-2 py-0.5 rounded-md border font-mono transition-all cursor-pointer ${getWordStatusBadge(
              wb.status
            )} ${selectedWord?.word === wb.word && isExpanded ? 'ring-1 ring-foreground font-bold' : ''}`}
            title={`Acurácia: ${wb.accuracy}% • Clique para detalhes`}
          >
            {wb.word}
            <span className="text-[9px] opacity-75 ml-1 font-sans">{wb.accuracy}%</span>
          </button>
        ))}
      </div>

      {/* Painel Expandido: Gráficos de Precisão, Comparação IPA e Dicas Anatômicas */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-3 pt-3 border-t border-border space-y-3.5"
          >
            {/* 4 Dimensões de Precisão com Barras Animadas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {metrics.map((m, idx) => (
                <div key={idx} className="bg-muted/40 p-2 rounded border border-border space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="truncate">{m.label}</span>
                    <span className="font-bold text-foreground">{m.score}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden border border-border">
                    <motion.div
                      className={`h-full rounded-full ${
                        m.score >= 85
                          ? 'bg-emerald-500'
                          : m.score >= 70
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${m.score}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.05 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Comparativo Fonético (IPA Esperado vs Transcrito) */}
            <div className="bg-muted/30 p-2.5 rounded-lg border border-border space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-bold">
                <span>Comparação Fonética (IPA)</span>
                <span>International Phonetic Alphabet</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-card p-2 rounded border border-border">
                  <span className="text-[10px] text-muted-foreground block">Esperado (Padrão):</span>
                  <code className="text-foreground font-bold tracking-wider">
                    {scoreData.expected_phonetics_ipa || '/.../'}
                  </code>
                </div>
                <div className="bg-card p-2 rounded border border-border">
                  <span className="text-[10px] text-muted-foreground block">Sua Pronúncia:</span>
                  <code className={`font-bold tracking-wider ${getScoreColor(scoreData.overall_score)}`}>
                    {scoreData.transcribed_phonetics_ipa || '/.../'}
                  </code>
                </div>
              </div>
            </div>

            {/* Detalhe da Palavra Selecionada */}
            {selectedWord && (
              <div className="bg-card p-2.5 rounded-lg border border-border/80 flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-foreground text-xs">
                      Palavra: "{selectedWord.word}"
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Esperado: <code>{selectedWord.expected_ipa}</code> | Transcrito: <code>{selectedWord.transcribed_ipa}</code>
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedWord.feedback || 'Articulação clara e dentro dos parâmetros esperados.'}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${getWordStatusBadge(selectedWord.status)}`}>
                  {selectedWord.accuracy}%
                </span>
              </div>
            )}

            {/* Análise de Taxa de Fala Integrada (WPM) */}
            {speechRate && (
              <div className="border-t border-border/60 pt-2">
                <SpeechRateVisualizer
                  metrics={speechRate}
                  variant="compact"
                  allowLevelChange={true}
                />
              </div>
            )}

            {/* Dica Anatômica de Articulação da Boca & Língua */}
            {scoreData.dica_articulacao_boca && (
              <div className="bg-foreground text-background p-2.5 rounded-lg space-y-1">
                <div className="flex items-center space-x-1.5 text-[10px] uppercase font-bold tracking-tight">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Dica Anatômica de Articulação</span>
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed font-sans">
                  {scoreData.dica_articulacao_boca}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
