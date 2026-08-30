import React, { useState, useEffect } from 'react';
import {
  Volume2,
  BookOpen,
  Sparkles,
  Layers,
  CheckCircle,
  Plus,
  ArrowRight,
  AlertTriangle,
  Lightbulb,
  X,
  Mic,
  Copy,
  ExternalLink,
  Brain,
} from 'lucide-react';
import { WordContextInfo, GraphNode } from '../types';
import { wordContextService } from '../services/wordContextService';
import { SpeechService } from '../services/speechSynthesisService';
import { StorageService } from '../services/storage';
import { playSfx } from '../services/soundEffects';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CornerPlus } from './ui/corner-plus';

interface WordContextModalProps {
  word: string | null;
  sentenceContext?: string;
  language?: string;
  topic?: string;
  isOpen: boolean;
  onClose: () => void;
  onPracticePronunciation?: (word: string) => void;
  onAskTutor?: (question: string) => void;
}

export const WordContextModal: React.FC<WordContextModalProps> = ({
  word,
  sentenceContext = '',
  language = 'Inglês',
  topic = 'Conversação',
  isOpen,
  onClose,
  onPracticePronunciation,
  onAskTutor,
}) => {
  const [currentWord, setCurrentWord] = useState<string>(word || '');
  const [contextData, setContextData] = useState<WordContextInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [addedToSRS, setAddedToSRS] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (word) {
      setCurrentWord(word);
    }
  }, [word]);

  useEffect(() => {
    if (isOpen && currentWord) {
      loadWordDetails(currentWord);
    }
  }, [isOpen, currentWord, language, sentenceContext]);

  const loadWordDetails = async (targetWord: string) => {
    setIsLoading(true);
    setAddedToSRS(false);
    try {
      const data = await wordContextService.getWordContext(
        targetWord,
        sentenceContext,
        language,
        topic
      );
      setContextData(data);

      // Verifica se já está nos termos do grafo
      const nodes = StorageService.getNodes();
      const exists = nodes.some(
        (n) => n.titulo.toLowerCase().trim() === targetWord.toLowerCase().trim()
      );
      setAddedToSRS(exists);
    } catch (err) {
      console.error('Erro ao carregar contexto:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !currentWord) return null;

  const handlePlayWordAudio = async (textToPlay: string) => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    playSfx('pop');
    try {
      await SpeechService.speak(textToPlay, {
        rate: 0.9,
        useNeuralAI: true,
        onEnd: () => setIsPlayingAudio(false),
        onError: () => setIsPlayingAudio(false),
      });
    } catch {
      setIsPlayingAudio(false);
    }
  };

  const handleAddToFlashcards = () => {
    if (!contextData || addedToSRS) return;

    playSfx('success');
    const newNode: GraphNode = {
      id: `node-word-${Date.now()}`,
      tipo: contextData.falso_amigo_alerta ? 'falso_amigo' : 'vocabulario',
      titulo: contextData.palavra,
      descricao: `${contextData.traducao_principal} (${contextData.pronuncia_ipa}) - ${contextData.definicao_contextual}`,
      dominio_estimado: 40,
      dificuldade: contextData.nivel_cefr === 'C1' || contextData.nivel_cefr === 'C2' ? 4 : 3,
      frequencia_erro: 0,
      ultima_revisao: new Date().toISOString(),
      proxima_revisao: new Date().toISOString(),
      evidencias: [
        `Consultado e adicionado via chat no tópico "${topic}": "${sentenceContext || contextData.exemplos_uso?.[0]?.frase_original || contextData.palavra}"`,
      ],
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      idioma: contextData.idioma || language,
      traducao: contextData.traducao_principal,
      pronuncia_ipa: contextData.pronuncia_ipa,
      exemplo_uso: contextData.exemplos_uso?.[0]?.frase_original,
    };

    StorageService.addOrUpdateNode(newNode);
    setAddedToSRS(true);
  };

  const handleCopy = () => {
    if (!contextData) return;
    playSfx('click');
    const text = `${contextData.palavra} (${contextData.pronuncia_ipa}) - ${contextData.traducao_principal}\nExemplo: ${contextData.exemplos_uso?.[0]?.frase_original || ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectSynonym = (syn: string) => {
    playSfx('word_tap');
    setCurrentWord(syn);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] shadow-[var(--shadow)] w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh] text-[var(--fg)] animate-in zoom-in-95 duration-150"
        id="word-context-modal"
      >
        <CornerPlus />

        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface-raised)] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-[var(--r-sm)] bg-[var(--accent)] text-black flex items-center justify-center font-bold text-xs shadow-2xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-[var(--fg)] flex items-center gap-1.5 font-display">
                <span>Dicionário & Contexto Ativo</span>
              </h3>
              <p className="text-[10px] text-[var(--muted)] font-mono">
                {language} • Clique em sinônimos para explorar
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleCopy}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-md transition cursor-pointer"
              title="Copiar termo e tradução"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => {
                playSfx('pop');
                onClose();
              }}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-md transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Container */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm font-sans flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
              <div className="w-9 h-9 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              <p className="text-xs font-mono text-[var(--muted)]">
                Analisando semântica e fonética no contexto...
              </p>
            </div>
          ) : contextData ? (
            <>
              {/* Termo Principal, IPA & Pronúncia */}
              <div className="p-4 rounded-[var(--r-md)] bg-[var(--surface-raised)] border border-[var(--border)] space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h2 className="text-2xl font-bold font-display tracking-tight text-[var(--fg)]">
                        {contextData.palavra}
                      </h2>
                      {contextData.lemma_raiz &&
                        contextData.lemma_raiz.toLowerCase() !==
                          contextData.palavra.toLowerCase() && (
                          <span className="text-xs text-[var(--muted)] font-mono">
                            (raiz: <em>{contextData.lemma_raiz}</em>)
                          </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap font-mono text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--accent-deep)] font-bold">
                        {contextData.pronuncia_ipa}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-[var(--muted)]">
                        {contextData.classe_gramatical}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-[var(--surface)] text-[10px] font-bold border border-[var(--border)]">
                        {contextData.nivel_cefr}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePlayWordAudio(contextData.palavra)}
                    disabled={isPlayingAudio}
                    className="p-2.5 rounded-full bg-[var(--accent)] text-black hover:opacity-90 transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5 text-xs font-bold shrink-0 disabled:opacity-50"
                    title="Ouvir pronúncia natural"
                  >
                    <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'animate-bounce' : ''}`} />
                    <span className="hidden sm:inline">Ouvir</span>
                  </button>
                </div>

                {/* Tradução Principal */}
                <div className="pt-2 border-t border-[var(--border)]">
                  <div className="text-xs text-[var(--muted)] uppercase font-bold tracking-wider font-mono">
                    TRADUÇÃO & SIGNIFICADO:
                  </div>
                  <div className="text-base font-bold text-[var(--fg)] mt-0.5">
                    {contextData.traducao_principal}
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                    {contextData.definicao_contextual}
                  </p>
                </div>
              </div>

              {/* Alerta de Falso Cognato / Falso Amigo (se houver) */}
              {contextData.falso_amigo_alerta && (
                <div className="p-3 rounded-[var(--r-md)] bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-950 font-mono text-[11px] uppercase">
                      Alerta de Falso Amigo:
                    </div>
                    <p className="mt-0.5 leading-relaxed font-sans">{contextData.falso_amigo_alerta}</p>
                  </div>
                </div>
              )}

              {/* Dica de Uso & Collocation */}
              {contextData.dica_uso_ou_collocation && (
                <div className="p-3 rounded-[var(--r-md)] bg-[var(--surface-raised)] border border-[var(--border)] text-xs flex items-start gap-2.5">
                  <Lightbulb className="w-4 h-4 text-[var(--accent-deep)] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[var(--fg)] font-mono text-[10px] uppercase">
                      Dica de Colocação & Padrão:
                    </div>
                    <p className="text-[var(--muted)] mt-0.5 leading-relaxed font-sans">
                      {contextData.dica_uso_ou_collocation}
                    </p>
                  </div>
                </div>
              )}

              {/* Sinônimos & Antônimos */}
              <div className="space-y-2">
                <div className="text-xs font-bold font-mono uppercase text-[var(--muted)] flex items-center justify-between">
                  <span>Sinônimos Interativos:</span>
                  <span className="text-[10px] lowercase text-[var(--muted)] font-normal">
                    (clique para ver contexto)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {contextData.sinonimos?.map((syn, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSynonym(syn)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--surface-raised)] hover:bg-[var(--accent)] hover:text-black border border-[var(--border)] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      title={`Ver contexto de "${syn}"`}
                    >
                      <span>{syn}</span>
                      <ArrowRight className="w-2.5 h-2.5 opacity-50" />
                    </button>
                  ))}
                </div>

                {contextData.antonimos && contextData.antonimos.length > 0 && (
                  <div className="pt-1.5 flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-[10px] font-mono uppercase text-[var(--muted)] font-bold">
                      Antônimos:
                    </span>
                    {contextData.antonimos.map((ant, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 border border-rose-500/20 text-[11px] font-medium"
                      >
                        {ant}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Frases de Exemplo em Contexto */}
              <div className="space-y-2">
                <div className="text-xs font-bold font-mono uppercase text-[var(--muted)]">
                  Exemplos de Uso no Cotidiano:
                </div>
                <div className="space-y-2">
                  {contextData.exemplos_uso?.map((ex, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-[var(--r-sm)] bg-[var(--surface-raised)] border border-[var(--border)] text-xs space-y-1 relative group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[var(--fg)] leading-relaxed">
                          "{ex.frase_original}"
                        </p>
                        <button
                          onClick={() => handlePlayWordAudio(ex.frase_original)}
                          className="p-1 text-[var(--muted)] hover:text-[var(--fg)] rounded transition cursor-pointer shrink-0"
                          title="Ouvir frase completa"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[var(--muted)] text-[11px] italic">
                        {ex.traducao_portugues}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-[var(--muted)] text-xs">
              Não foi possível carregar os dados para "{currentWord}".
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-[var(--surface-raised)] border-t border-[var(--border)] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center space-x-2">
            <Button
              variant={addedToSRS ? 'outline' : 'default'}
              size="sm"
              onClick={handleAddToFlashcards}
              disabled={addedToSRS || !contextData}
              className={`gap-1.5 text-xs font-bold cursor-pointer rounded-full ${
                addedToSRS ? 'text-emerald-600 border-emerald-500/30' : ''
              }`}
            >
              {addedToSRS ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Salvo nos Flashcards</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar aos Flashcards (SRS)</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {onPracticePronunciation && contextData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  playSfx('click');
                  onPracticePronunciation(contextData.palavra);
                  onClose();
                }}
                className="gap-1 text-xs font-bold cursor-pointer rounded-full"
                title="Praticar pronúncia desta palavra"
              >
                <Mic className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
                <span>Praticar</span>
              </Button>
            )}

            {onAskTutor && contextData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  playSfx('click');
                  onAskTutor(
                    `Como posso usar a palavra "${contextData.palavra}" (${contextData.traducao_principal}) em uma conversa formal no trabalho?`
                  );
                  onClose();
                }}
                className="gap-1 text-xs font-bold cursor-pointer rounded-full"
                title="Pedir explicação mais aprofundada ao tutor no chat"
              >
                <Brain className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
                <span>Perguntar ao Tutor</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
