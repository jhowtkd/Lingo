import React, { useState, useEffect } from 'react';
import { SharedKnowledgePack, UserProfile } from '../types';
import { getSharedKnowledgePacks, incrementPackClones } from '../services/firebase';
import { StorageService } from '../services/storage';
import { playSfx } from '../services/soundEffects';
import {
  Share2,
  Download,
  BookOpen,
  Layers,
  FileText,
  Search,
  CheckCircle2,
  Sparkles,
  Crown,
} from 'lucide-react';

interface SharedPacksModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  onImportSuccess?: () => void;
}

export function SharedPacksModal({ isOpen, onClose, onImportSuccess }: SharedPacksModalProps) {
  const [packs, setPacks] = useState<SharedKnowledgePack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [importedId, setImportedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getSharedKnowledgePacks()
        .then((data) => setPacks(data))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImport = (pack: SharedKnowledgePack) => {
    playSfx('click');
    const result = StorageService.importKnowledgePack(pack);
    if (pack.id) {
      incrementPackClones(pack.id);
    }
    setImportedId(pack.id || 'imported');
    playSfx('success');
    setTimeout(() => {
      setImportedId(null);
      if (onImportSuccess) onImportSuccess();
      onClose();
    }, 1200);
  };

  const filteredPacks = packs.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.titulo.toLowerCase().includes(q) ||
      p.descricao.toLowerCase().includes(q) ||
      p.idioma.toLowerCase().includes(q) ||
      p.autor_nome.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-[oklch(0.25_0.05_280_/_0.55)] backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] max-w-2xl w-full p-6 space-y-5 shadow-[var(--shadow)] text-[var(--fg)] max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent-deep)] px-2.5 py-0.5 text-[11px] font-extrabold">
              <Share2 className="w-3.5 h-3.5" />
              <span>BASES DE CONHECIMENTO COMPARTILHADAS</span>
            </div>
            <h2 className="text-xl font-bold font-display">Bases Pedagógicas Disponíveis</h2>
            <p className="text-xs text-[var(--muted)]">
              Escolha uma base pronta de vocabulário e materiais criada por professores e adicione à sua biblioteca pessoal.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar bases compartilhadas"
            className="text-[var(--muted)] hover:text-[var(--fg)] p-1.5 rounded-full hover:bg-[oklch(0.955_0.012_84)] transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por tópico, idioma, nível ou autor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[oklch(0.985_0.005_84)] border border-[var(--border)] rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-deep)]"
          />
        </div>

        {/* Lista de Bases */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-[var(--muted)] animate-pulse">
              Carregando repositório de bases compartilhadas...
            </div>
          ) : filteredPacks.length > 0 ? (
            filteredPacks.map((pack) => (
              <div
                key={pack.id}
                className="bg-[oklch(0.985_0.005_84)] border border-[var(--border)] rounded-xl p-4 transition hover:border-[var(--accent-deep)]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[var(--accent)]/20 text-[var(--accent-deep)]">
                      {pack.idioma} ({pack.nivel_cefr})
                    </span>
                    <span className="text-xs text-[var(--muted)]">por {pack.autor_nome}</span>
                  </div>
                  <h4 className="text-sm font-bold text-[var(--fg)]">{pack.titulo}</h4>
                  <p className="text-xs text-[var(--muted)] line-clamp-2">{pack.descricao}</p>
                  <div className="flex items-center gap-4 text-[11px] text-[var(--muted)] pt-1">
                    <span className="flex items-center gap-1 font-semibold text-[var(--fg)]">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      {pack.total_termos} nós
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-[var(--fg)]">
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      {pack.total_materiais} materiais
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleImport(pack)}
                  disabled={importedId === pack.id}
                  className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                    importedId === pack.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[var(--fg)] text-[oklch(0.97_0.01_84)] hover:bg-[oklch(0.25_0.05_280)]'
                  }`}
                >
                  {importedId === pack.id ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Importada!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Clonar Base</span>
                    </>
                  )}
                </button>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-xs text-[var(--muted)]">
              Nenhuma base compartilhada encontrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
