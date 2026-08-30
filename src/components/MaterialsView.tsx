import React, { useState, useEffect } from 'react';
import {
  Youtube,
  FileText,
  Sparkles,
  BookOpen,
  Volume2,
  CheckCircle2,
  Brain,
  Share2,
  Trash2,
  Play,
  RotateCw,
  Plus,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  Layers,
  ChevronRight,
  UploadCloud,
  Check,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  StudyMaterialItem,
  VocabularyItem,
  GrammarItem,
  DialogueLine,
  FlashcardItem,
  ComprehensionQuestion,
  GraphNode,
  GraphRelation,
} from '../types';
import { StorageService } from '../services/storage';
import { GraphEngine } from '../services/graphEngine';
import { SpeechService } from '../services/speechSynthesisService';
import { CornerPlus } from './ui/corner-plus';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface MaterialsViewProps {
  onPracticeInChat?: (topic: string, language: string) => void;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({ onPracticeInChat }) => {
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterialItem | null>(null);
  const [activeTab, setActiveTab] = useState<'vocab' | 'grammar' | 'dialogue' | 'flashcards' | 'quiz'>('vocab');

  // Formulário de Criação
  const [sourceType, setSourceType] = useState<'youtube' | 'texto' | 'arquivo'>('youtube');
  const [targetLanguage, setTargetLanguage] = useState<string>('Inglês');
  const [targetCefr, setTargetCefr] = useState<string>('B1');
  const [youtubeUrl, setYoutubeUrl] = useState<string>('https://www.youtube.com/watch?v=kpv2B883bH4');
  const [textContent, setTextContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Estados dos Flashcards
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Estados do Quiz
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Estado de sincronização com o Grafo
  const [syncedToGraph, setSyncedToGraph] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  useEffect(() => {
    const list = StorageService.getMaterials();
    setMaterials(list);
    if (list.length > 0) {
      setSelectedMaterial(list[0]);
    }
  }, []);

  // Extrai ID do YouTube
  const getYouTubeId = (url: string) => {
    if (!url) return '';
    const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : '';
  };

  // Reprodução de Áudio TTS via SpeechService Inteligente
  const speakText = (text: string, lang?: string) => {
    const langMap: Record<string, string> = {
      Inglês: 'en-US',
      Espanhol: 'es-ES',
      Francês: 'fr-FR',
      Alemão: 'de-DE',
      Italiano: 'it-IT',
      Japonês: 'ja-JP',
      Mandarim: 'zh-CN',
    };
    const targetLang = lang || langMap[targetLanguage] || 'en-US';
    SpeechService.speak(text, {
      lang: targetLang,
      rate: 0.88,
    });
  };

  // Geração de Novo Material
  const handleGenerateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerationError(null);

    const sourceData = sourceType === 'youtube' ? youtubeUrl.trim() : textContent.trim();
    if (!sourceData) {
      setGenerationError('Por favor, informe a URL do YouTube ou cole um texto de estudo.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/materials/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conteudo_ou_url: sourceData,
          tipo_fonte: sourceType,
          idioma_alvo: targetLanguage,
          nivel_cefr: targetCefr,
        }),
      });

      if (!res.ok) {
        throw new Error(`Erro do servidor: ${res.status}`);
      }

      const newMaterial: StudyMaterialItem = await res.json();
      StorageService.addMaterial(newMaterial);
      setMaterials(StorageService.getMaterials());
      setSelectedMaterial(newMaterial);
      setShowCreateForm(false);
      setTextContent('');
      setYoutubeUrl('');
      setCurrentCardIndex(0);
      setIsCardFlipped(false);
      setSelectedQuizAnswers({});
      setQuizSubmitted(false);
      setSyncedToGraph(false);

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error('Falha ao gerar material:', err);
      setGenerationError(err.message || 'Falha ao processar material com IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Upload de arquivo de texto (.txt, .md, .srt, .vtt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setTextContent(text);
        setSourceType('arquivo');
      };
      reader.readAsText(file);
    }
  };

  // Sincronizar Vocabulário e Gramática do Material com o Grafo de Memória
  const handleSyncToGraph = () => {
    if (!selectedMaterial) return;
    const now = new Date().toISOString();

    // 1. Cria ou recupera o nó tópico do idioma
    const topicTitle = `${selectedMaterial.idioma_alvo} Conversacional`;
    const existingNodes = StorageService.getNodes();
    let topicNode = existingNodes.find((n) => n.titulo.toLowerCase() === topicTitle.toLowerCase());

    if (!topicNode) {
      topicNode = {
        id: `node-topic-${Date.now()}`,
        tipo: 'topico',
        titulo: topicTitle,
        descricao: `Trilha de aprendizado e vocabulário de ${selectedMaterial.idioma_alvo}.`,
        dominio_estimado: 70,
        dificuldade: 3,
        frequencia_erro: 0,
        ultima_revisao: now,
        proxima_revisao: new Date(Date.now() + 86400000 * 3).toISOString(),
        evidencias: ['Criado a partir do Estúdio de Materiais'],
        criado_em: now,
        atualizado_em: now,
        idioma: selectedMaterial.idioma_alvo,
      };
      StorageService.addOrUpdateNode(topicNode);
    }

    // 2. Adiciona nós de vocabulário
    (selectedMaterial.vocabulario || []).forEach((voc, idx) => {
      const isFalseFriend = voc.termo.toLowerCase().includes('actual') || voc.termo.toLowerCase().includes('pretend');
      const vNodeId = `node-voc-${Date.now()}-${idx}`;
      const vNode: GraphNode = {
        id: vNodeId,
        tipo: isFalseFriend ? 'falso_amigo' : 'vocabulario',
        titulo: voc.termo,
        descricao: `${voc.traducao}. Exemplo: "${voc.exemplo}"`,
        dominio_estimado: 65,
        dificuldade: voc.nivel === 'C1' || voc.nivel === 'C2' ? 4 : 2,
        frequencia_erro: 0,
        ultima_revisao: now,
        proxima_revisao: new Date(Date.now() + 86400000 * 2).toISOString(),
        evidencias: [`Material: ${selectedMaterial.titulo}`],
        criado_em: now,
        atualizado_em: now,
        pronuncia_ipa: voc.pronuncia_ipa,
        traducao: voc.traducao,
        exemplo_uso: voc.exemplo,
        topico_pai: topicNode!.id,
        idioma: selectedMaterial.idioma_alvo,
      };
      StorageService.addOrUpdateNode(vNode);

      StorageService.addRelation({
        id: `rel-${vNodeId}-${topicNode!.id}`,
        origem_id: vNode.id,
        destino_id: topicNode!.id,
        tipo: 'relacionado_a',
        peso: 0.9,
        descricao: 'Pertence ao vocabulário do material',
        criado_em: now,
      });
    });

    // 3. Adiciona nós de gramática
    (selectedMaterial.gramatica || []).forEach((gram, idx) => {
      const gNodeId = `node-gram-${Date.now()}-${idx}`;
      const gNode: GraphNode = {
        id: gNodeId,
        tipo: 'gramatica',
        titulo: gram.topico,
        descricao: gram.explicacao,
        dominio_estimado: 60,
        dificuldade: 3,
        frequencia_erro: 0,
        ultima_revisao: now,
        proxima_revisao: new Date(Date.now() + 86400000 * 3).toISOString(),
        evidencias: [`Material: ${selectedMaterial.titulo}`],
        criado_em: now,
        atualizado_em: now,
        topico_pai: topicNode!.id,
        idioma: selectedMaterial.idioma_alvo,
      };
      StorageService.addOrUpdateNode(gNode);

      StorageService.addRelation({
        id: `rel-${gNodeId}-${topicNode!.id}`,
        origem_id: gNode.id,
        destino_id: topicNode!.id,
        tipo: 'pre_requisito_de',
        peso: 0.85,
        descricao: 'Regra gramatical chave do material',
        criado_em: now,
      });
    });

    selectedMaterial.adicionado_ao_grafo = true;
    StorageService.updateMaterial(selectedMaterial);
    setSyncedToGraph(true);

    confetti({
      particleCount: 50,
      spread: 50,
      origin: { y: 0.7 },
    });
  };

  // Excluir Material
  const handleDeleteMaterial = (id: string) => {
    if (window.confirm('Tem certeza de que deseja excluir este material de estudos?')) {
      StorageService.deleteMaterial(id);
      const remaining = StorageService.getMaterials();
      setMaterials(remaining);
      setSelectedMaterial(remaining.length > 0 ? remaining[0] : null);
    }
  };

  // Copiar Markdown do Material
  const handleCopyMarkdown = () => {
    if (selectedMaterial) {
      navigator.clipboard.writeText(selectedMaterial.conteudo_markdown || selectedMaterial.resumo);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2500);
    }
  };

  // Praticar no Chat
  const handleStartPracticeInChat = () => {
    if (selectedMaterial && onPracticeInChat) {
      onPracticeInChat(selectedMaterial.titulo, selectedMaterial.idioma_alvo);
    }
  };

  const presetExamples = [
    {
      title: 'Connected Speech & Intonation (YouTube)',
      type: 'youtube' as const,
      url: 'https://www.youtube.com/watch?v=kpv2B883bH4',
      lang: 'Inglês',
      cefr: 'B2',
    },
    {
      title: 'Business Phrasal Verbs in Negotiation (Texto)',
      type: 'texto' as const,
      content: `In international business meetings, negotiating deals requires tactful phrasing and precise phrasal verbs. For instance, you should never turn down an offer abruptly. Instead, suggest that you look over the proposal and get back to them tomorrow. Phrases like "Let's iron out the details", "We need to bring up budget concerns", and "I look forward to wrapping this up" show confidence and professional fluency.`,
      lang: 'Inglês',
      cefr: 'C1',
    },
    {
      title: 'Ordering Tapas & Coffee in Madrid (Diálogo)',
      type: 'texto' as const,
      content: `Camarero: ¡Buenas tardes! ¿Qué les pongo de beber?
Turista: Buenas tardes. Para mí, un café con leche templada y una ración de tortilla española, por favor.
Camarero: ¿La tortilla la quiere con o sin cebolla?
Turista: Con cebolla, por supuesto. ¿Me podría traer también un vaso de agua fresca?
Camarero: ¡Enseguida se lo traigo!`,
      lang: 'Espanhol',
      cefr: 'A2',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header com Botão de Criação */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-lg border border-border shadow-2xs">
        <CornerPlus />
        <div>
          <div className="flex items-center space-x-2">
            <div className="inline-flex items-center rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground uppercase">
              STUDY SUITE
            </div>
            <span className="px-2 py-0.5 rounded border border-border bg-muted font-mono text-[10px] font-semibold text-foreground">
              VÍDEOS & TEXTOS COM IA
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mt-1">
            Estúdio de Materiais & Imersão
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground font-mono mt-0.5">
            Transforme links do YouTube, textos, artigos e diálogos em kits de estudos estruturados
            com transcrição fonética IPA, gramática contrastiva e flashcards.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          size="sm"
          className="gap-1.5 font-mono text-xs cursor-pointer shadow-2xs"
        >
          <Plus className="w-4 h-4" />
          <span>{showCreateForm ? 'Fechar Formulário' : 'Novo Material'}</span>
        </Button>
      </div>

      {/* Formulário de Criação / Geração de Material */}
      {showCreateForm && (
        <form
          onSubmit={handleGenerateMaterial}
          className="relative bg-card p-6 rounded-lg border border-border shadow-md space-y-5 animate-in fade-in duration-200 font-mono"
        >
          <CornerPlus />
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-foreground" />
              <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                Transformar Fonte em Kit de Estudos
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">Processado via Gemini AI</span>
          </div>

          {/* Seletores de Idioma e Nível */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Idioma Alvo:
              </label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="Inglês">🇺🇸 Inglês (English)</option>
                <option value="Espanhol">🇪🇸 Espanhol (Español)</option>
                <option value="Francês">🇫🇷 Francês (Français)</option>
                <option value="Alemão">🇩🇪 Alemão (Deutsch)</option>
                <option value="Italiano">🇮🇹 Italiano (Italiano)</option>
                <option value="Japonês">🇯🇵 Japonês (日本語)</option>
                <option value="Mandarim">🇨🇳 Mandarim (中文)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Nível Alvo (Quadro Europeu CEFR):
              </label>
              <select
                value={targetCefr}
                onChange={(e) => setTargetCefr(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="A1">A1 - Iniciante Absoluto</option>
                <option value="A2">A2 - Básico / Elementar</option>
                <option value="B1">B1 - Intermediário Conversacional</option>
                <option value="B2">B2 - Intermediário Superior (Fluência Cotidiana)</option>
                <option value="C1">C1 - Avançado / Profissional</option>
                <option value="C2">C2 - Domínio Pleno / Nativo</option>
              </select>
            </div>
          </div>

          {/* Tipo de Fonte: Tabs */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-2 font-mono">
              Tipo de Fonte:
            </label>
            <div className="flex gap-2 p-1 bg-[oklch(0.94_0.01_84)] rounded-full w-fit">
              <button
                type="button"
                onClick={() => setSourceType('youtube')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                  sourceType === 'youtube'
                    ? 'bg-[var(--surface)] text-rose-600 shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                <Youtube className="w-3.5 h-3.5" />
                <span>Vídeo do YouTube</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType('texto')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                  sourceType === 'texto'
                    ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Texto / Artigo</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType('arquivo')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                  sourceType === 'arquivo'
                    ? 'bg-[var(--mint)] text-[var(--ok)] shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Arquivo (.txt / .md / legendas)</span>
              </button>
            </div>
          </div>

          {/* Entrada Específica do Tipo de Fonte */}
          {sourceType === 'youtube' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[var(--muted)] font-mono">
                Link do Vídeo no YouTube:
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-md)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--fg)]"
                />
              </div>

              {/* Preview do Vídeo do YouTube se URL for válida */}
              {getYouTubeId(youtubeUrl) && (
                <div className="p-3 bg-[oklch(0.96_0.01_84)] border border-[var(--border)] rounded-[var(--r-md)] flex items-center gap-3">
                  <img
                    src={`https://img.youtube.com/vi/${getYouTubeId(youtubeUrl)}/mqdefault.jpg`}
                    alt="Thumbnail"
                    className="w-24 h-16 object-cover rounded-lg border border-[var(--border)]"
                  />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-[var(--fg)]">Vídeo Detectado</p>
                    <p className="text-[var(--muted)] font-mono text-[11px]">ID: {getYouTubeId(youtubeUrl)}</p>
                    <span className="inline-block text-[10px] text-[var(--ok)] bg-[var(--mint)] px-2 py-0.5 rounded-full border border-[var(--ok)]/30">
                      Pronto para extração de transcrição e vocabulário
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {sourceType === 'texto' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[var(--muted)] font-mono">
                Cole o Texto, Diálogo ou Artigo:
              </label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Cole um diálogo em inglês, um parágrafo de notícia, transcrição de podcast ou conversa..."
                rows={5}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-md)] p-3 text-xs sm:text-sm text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--fg)] font-mono"
              />
            </div>
          )}

          {sourceType === 'arquivo' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[var(--muted)] font-mono">
                Selecione o Arquivo de Texto ou Legenda (.txt, .md, .srt, .vtt):
              </label>
              <div className="border-2 border-dashed border-[var(--border)] hover:border-[var(--fg)]/40 rounded-[var(--r-lg)] p-6 text-center bg-[oklch(0.97_0.01_84)] transition">
                <input
                  type="file"
                  accept=".txt,.md,.srt,.vtt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload-input"
                />
                <label
                  htmlFor="file-upload-input"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <UploadCloud className="w-8 h-8 text-[var(--fg)]" />
                  <span className="text-xs sm:text-sm font-semibold text-[var(--fg)]">
                    Clique para selecionar ou arraste o arquivo aqui
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    Suporta arquivos de texto e legendas de vídeos (.srt / .vtt)
                  </span>
                </label>
              </div>

              {textContent && (
                <div className="p-3 bg-[oklch(0.96_0.01_84)] rounded-[var(--r-md)] border border-[var(--border)] text-xs font-mono max-h-32 overflow-y-auto">
                  <p className="font-semibold text-[var(--fg)] mb-1">Prévia do Conteúdo Carregado:</p>
                  <p className="text-[var(--muted)] line-clamp-3">{textContent}</p>
                </div>
              )}
            </div>
          )}

          {/* Exemplos Rápidos */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
            <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider block font-mono">
              Ou escolha um modelo de exemplo:
            </span>
            <div className="flex flex-wrap gap-2">
              {presetExamples.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSourceType(ex.type);
                    setTargetLanguage(ex.lang);
                    setTargetCefr(ex.cefr);
                    if (ex.type === 'youtube') {
                      setYoutubeUrl(ex.url);
                    } else {
                      setTextContent(ex.content || '');
                    }
                  }}
                  className="text-xs px-2.5 py-1 rounded-full bg-[oklch(0.96_0.01_84)] hover:bg-[var(--fg)] hover:text-[var(--bg)] text-[var(--fg)] border border-[var(--border)] transition font-medium cursor-pointer font-mono"
                >
                  ⚡ {ex.title}
                </button>
              ))}
            </div>
          </div>

          {generationError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-[var(--r-md)] border border-rose-200">
              {generationError}
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 rounded-full text-xs font-semibold text-[var(--muted)] hover:bg-[oklch(0.96_0.01_84)] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="flex items-center space-x-2 px-5 py-2.5 bg-[var(--fg)] hover:bg-[var(--fg)]/90 text-[var(--bg)] rounded-full text-xs sm:text-sm font-semibold transition disabled:opacity-50 shadow-xs cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Extraindo Vocabulário & Estruturas...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                  <span>Gerar Kit de Estudos com IA</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Grid Principal: Lista Lateral de Materiais + Visualizador do Material Selecionado */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna 1: Lista de Materiais Cadastrados */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between font-mono">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Seus Materiais ({materials.length})
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {materials.reduce((acc, m) => acc + (m.vocabulario?.length || 0), 0)} termos salvos
            </span>
          </div>

          {materials.length === 0 ? (
            <div className="relative bg-card p-8 rounded-lg border border-border text-center space-y-3 shadow-2xs font-mono">
              <CornerPlus />
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">Nenhum material adicionado ainda.</p>
              <Button
                onClick={() => setShowCreateForm(true)}
                variant="outline"
                size="sm"
                className="text-xs cursor-pointer"
              >
                + Adicionar Primeiro Material
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {materials.map((mat) => {
                const isSelected = selectedMaterial?.id === mat.id;
                const isYt = mat.tipo_fonte === 'youtube';
                return (
                  <div
                    key={mat.id}
                    onClick={() => {
                      setSelectedMaterial(mat);
                      setCurrentCardIndex(0);
                      setIsCardFlipped(false);
                      setSelectedQuizAnswers({});
                      setQuizSubmitted(false);
                    }}
                    className={`relative p-3.5 rounded-lg border text-left cursor-pointer transition-all shadow-2xs ${
                      isSelected
                        ? 'bg-card border-foreground/50 ring-1 ring-foreground/20'
                        : 'bg-card/80 border-border hover:bg-card hover:border-border/80'
                    }`}
                  >
                    <CornerPlus size="size-3" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-1.5 font-mono">
                        {isYt ? (
                          <span className="p-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <Youtube className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="p-1 rounded bg-muted text-foreground border border-border">
                            <FileText className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
                          {mat.idioma_alvo} • {mat.nivel_cefr}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMaterial(mat.id);
                        }}
                        className="text-muted-foreground hover:text-rose-500 p-1 transition cursor-pointer"
                        title="Excluir material"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h4 className="text-xs sm:text-sm font-semibold text-foreground mt-2 line-clamp-2">
                      {mat.titulo}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border font-mono">
                      <span>{mat.vocabulario?.length || 0} vocábulos • {mat.flashcards?.length || 0} cards</span>
                      {mat.adicionado_ao_grafo ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-0.5 font-medium">
                          <Check className="w-3 h-3" />
                          <span>No Grafo</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Pendente</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coluna 2: Detalhes e Estudo Interativo do Material Selecionado */}
        <div className="lg:col-span-8 space-y-4">
          {selectedMaterial ? (
            <div className="relative bg-card rounded-lg border border-border shadow-2xs overflow-hidden">
              <CornerPlus />
              {/* Header do Material Selecionado */}
              <div className="p-5 border-b border-border bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1 font-mono">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-foreground text-background">
                        {selectedMaterial.idioma_alvo}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-muted border border-border text-foreground">
                        Nível {selectedMaterial.nivel_cefr}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Criado em {new Date(selectedMaterial.criado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                      {selectedMaterial.titulo}
                    </h3>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={handleStartPracticeInChat}
                      size="sm"
                      className="gap-1.5 font-mono text-xs cursor-pointer shadow-2xs"
                      title="Abrir o Tutor de Línguas e praticar este material"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Praticar no Chat</span>
                    </Button>

                    <Button
                      onClick={handleSyncToGraph}
                      disabled={syncedToGraph || selectedMaterial.adicionado_ao_grafo}
                      variant="outline"
                      size="sm"
                      className={`gap-1.5 font-mono text-xs cursor-pointer ${
                        syncedToGraph || selectedMaterial.adicionado_ao_grafo
                          ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                          : ''
                      }`}
                      title="Salvar vocabulário no Grafo de Memória do aluno"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>
                        {syncedToGraph || selectedMaterial.adicionado_ao_grafo
                          ? 'Salvo no Grafo'
                          : 'Salvar no Grafo'}
                      </span>
                    </Button>

                    <button
                      onClick={handleCopyMarkdown}
                      className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                      title="Copiar Guia em Markdown"
                    >
                      {copiedMarkdown ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Share2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Player de YouTube Embutido ou Resumo */}
                {selectedMaterial.tipo_fonte === 'youtube' && selectedMaterial.youtube_video_id && (
                  <div className="mt-4 rounded-[var(--r-md)] overflow-hidden border border-[var(--border)] bg-black aspect-video max-h-64 sm:max-h-72 w-full">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${selectedMaterial.youtube_video_id}`}
                      title={selectedMaterial.titulo}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                )}

                {/* Resumo do Material */}
                <p className="text-xs sm:text-sm text-[var(--muted)] mt-3 leading-relaxed">
                  {selectedMaterial.resumo}
                </p>
              </div>

              {/* Abas Interativas de Estudo */}
              <div className="border-b border-[var(--border)] px-4 bg-[var(--surface)] flex space-x-1 overflow-x-auto font-mono">
                <button
                  onClick={() => setActiveTab('vocab')}
                  className={`flex items-center space-x-2 py-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                    activeTab === 'vocab'
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Vocabulário & Fonética ({selectedMaterial.vocabulario?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('grammar')}
                  className={`flex items-center space-x-2 py-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                    activeTab === 'grammar'
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>Gramática & Dicas ({selectedMaterial.gramatica?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('dialogue')}
                  className={`flex items-center space-x-2 py-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                    activeTab === 'dialogue'
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Diálogo de Roleplay ({selectedMaterial.dialogo_pratica?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('flashcards')}
                  className={`flex items-center space-x-2 py-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                    activeTab === 'flashcards'
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Flashcards ({selectedMaterial.flashcards?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('quiz')}
                  className={`flex items-center space-x-2 py-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                    activeTab === 'quiz'
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Quiz ({selectedMaterial.questoes_compreensao?.length || 0})</span>
                </button>
              </div>

              {/* Conteúdo da Aba Ativa */}
              <div className="p-5">
                {/* 1. ABA: VOCABULÁRIO & FONÉTICA IPA */}
                {activeTab === 'vocab' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {(selectedMaterial.vocabulario || []).map((voc, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[oklch(0.97_0.01_84)] hover:bg-[var(--surface)] hover:border-[var(--fg)]/40 transition space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm sm:text-base font-display font-bold text-[var(--fg)]">
                                  {voc.termo}
                                </h4>
                                {voc.pronuncia_ipa && (
                                  <span className="text-xs font-mono text-[var(--fg)] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                                    {voc.pronuncia_ipa}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-semibold text-[var(--muted)] mt-0.5">
                                {voc.traducao}
                              </p>
                            </div>

                            <button
                              onClick={() => speakText(voc.termo)}
                              className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[oklch(0.94_0.01_84)] rounded-full transition cursor-pointer"
                              title="Ouvir Pronúncia"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] font-mono">
                            {voc.classe_gramatical && (
                              <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)] font-medium">
                                {voc.classe_gramatical}
                              </span>
                            )}
                            {voc.nivel && (
                              <span className="px-1.5 py-0.5 rounded bg-[var(--mint)] border border-[var(--ok)]/30 text-[var(--ok)] font-bold">
                                {voc.nivel}
                              </span>
                            )}
                          </div>

                          {voc.exemplo && (
                            <div className="pt-2 border-t border-[var(--border)] text-xs space-y-1">
                              <p className="text-[var(--fg)] font-medium italic">"{voc.exemplo}"</p>
                              {voc.traducao_exemplo && (
                                <p className="text-[var(--muted)] text-[11px]">→ {voc.traducao_exemplo}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Dicas de Pronúncia e Culturais */}
                    {selectedMaterial.dicas_culturais_e_pronuncia &&
                      selectedMaterial.dicas_culturais_e_pronuncia.length > 0 && (
                        <div className="p-4 bg-[var(--sunny)]/15 border border-[var(--sunny)]/40 rounded-[var(--r-md)] space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--fg)] font-mono block">
                            💡 Dicas de Pronúncia & Ritmo Natural:
                          </span>
                          <ul className="text-xs text-[var(--fg)] space-y-1 list-disc list-inside">
                            {selectedMaterial.dicas_culturais_e_pronuncia.map((dica, i) => (
                              <li key={i}>{dica}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}

                {/* 2. ABA: GRAMÁTICA & DICAS PARA BRASILEIROS */}
                {activeTab === 'grammar' && (
                  <div className="space-y-4">
                    {(selectedMaterial.gramatica || []).map((gram, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] space-y-3 shadow-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-bold text-xs flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm font-display font-bold text-[var(--fg)]">{gram.topico}</h4>
                        </div>

                        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                          {gram.explicacao}
                        </p>

                        {/* Exemplos Práticos */}
                        {gram.exemplos && gram.exemplos.length > 0 && (
                          <div className="p-3 bg-[oklch(0.97_0.01_84)] rounded-[var(--r-md)] border border-[var(--border)] text-xs space-y-1 font-mono">
                            <span className="text-[var(--muted)] font-sans font-semibold block text-[11px]">
                              Exemplos Práticos:
                            </span>
                            {gram.exemplos.map((ex, i) => (
                              <p key={i} className="text-[var(--fg)]">
                                • {ex}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Dica de Transferência para Falantes de Português */}
                        {gram.dica_para_brasileiros && (
                          <div className="p-3 bg-[var(--mint)] border border-[var(--ok)]/30 rounded-[var(--r-md)] text-xs text-[var(--fg)]">
                            <span className="font-bold text-[var(--ok)] block mb-0.5">
                              🇧🇷 Atenção Especial para Brasileiros:
                            </span>
                            {gram.dica_para_brasileiros}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. ABA: DIÁLOGO DE ROLEPLAY */}
                {activeTab === 'dialogue' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-[var(--mint)] p-3 rounded-[var(--r-md)] border border-[var(--ok)]/30">
                      <span className="text-xs text-[var(--fg)] font-medium">
                        Pratique lendo em voz alta ou usando a ferramenta de voz para treinar sua entonação natural.
                      </span>
                      <button
                        onClick={handleStartPracticeInChat}
                        className="text-xs font-bold text-[var(--ok)] hover:underline flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Simular no Chat</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(selectedMaterial.dialogo_pratica || []).map((line, idx) => (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-[var(--r-md)] border ${
                            idx % 2 === 0
                              ? 'bg-[var(--surface)] border-[var(--border)]'
                              : 'bg-[oklch(0.97_0.01_84)] border-[var(--border)]'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="w-7 h-7 rounded-full bg-[var(--fg)] text-[var(--bg)] text-xs font-bold flex items-center justify-center font-mono">
                                {line.personagem[0]}
                              </span>
                              <span className="text-xs font-bold text-[var(--fg)] font-mono">
                                {line.personagem}
                              </span>
                            </div>

                            <button
                              onClick={() => speakText(line.fala)}
                              className="text-[var(--muted)] hover:text-[var(--fg)] p-1 cursor-pointer"
                              title="Ouvir Fala"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>

                          <p className="text-xs sm:text-sm font-semibold text-[var(--fg)] mt-2 pl-9">
                            "{line.fala}"
                          </p>

                          {line.traducao && (
                            <p className="text-xs text-[var(--muted)] pl-9 mt-0.5">
                              → {line.traducao}
                            </p>
                          )}

                          {line.audio_tip && (
                            <div className="mt-2 ml-9 text-[11px] text-[var(--ok)] bg-[var(--mint)] px-2 py-0.5 rounded-full border border-[var(--ok)]/30 w-fit font-mono">
                              🎙️ {line.audio_tip}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. ABA: FLASHCARDS INTERATIVOS 3D / FLIP */}
                {activeTab === 'flashcards' && (
                  <div className="space-y-4 max-w-lg mx-auto py-2">
                    {selectedMaterial.flashcards && selectedMaterial.flashcards.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-[var(--muted)] font-mono">
                          <span>
                            Cartão {currentCardIndex + 1} de {selectedMaterial.flashcards.length}
                          </span>
                          <span>Clique no cartão para virar</span>
                        </div>

                        {/* Cartão de Flashcard Interativo */}
                        <div
                          onClick={() => setIsCardFlipped(!isCardFlipped)}
                          className="min-h-[220px] bg-[var(--surface)] border-2 border-[var(--border)] hover:border-[var(--fg)]/40 rounded-[var(--r-lg)] p-6 shadow-sm flex flex-col items-center justify-center text-center cursor-pointer transition-all relative select-none"
                        >
                          <span className="absolute top-3 right-3 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[oklch(0.96_0.01_84)] border border-[var(--border)] text-[var(--muted)] font-mono">
                            {isCardFlipped ? 'Verso (Tradução / Significado)' : 'Frente (Termo Alvo)'}
                          </span>

                          {!isCardFlipped ? (
                            <div className="space-y-2">
                              <h3 className="text-xl sm:text-2xl font-display font-bold text-[var(--fg)]">
                                {selectedMaterial.flashcards[currentCardIndex].frente}
                              </h3>
                              <p className="text-xs text-[var(--muted)]">Toque para ver a tradução</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <h3 className="text-lg sm:text-xl font-display font-bold text-[var(--ok)]">
                                {selectedMaterial.flashcards[currentCardIndex].verso}
                              </h3>
                              {selectedMaterial.flashcards[currentCardIndex].dica && (
                                <p className="text-xs text-[var(--fg)] bg-[var(--sunny)]/15 px-2.5 py-1 rounded-full border border-[var(--sunny)]/40">
                                  💡 {selectedMaterial.flashcards[currentCardIndex].dica}
                                </p>
                              )}
                            </div>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              speakText(selectedMaterial.flashcards[currentCardIndex].frente);
                            }}
                            className="absolute bottom-3 right-3 p-1.5 text-[var(--muted)] hover:text-[var(--fg)] rounded-full hover:bg-[oklch(0.96_0.01_84)] cursor-pointer"
                            title="Ouvir Pronúncia"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Navegação entre Flashcards */}
                        <div className="flex items-center justify-between gap-3 font-mono">
                          <button
                            onClick={() => {
                              setIsCardFlipped(false);
                              setCurrentCardIndex((prev) => Math.max(0, prev - 1));
                            }}
                            disabled={currentCardIndex === 0}
                            className="px-4 py-2 bg-[oklch(0.96_0.01_84)] hover:bg-[oklch(0.92_0.01_84)] disabled:opacity-40 rounded-full text-xs font-semibold text-[var(--fg)] transition cursor-pointer"
                          >
                            Anterior
                          </button>

                          <div className="flex gap-1.5">
                            {selectedMaterial.flashcards.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setIsCardFlipped(false);
                                  setCurrentCardIndex(i);
                                }}
                                className={`w-2 h-2 rounded-full transition cursor-pointer ${
                                  i === currentCardIndex ? 'bg-[var(--fg)] w-4' : 'bg-[var(--border)]'
                                }`}
                              />
                            ))}
                          </div>

                          <button
                            onClick={() => {
                              setIsCardFlipped(false);
                              setCurrentCardIndex((prev) =>
                                Math.min(selectedMaterial.flashcards.length - 1, prev + 1)
                              );
                            }}
                            disabled={currentCardIndex === selectedMaterial.flashcards.length - 1}
                            className="px-4 py-2 bg-[var(--fg)] hover:bg-[var(--fg)]/90 disabled:opacity-40 text-[var(--bg)] rounded-full text-xs font-semibold transition cursor-pointer"
                          >
                            Próximo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--muted)] text-center">Nenhum flashcard gerado.</p>
                    )}
                  </div>
                )}

                {/* 5. ABA: QUIZ DE COMPREENSÃO */}
                {activeTab === 'quiz' && (
                  <div className="space-y-5">
                    {(selectedMaterial.questoes_compreensao || []).map((q, qIndex) => {
                      const selectedOption = selectedQuizAnswers[qIndex];
                      const isCorrect = selectedOption === q.resposta_correta;

                      return (
                        <div
                          key={qIndex}
                          className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[oklch(0.97_0.01_84)] space-y-3"
                        >
                          <h4 className="text-xs sm:text-sm font-bold text-[var(--fg)]">
                            {qIndex + 1}. {q.pergunta}
                          </h4>

                          <div className="space-y-2">
                            {(q.opcoes || []).map((opt, optIdx) => {
                              const isSelected = selectedOption === opt;
                              let btnStyle = 'bg-[var(--surface)] border-[var(--border)] text-[var(--fg)] hover:bg-[oklch(0.95_0.01_84)]';

                              if (quizSubmitted) {
                                if (opt === q.resposta_correta) {
                                  btnStyle = 'bg-[var(--mint)] border-[var(--ok)] text-[var(--ok)] font-semibold';
                                } else if (isSelected) {
                                  btnStyle = 'bg-rose-50 border-rose-300 text-rose-800 line-through';
                                }
                              } else if (isSelected) {
                                btnStyle = 'bg-[var(--fg)] border-[var(--fg)] text-[var(--accent)] font-semibold';
                              }

                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() => {
                                    if (!quizSubmitted) {
                                      setSelectedQuizAnswers({
                                        ...selectedQuizAnswers,
                                        [qIndex]: opt,
                                      });
                                    }
                                  }}
                                  className={`w-full p-2.5 rounded-full border text-left text-xs sm:text-sm transition flex items-center justify-between cursor-pointer ${btnStyle}`}
                                >
                                  <span>{opt}</span>
                                  {quizSubmitted && opt === q.resposta_correta && (
                                    <Check className="w-4 h-4 text-[var(--ok)] shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {quizSubmitted && (
                            <div
                              className={`p-3 rounded-[var(--r-md)] text-xs space-y-1 ${
                                isCorrect
                                  ? 'bg-[var(--mint)] text-[var(--fg)] border border-[var(--ok)]/30'
                                  : 'bg-rose-50 text-rose-900 border border-rose-200'
                              }`}
                            >
                              <p className="font-bold">
                                {isCorrect ? '✅ Resposta Correta!' : '❌ Não foi desta vez.'}
                              </p>
                              <p>{q.explicacao}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex justify-end pt-2 font-mono">
                      {!quizSubmitted ? (
                        <button
                          onClick={() => {
                            setQuizSubmitted(true);
                            // Calcula acertos
                            let acertos = 0;
                            (selectedMaterial.questoes_compreensao || []).forEach((q, i) => {
                              if (selectedQuizAnswers[i] === q.resposta_correta) acertos++;
                            });
                            if (acertos > 0) {
                              confetti({ particleCount: 60, spread: 60 });
                              StorageService.addXP(acertos * 15);
                            }
                          }}
                          className="px-5 py-2.5 bg-[var(--fg)] hover:bg-[var(--fg)]/90 text-[var(--bg)] rounded-full text-xs font-semibold transition cursor-pointer shadow-xs"
                        >
                          Verificar Respostas
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedQuizAnswers({});
                            setQuizSubmitted(false);
                          }}
                          className="px-4 py-2 bg-[oklch(0.96_0.01_84)] hover:bg-[oklch(0.92_0.01_84)] text-[var(--fg)] rounded-full text-xs font-semibold transition cursor-pointer"
                        >
                          Tentar Novamente
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[var(--surface)] p-12 rounded-[var(--r-lg)] border border-[var(--border)] text-center space-y-3">
              <Youtube className="w-12 h-12 text-[var(--muted)] mx-auto" />
              <h3 className="text-base font-bold text-[var(--fg)]">Selecione um Material de Estudos</h3>
              <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                Escolha um material na barra lateral ou adicione um novo link do YouTube ou texto para
                gerar vocabulário, diálogo e flashcards.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
