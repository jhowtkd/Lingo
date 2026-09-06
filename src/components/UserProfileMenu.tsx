import React, { useState, useMemo } from 'react';
import { UserProfile } from '../types';
import { logoutUser } from '../services/firebase';
import { StorageService } from '../services/storage';
import { playSfx } from '../services/soundEffects';
import {
  User,
  Shield,
  Crown,
  Share2,
  Download,
  LogOut,
  Sparkles,
  Cloud,
  CheckCircle2,
  KeyRound,
  FileText,
  Layers,
  Award,
  Trash2,
  Compass,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface UserProfileMenuProps {
  currentUser: UserProfile | null;
  onOpenAuthModal: () => void;
  onOpenSharedPacksModal: () => void;
  onOpenAdminPanel?: () => void;
  onLogout: () => void;
  onResetData?: () => void;
  onOpenOnboarding?: () => void;
}

export function UserProfileMenu({
  currentUser,
  onOpenAuthModal,
  onOpenSharedPacksModal,
  onOpenAdminPanel,
  onLogout,
  onResetData,
  onOpenOnboarding,
}: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const stats = useMemo(() => StorageService.getStats(), []);
  const nodes = useMemo(() => StorageService.getNodes(), []);
  const materials = useMemo(() => StorageService.getMaterials(), []);

  const handleLogout = async () => {
    playSfx('click');
    await logoutUser();
    onLogout();
    setIsOpen(false);
  };

  const handleManualSync = async () => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    playSfx('click');
    setSyncStatus('Sincronizando...');
    try {
      StorageService.scheduleCloudSync();
      setTimeout(() => {
        setSyncStatus('Base sincronizada com sucesso!');
        playSfx('success');
        setTimeout(() => setSyncStatus(null), 3000);
      }, 1000);
    } catch (err) {
      setSyncStatus('Erro na sincronização.');
    }
  };

  const handleClearAllData = () => {
    playSfx('click');
    if (window.confirm('Deseja limpar todos os dados locais e começar com a base 100% zerada (sem conteúdos pré-existentes)?')) {
      StorageService.resetAllData();
      if (onResetData) {
        onResetData();
      } else {
        window.location.reload();
      }
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Avatar / Login Trigger */}
      {currentUser ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 p-1 pr-2.5 rounded-full border transition cursor-pointer ${
            currentUser.role === 'admin'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 hover:bg-amber-500/20'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--fg)] hover:bg-[oklch(0.965_0.01_84)]'
          }`}
          title={`Conta: ${currentUser.displayName || currentUser.email} (${currentUser.role === 'admin' ? 'Administrador' : 'Aluno'})`}
        >
          {currentUser.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt="Avatar"
              loading="lazy"
              decoding="async"
              className="w-7 h-7 rounded-full object-cover border border-[var(--border)]"
            />
          ) : (
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                currentUser.role === 'admin'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-[var(--accent)] text-[var(--fg)]'
              }`}
            >
              {currentUser.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}

          <div className="hidden sm:flex flex-col text-left leading-tight">
            <span className="text-xs font-bold truncate max-w-[100px]">
              {currentUser.displayName?.split(' ')[0] || 'Usuário'}
            </span>
            <span
              className={`text-[9px] uppercase font-extrabold ${
                currentUser.role === 'admin' ? 'text-amber-700' : 'text-[var(--muted)]'
              }`}
            >
              {currentUser.role === 'admin' ? 'ADM' : 'ALUNO'}
            </span>
          </div>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Você está no Modo Teste (sem conta). Clique para ver opções ou resetar dados."
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Modo Teste</span>
            <span className="sm:hidden">Teste</span>
          </button>

          <button
            onClick={() => {
              playSfx('click');
              onOpenAuthModal();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--fg)] text-[oklch(0.97_0.01_84)] hover:bg-[oklch(0.25_0.05_280)] text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Entrar / Login</span>
            <span className="sm:hidden">Login</span>
          </button>
        </div>
      )}

      {/* Popover / Menu dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-11 z-50 w-76 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow)] text-[var(--fg)] space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            {currentUser ? (
              <>
                {/* Header do Usuário Logado */}
                <div className="flex items-start gap-3 border-b border-[var(--border)] pb-3">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-10 rounded-full object-cover border border-[var(--border)]"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        currentUser.role === 'admin'
                          ? 'bg-amber-500 text-white'
                          : 'bg-[var(--accent)] text-[var(--fg)]'
                      }`}
                    >
                      {currentUser.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}

                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="font-bold text-sm truncate flex items-center gap-1.5">
                      <span>{currentUser.displayName || 'Estudante'}</span>
                      {currentUser.role === 'admin' && (
                        <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] truncate font-mono">
                      {currentUser.email || 'Convidado'}
                    </div>
                    <div className="pt-0.5">
                      <span
                        className={`inline-block text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded-md ${
                          currentUser.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-800'
                            : 'bg-emerald-500/15 text-emerald-800'
                        }`}
                      >
                        {currentUser.role === 'admin'
                          ? '👑 Administrador Master'
                          : '🎓 Base Individual de Aluno'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Resumo da Base Pessoal do Usuário */}
                <div className="bg-[oklch(0.98_0.005_84)] rounded-xl p-2.5 border border-[var(--border)]/70 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                    <span className="font-semibold">Sua Base de Conhecimento:</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Cloud className="w-3 h-3" /> Nuvem
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-[var(--fg)]">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>{nodes.length} nós no Grafo</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-[var(--fg)]">
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      <span>{materials.length} materiais</span>
                    </div>
                  </div>
                </div>

                {syncStatus && (
                  <div className="text-[11px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg text-center">
                    {syncStatus}
                  </div>
                )}

                {/* Ações do Menu Logado */}
                <div className="space-y-1 text-xs font-semibold">
                  {currentUser.role === 'admin' && onOpenAdminPanel && (
                    <button
                      onClick={() => {
                        playSfx('click');
                        onOpenAdminPanel();
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-amber-500/15 text-amber-900 hover:bg-amber-500/25 transition text-left cursor-pointer font-bold"
                    >
                      <Crown className="w-4 h-4 text-amber-700" />
                      <span>Abrir Painel de Gestão ADM</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      playSfx('click');
                      onOpenSharedPacksModal();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[oklch(0.965_0.01_84)] text-[var(--fg)] transition text-left cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-[var(--accent-deep)]" />
                    <span>Explorar Bases Compartilhadas</span>
                  </button>

                  <button
                    onClick={handleManualSync}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[oklch(0.965_0.01_84)] text-[var(--fg)] transition text-left cursor-pointer"
                  >
                    <Cloud className="w-4 h-4 text-blue-600" />
                    <span>Forçar Sincronização na Nuvem</span>
                  </button>

                  <button
                    onClick={handleClearAllData}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-rose-50 text-rose-700 transition text-left cursor-pointer border-t border-[var(--border)] pt-2 mt-1"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Limpar Todos os Dados Locais</span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-rose-50 text-rose-600 transition text-left cursor-pointer font-bold"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair da Conta</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Header do Visitante / Modo Teste */}
                <div className="space-y-1 border-b border-[var(--border)] pb-3">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 text-[10px] font-extrabold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>TESTE SEM CONTA ATIVO</span>
                  </div>
                  <h4 className="font-bold text-sm text-[var(--fg)]">Modo Convidado / Teste</h4>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Você pode testar e criar conteúdos com IA livremente no navegador, sem precisar cadastrar conta e sem banco de dados pré-existente.
                  </p>
                </div>

                {/* Resumo dos Dados Atuais do Teste */}
                <div className="bg-[oklch(0.98_0.005_84)] rounded-xl p-2.5 border border-[var(--border)]/70 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                    <span className="font-semibold">Estado Atual no Navegador:</span>
                    <span className="text-emerald-700 font-bold">Limpo / Isolado</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-bold text-[var(--fg)]">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>{nodes.length} nós no Grafo</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      <span>{materials.length} materiais</span>
                    </div>
                  </div>
                </div>

                {/* Ações do Modo Teste */}
                <div className="space-y-1.5 text-xs font-semibold">
                  {onOpenOnboarding && (
                    <button
                      onClick={() => {
                        playSfx('click');
                        onOpenOnboarding();
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-deep)] hover:brightness-95 transition text-left cursor-pointer font-bold"
                    >
                      <Sparkles className="w-4 h-4 text-[var(--accent-deep)]" />
                      <span>Assistente de Trilha IA</span>
                    </button>
                  )}

                  <button
                    onClick={handleClearAllData}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-rose-50 text-rose-700 transition text-left cursor-pointer border border-rose-200/60"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Zerar Todos os Dados (Começar do Zero)</span>
                  </button>

                  <button
                    onClick={() => {
                      playSfx('click');
                      onOpenAuthModal();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-[var(--fg)] text-[oklch(0.97_0.01_84)] hover:bg-[oklch(0.25_0.05_280)] transition text-left cursor-pointer font-bold mt-2"
                  >
                    <User className="w-4 h-4" />
                    <span>Criar Conta ou Fazer Login (Opcional)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
