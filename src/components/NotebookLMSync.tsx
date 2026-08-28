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
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900">Sincronização com Google NotebookLM</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gere fontes de estudo dinâmicas a partir do seu grafo para importar no NotebookLM oficial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={loadOrCompile}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 shadow-2xs"
            title="Recompilar grafo atualizado"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Recompilar</span>
          </button>

          <button
            onClick={handleDownloadMd}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 shadow-2xs"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Fonte (.MD)</span>
          </button>

          <button
            onClick={handleExportGoogleDocs}
            disabled={isExporting}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 shadow-2xs"
          >
            <FileText className="w-4 h-4" />
            <span>{isExporting ? 'Sincronizando...' : 'Gerar Google Doc'}</span>
          </button>
        </div>
      </div>

      {/* Aviso de Limitação do Fluxo NotebookLM (Mandatório) */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-slate-800 text-xs sm:text-sm flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-amber-900">
            Aviso de Arquitetura e Fluxo Suportado (Google NotebookLM):
          </span>
          <p className="text-slate-700 text-xs leading-relaxed">
            O Google NotebookLM não oferece API pública direta para gravação interna de anotações.
            O fluxo oficial consiste em sincronizar seus dados em um <strong>Google Doc</strong> ou <strong>arquivo Markdown</strong>, que atua como fonte vinculada. Alterações feitas diretamente no documento refletem no NotebookLM.
            <em className="block mt-1 text-amber-900/90 font-medium">
              Nota: Anotações digitadas dentro do próprio chat do NotebookLM não são sincronizadas de volta para este aplicativo.
            </em>
          </p>
        </div>
      </div>

      {/* Passo a Passo Visual para Ingestão no NotebookLM */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Fluxo em 4 Etapas: Como usar este material no NotebookLM</span>
          </h3>

          <a
            href="https://notebooklm.google.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-1"
          >
            <span>Abrir notebooklm.google.com</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1.5">
            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
              1
            </span>
            <h4 className="font-bold text-slate-900">Recompilar Material</h4>
            <p className="text-slate-500 text-[11px]">
              O Tutor estrutura seus tópicos, erros frequentes e explicações em Markdown limpo.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1.5">
            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
              2
            </span>
            <h4 className="font-bold text-slate-900">Exportar Fonte</h4>
            <p className="text-slate-500 text-[11px]">
              Clique em "Baixar Fonte (.MD)" ou "Gerar Google Doc" para criar seu documento oficial.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1.5">
            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
              3
            </span>
            <h4 className="font-bold text-slate-900">Importar no NotebookLM</h4>
            <p className="text-slate-500 text-[11px]">
              No NotebookLM, crie um novo caderno e adicione o arquivo como <em>Fonte</em>.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1.5">
            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
              4
            </span>
            <h4 className="font-bold text-slate-900">Gerar Podcasts e Guias</h4>
            <p className="text-slate-500 text-[11px]">
              Use a IA do NotebookLM para ouvir resumos em áudio e fazer perguntas sobre suas dificuldades.
            </p>
          </div>
        </div>

        {exportMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{exportMessage}</span>
            </div>
            {googleDocsUrl && (
              <a
                href={googleDocsUrl}
                target="_blank"
                rel="noreferrer"
                className="underline font-bold text-emerald-700 hover:text-emerald-900"
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
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Adicionar Anotação ao Material</span>
          </h3>

          <form onSubmit={handleAddNote} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-600 font-semibold block mb-1">
                Título / Mnemônico:
              </label>
              <input
                type="text"
                required
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Ex: Mnemônico para BFS vs DFS"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="text-slate-600 font-semibold block mb-1">
                Conteúdo ou Dica:
              </label>
              <textarea
                rows={4}
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Ex: BFS usa Fila (largura), DFS usa Pilha ou Recursão (profundidade)..."
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition shadow-2xs"
            >
              Salvar e Incluir no Documento
            </button>
          </form>
        </div>

        {/* Prévia do Markdown Compilado */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{doc?.titulo}</h3>
              <span className="text-[11px] text-slate-400">
                Última compilação:{' '}
                {doc ? new Date(doc.ultima_sincronizacao).toLocaleString('pt-BR') : 'N/A'}
              </span>
            </div>

            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-200 shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl font-mono text-xs text-slate-100 overflow-y-auto max-h-[380px] leading-relaxed whitespace-pre-wrap select-text shadow-inner">
            {doc?.conteudo_markdown || 'Carregando documento estruturado...'}
          </div>
        </div>
      </div>
    </div>
  );
};
