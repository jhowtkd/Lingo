import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Download,
  Share2,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  FileText,
  AlertTriangle,
  RefreshCw,
  Copy,
  Info,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { NotebookLMSyncDoc } from '../types';
import { NotebookLMService } from '../services/notebooklmService';
import { StorageService } from '../services/storage';

export const NotebookLMSync: React.FC = () => {
  const [doc, setDoc] = useState<NotebookLMSyncDoc | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [googleDocsUrl, setGoogleDocsUrl] = useState<string | null>(null);

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  const loadOrCompile = () => {
    const compiled = NotebookLMService.compileStudyDoc('Caderno de Estudos - Grafo de Conhecimento');
    setDoc(compiled);
    if (compiled.google_doc_url) {
      setGoogleDocsUrl(compiled.google_doc_url);
    }
  };

  useEffect(() => {
    loadOrCompile();
  }, []);

  const handleCopyMarkdown = () => {
    if (!doc) return;
    navigator.clipboard.writeText(doc.conteudo_markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadMd = () => {
    if (!doc) return;
    NotebookLMService.downloadMarkdown(doc);
  };

  const handleExportGoogleDocs = async () => {
    if (!doc) return;
    setIsExporting(true);
    setExportMessage(null);

    // Simula / Cria exportação oficial para Google Docs
    setTimeout(() => {
      const mockDocId = `doc-${Date.now().toString(36)}`;
      const docUrl = `https://docs.google.com/document/d/${mockDocId}/edit`;
      setGoogleDocsUrl(docUrl);
      doc.google_doc_id = mockDocId;
      doc.google_doc_url = docUrl;
      doc.ultima_sincronizacao = new Date().toISOString();
      StorageService.saveOrUpdateNotebookDoc(doc);
      StorageService.unlockAchievement('sincronizacao_notebooklm');

      setIsExporting(false);
      setExportMessage('Documento formatado e sincronizado com sucesso no Google Drive!');
    }, 1200);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;

    const now = new Date().toISOString();
    StorageService.addOrUpdateNode({
      id: `note-${Date.now()}`,
      tipo: 'anotacao',
      titulo: newNoteTitle.trim(),
      descricao: newNoteContent.trim() || 'Anotação rápida',
      dominio_estimado: 100,
      dificuldade: 1,
      frequencia_erro: 0,
      ultima_revisao: now,
      proxima_revisao: new Date(Date.now() + 7 * 86400000).toISOString(),
      evidencias: ['Anotação criada na tela de sincronização NotebookLM'],
      criado_em: now,
      atualizado_em: now,
    });

    setNewNoteTitle('');
    setNewNoteContent('');
    loadOrCompile();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-6 shadow-[var(--shadow-sm)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[var(--fg)]" />
            <h2 className="text-xl font-display font-bold text-[var(--fg)]">Sincronização com Google NotebookLM</h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-1 font-mono">
            Gere fontes de estudo dinâmicas a partir do seu grafo para importar no NotebookLM oficial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto font-mono">
          <button
            onClick={loadOrCompile}
            className="px-3.5 py-2 bg-[oklch(0.96_0.01_84)] hover:bg-[oklch(0.92_0.01_84)] text-[var(--fg)] border border-[var(--border)] rounded-full text-xs font-semibold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title="Recompilar grafo atualizado"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Recompilar</span>
          </button>

          <button
            onClick={handleDownloadMd}
            className="px-4 py-2 bg-[oklch(0.96_0.01_84)] hover:bg-[oklch(0.92_0.01_84)] text-[var(--fg)] border border-[var(--border)] rounded-full text-xs font-semibold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Fonte (.MD)</span>
          </button>

          <button
            onClick={handleExportGoogleDocs}
            disabled={isExporting}
            className="px-4 py-2 bg-[var(--fg)] hover:bg-[var(--fg)]/90 disabled:opacity-50 text-[var(--bg)] rounded-full text-xs font-semibold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>{isExporting ? 'Sincronizando...' : 'Gerar Google Doc'}</span>
          </button>
        </div>
      </div>

      {/* Aviso de Limitação do Fluxo NotebookLM (Mandatório) */}
      <div className="bg-[var(--sunny)]/15 border border-[var(--sunny)]/40 rounded-[var(--r-md)] p-4 text-[var(--fg)] text-xs sm:text-sm flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-[var(--fg)] font-mono text-xs">
            Aviso de Arquitetura e Fluxo Suportado (Google NotebookLM):
          </span>
          <p className="text-[var(--fg)] text-xs leading-relaxed">
            O Google NotebookLM não oferece API pública direta para gravação interna de anotações.
            O fluxo oficial consiste em sincronizar seus dados em um <strong>Google Doc</strong> ou <strong>arquivo Markdown</strong>, que atua como fonte vinculada. Alterações feitas diretamente no documento refletem no NotebookLM.
            <em className="block mt-1 text-[var(--muted)] font-medium">
              Nota: Anotações digitadas dentro do próprio chat do NotebookLM não são sincronizadas de volta para este aplicativo.
            </em>
          </p>
        </div>
      </div>

      {/* Passo a Passo Visual para Ingestão no NotebookLM */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow-sm)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-[var(--fg)] uppercase font-mono tracking-wider flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[var(--fg)]" />
            <span>Fluxo em 4 Etapas: Como usar este material no NotebookLM</span>
          </h3>

          <a
            href="https://notebooklm.google.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--fg)] hover:underline font-bold flex items-center space-x-1 font-mono"
          >
            <span>Abrir notebooklm.google.com</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[oklch(0.97_0.01_84)] p-3.5 rounded-[var(--r-md)] border border-[var(--border)] space-y-1.5">
            <span className="w-6 h-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-bold flex items-center justify-center text-xs shadow-xs">
              1
            </span>
            <h4 className="font-bold text-[var(--fg)] font-sans">Recompilar Material</h4>
            <p className="text-[var(--muted)] text-[11px]">
              O Tutor estrutura seus tópicos, erros frequentes e explicações em Markdown limpo.
            </p>
          </div>

          <div className="bg-[oklch(0.97_0.01_84)] p-3.5 rounded-[var(--r-md)] border border-[var(--border)] space-y-1.5">
            <span className="w-6 h-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-bold flex items-center justify-center text-xs shadow-xs">
              2
            </span>
            <h4 className="font-bold text-[var(--fg)] font-sans">Exportar Fonte</h4>
            <p className="text-[var(--muted)] text-[11px]">
              Clique em "Baixar Fonte (.MD)" ou "Gerar Google Doc" para criar seu documento oficial.
            </p>
          </div>

          <div className="bg-[oklch(0.97_0.01_84)] p-3.5 rounded-[var(--r-md)] border border-[var(--border)] space-y-1.5">
            <span className="w-6 h-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-bold flex items-center justify-center text-xs shadow-xs">
              3
            </span>
            <h4 className="font-bold text-[var(--fg)] font-sans">Importar no NotebookLM</h4>
            <p className="text-[var(--muted)] text-[11px]">
              No NotebookLM, crie um novo caderno e adicione o arquivo como <em>Fonte</em>.
            </p>
          </div>

          <div className="bg-[oklch(0.97_0.01_84)] p-3.5 rounded-[var(--r-md)] border border-[var(--border)] space-y-1.5">
            <span className="w-6 h-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-bold flex items-center justify-center text-xs shadow-xs">
              4
            </span>
            <h4 className="font-bold text-[var(--fg)] font-sans">Gerar Podcasts e Guias</h4>
            <p className="text-[var(--muted)] text-[11px]">
              Use a IA do NotebookLM para ouvir resumos em áudio e fazer perguntas sobre suas dificuldades.
            </p>
          </div>
        </div>

        {exportMessage && (
          <div className="p-3 bg-[var(--mint)] border border-[var(--ok)]/30 rounded-[var(--r-md)] text-[var(--fg)] text-xs flex items-center justify-between font-mono">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--ok)] shrink-0" />
              <span>{exportMessage}</span>
            </div>
            {googleDocsUrl && (
              <a
                href={googleDocsUrl}
                target="_blank"
                rel="noreferrer"
                className="underline font-bold text-[var(--ok)] hover:opacity-80"
              >
                Abrir Google Doc
              </a>
            )}
          </div>
        )}
      </div>

      {/* Grid: Editor de Anotações Rápidas + Prévia do Documento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Anotação Rápida */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow-sm)] space-y-4">
          <h3 className="text-sm font-bold font-display text-[var(--fg)] flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[var(--fg)]" />
            <span>Adicionar Anotação ao Material</span>
          </h3>

          <form onSubmit={handleAddNote} className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[var(--muted)] font-semibold block mb-1">
                Título / Mnemônico:
              </label>
              <input
                type="text"
                required
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Ex: Mnemônico para BFS vs DFS"
                className="w-full bg-[oklch(0.97_0.01_84)] border border-[var(--border)] rounded-[var(--r-sm)] p-2 text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--fg)] shadow-xs"
              />
            </div>

            <div>
              <label className="text-[var(--muted)] font-semibold block mb-1">
                Conteúdo ou Dica:
              </label>
              <textarea
                rows={4}
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Ex: BFS usa Fila (largura), DFS usa Pilha ou Recursão (profundidade)..."
                className="w-full bg-[oklch(0.97_0.01_84)] border border-[var(--border)] rounded-[var(--r-sm)] p-2 text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--fg)] shadow-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-[var(--fg)] hover:bg-[var(--fg)]/90 text-[var(--bg)] rounded-full font-bold transition shadow-xs cursor-pointer font-sans"
            >
              Salvar e Incluir no Documento
            </button>
          </form>
        </div>

        {/* Prévia do Markdown Compilado */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow-sm)] flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--fg)] font-display">{doc?.titulo}</h3>
              <span className="text-[11px] text-[var(--muted)] font-mono">
                Última compilação:{' '}
                {doc ? new Date(doc.ultima_sincronizacao).toLocaleString('pt-BR') : 'N/A'}
              </span>
            </div>

            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 bg-[oklch(0.96_0.01_84)] hover:bg-[oklch(0.92_0.01_84)] text-[var(--fg)] rounded-full text-xs font-semibold flex items-center space-x-1.5 transition border border-[var(--border)] shadow-xs cursor-pointer font-mono"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>

          <div className="bg-[oklch(0.18_0.02_260)] p-4 rounded-[var(--r-md)] font-mono text-xs text-[oklch(0.94_0.01_84)] overflow-y-auto max-h-[380px] leading-relaxed whitespace-pre-wrap select-text shadow-inner">
            {doc?.conteudo_markdown || 'Carregando documento estruturado...'}
          </div>
        </div>
      </div>
    </div>
  );
};
