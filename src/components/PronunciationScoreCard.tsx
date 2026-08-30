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
    if (score >= 85) return 'text-[var(--ok)]';
    if (score >= 70) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 85) return 'bg-[var(--mint)] border-[var(--ok)]/30 text-[var(--ok)]';
    if (score >= 70) return 'bg-amber-100 border-amber-300 text-amber-800';
    return 'bg-rose-100 border-rose-300 text-rose-800';
  };

  const getWordStatusBadge = (status: PhonemeAccuracy['status']) => {
    switch (status) {
      case 'perfeito':
        return 'bg-[var(--mint)] text-[var(--ok)] border-[var(--ok)]/40 hover:bg-[var(--mint)]';
      case 'bom':
        return 'bg-[var(--sky)] text-sky-800 border-sky-300 hover:bg-[var(--sky)]';
      case 'atencao':
        return 'bg-[var(--sunny)] text-amber-900 border-amber-300 hover:bg-amber-100';
      case 'incorreto':
        return 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200';
      default:
        return 'bg-[oklch(0.96_0.01_84)] text-[var(--muted)] border-[var(--border)]';
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
    <div className="relative mt-2 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--r-sm)] p-3.5 sm:p-4 text-xs font-sans shadow-xs overflow-hidden select-text text-left">
      {/* Cabeçalho Compacto do Score */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          {/* Circular Score Badge */}
          <div className="relative flex items-center justify-center w-11 h-11 rounded-full border border-[var(--border)] bg-[oklch(0.96_0.01_84)]">
            <svg className="w-11 h-11 transform -rotate-90">
              <circle
                cx="22"
                cy="22"
                r="18"
                stroke="currentColor"
                strokeWidth="3"
                className="text-[oklch(0.90_0.02_84)]"
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
            <span className="absolute font-mono font-extrabold text-xs text-[var(--fg)]">
              {scoreData.overall_score}%
            </span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-display font-bold text-[var(--fg)] text-xs uppercase tracking-tight flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
                Score de Pronúncia
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase font-mono ${getScoreBg(
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
            <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-1">
              {scoreData.ponto_forte || 'Análise fonética e entonação computadas.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePlayReference}
            className="h-8 px-3 text-xs font-bold cursor-pointer gap-1.5 rounded-full"
            title="Ouvir pronúncia nativa de referência"
          >
            <Volume2 className={`w-3.5 h-3.5 ${isPlayingReference ? 'text-[var(--accent-deep)] animate-pulse' : ''}`} />
            <span className="hidden sm:inline">Ouvir Nativo</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0 rounded-full text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
            title={isExpanded ? 'Recolher detalhes' : 'Ver gráfico e IPA'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Visualizador de Palavras Rápido (Inline) */}
      <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-[var(--muted)] uppercase font-extrabold mr-1">
          Palavras:
        </span>
        {scoreData.words_breakdown?.map((wb, idx) => (
          <button
            key={idx}
            onClick={() => {
              setSelectedWord(wb);
              setIsExpanded(true);
            }}
            className={`text-xs px-2.5 py-1 rounded-full border font-mono transition-all cursor-pointer ${getWordStatusBadge(
              wb.status
            )} ${selectedWord?.word === wb.word && isExpanded ? 'ring-2 ring-[var(--fg)] font-bold' : ''}`}
            title={`Acurácia: ${wb.accuracy}% • Clique para detalhes`}
          >
            {wb.word}
            <span className="text-[10px] opacity-80 ml-1 font-sans font-bold">{wb.accuracy}%</span>
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
            className="mt-3 pt-3 border-t border-[var(--border)] space-y-3.5"
          >
            {/* 4 Dimensões de Precisão com Barras Animadas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {metrics.map((m, idx) => (
                <div key={idx} className="bg-[oklch(0.97_0.01_84)] p-2.5 rounded-xl border border-[var(--border)] space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span className="truncate">{m.label}</span>
                    <span className="font-bold text-[var(--fg)] font-mono">{m.score}%</span>
                  </div>
                  <div className="w-full bg-[oklch(0.92_0.02_84)] rounded-full h-2 overflow-hidden border border-[var(--border)]">
                    <motion.div
                      className={`h-full rounded-full ${
                        m.score >= 85
                          ? 'bg-[var(--ok)]'
                          : m.score >= 70
                          ? 'bg-[var(--sunny)]'
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
            <div className="bg-[oklch(0.97_0.01_84)] p-3 rounded-2xl border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[var(--muted)] uppercase font-extrabold">
                <span>Comparação Fonética (IPA)</span>
                <span>International Phonetic Alphabet</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--muted)] block">Esperado (Padrão):</span>
                  <code className="text-[var(--fg)] font-bold tracking-wider font-mono">
                    {scoreData.expected_phonetics_ipa || '/.../'}
                  </code>
                </div>
                <div className="bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--muted)] block">Sua Pronúncia:</span>
                  <code className={`font-bold tracking-wider font-mono ${getScoreColor(scoreData.overall_score)}`}>
                    {scoreData.transcribed_phonetics_ipa || '/.../'}
                  </code>
                </div>
              </div>
            </div>

            {/* Detalhe da Palavra Selecionada */}
            {selectedWord && (
              <div className="bg-[var(--surface)] p-3 rounded-2xl border border-[var(--border)] flex items-start justify-between gap-3">
                <div className="space-y-1 text-left">
                  <div className="flex items-center space-x-2">
                    <span className="font-display font-bold text-[var(--fg)] text-xs">
                      Palavra: "{selectedWord.word}"
                    </span>
                    <span className="text-[11px] text-[var(--muted)] font-mono">
                      Esperado: <code>{selectedWord.expected_ipa}</code> | Transcrito: <code>{selectedWord.transcribed_ipa}</code>
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {selectedWord.feedback || 'Articulação clara e dentro dos parâmetros esperados.'}
                  </p>
                </div>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase shrink-0 font-mono ${getWordStatusBadge(selectedWord.status)}`}>
                  {selectedWord.accuracy}%
                </span>
              </div>
            )}

            {/* Análise de Taxa de Fala Integrada (WPM) */}
            {speechRate && (
              <div className="border-t border-[var(--border)] pt-2">
                <SpeechRateVisualizer
                  metrics={speechRate}
                  variant="compact"
                  allowLevelChange={true}
                />
              </div>
            )}

            {/* Dica Anatômica de Articulação da Boca & Língua */}
            {scoreData.dica_articulacao_boca && (
              <div className="bg-[var(--fg)] text-[oklch(0.97_0.01_84)] p-3.5 rounded-2xl space-y-1 text-left shadow-xs">
                <div className="flex items-center space-x-1.5 text-xs uppercase font-extrabold tracking-tight text-[var(--sunny)]">
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  <span>Dica Anatômica de Articulação</span>
                </div>
                <p className="text-xs opacity-90 leading-relaxed font-sans">
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

