import React, { useState } from 'react';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signInAsGuest,
  syncUserProfile,
} from '../services/firebase';
import { UserProfile, UserRole } from '../types';
import { Button } from './ui/button';
import { playSfx } from '../services/soundEffects';
import {
  ShieldCheck,
  User,
  Mail,
  Lock,
  Sparkles,
  ArrowRight,
  LogOut,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Compass,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'guest'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    playSfx('click');
    try {
      const profile = await signInWithGoogle();
      playSfx('success');
      onSuccess(profile);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Falha ao autenticar com o Google. Tente novamente.');
      playSfx('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Preencha seu e-mail e senha.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    playSfx('click');

    try {
      let profile: UserProfile;
      if (mode === 'register') {
        profile = await signUpWithEmail(email, password, displayName || 'Estudante');
      } else {
        profile = await signInWithEmail(email, password);
      }
      playSfx('success');
      onSuccess(profile);
      onClose();
    } catch (err: any) {
      console.error(err);
      let friendly = err.message || 'Erro na autenticação.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        friendly = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/email-already-in-use') {
        friendly = 'Este e-mail já está cadastrado. Faça login na aba Entrar.';
      } else if (err.code === 'auth/weak-password') {
        friendly = 'A senha deve ter no mínimo 6 caracteres.';
      }
      setErrorMsg(friendly);
      playSfx('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    playSfx('click');
    try {
      const profile = await signInAsGuest(displayName || 'Estudante Convidado');
      playSfx('success');
      onSuccess(profile);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro ao entrar como convidado.');
      playSfx('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Login de Demonstração como Administrador
  const handleDemoAdminLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    playSfx('level_up');
    try {
      const demoAdminProfile: UserProfile = {
        uid: 'adm-demo-master',
        email: 'jhonatan.marcela@gmail.com',
        displayName: 'Jhonatan (Administrador)',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role: 'admin',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        statsSummary: {
          level: 5,
          xp: 1850,
          streak: 14,
          nodesCount: 42,
          materialsCount: 8,
        },
      };
      onSuccess(demoAdminProfile);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro no login rápido de administrador.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[oklch(0.25_0.05_280_/_0.55)] backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] max-w-md w-full p-6 sm:p-8 space-y-6 shadow-[var(--shadow)] text-[var(--fg)] max-h-[92vh] overflow-y-auto">
        
        {/* Header do Modal */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent-deep)] px-2.5 py-0.5 text-[11px] font-extrabold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SINCRONIZAÇÃO EM NUVEM (OPCIONAL)</span>
            </div>
            <h2 className="text-xl font-bold font-display text-[var(--fg)]">
              {mode === 'login' && 'Entrar na sua Conta'}
              {mode === 'register' && 'Criar Nova Conta'}
              {mode === 'guest' && 'Modo Teste / Convidado'}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Você pode testar tudo sem conta. O login serve apenas para salvar sua base individual na nuvem.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--fg)] p-1.5 rounded-full hover:bg-[oklch(0.955_0.012_84)] transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Banner de Teste Sem Conta */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-300">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Não quer criar conta? Teste livremente!</span>
          </div>
          <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/80 leading-relaxed">
            Todos os recursos de IA, voz, grafo de memória, flashcards, materiais e assistente de trilha funcionam 100% direto no navegador.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="self-start px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <span>Continuar Testando sem Conta</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Abas de Navegação */}
        <div className="flex p-1 bg-[oklch(0.965_0.01_84)] rounded-xl gap-1 border border-[var(--border)]/60 text-xs font-bold">
          <button
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg transition text-center cursor-pointer ${
              mode === 'login'
                ? 'bg-[var(--surface)] text-[var(--fg)] shadow-xs border border-[var(--border)]/50'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg transition text-center cursor-pointer ${
              mode === 'register'
                ? 'bg-[var(--surface)] text-[var(--fg)] shadow-xs border border-[var(--border)]/50'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            Cadastrar
          </button>
          <button
            onClick={() => {
              setMode('guest');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg transition text-center cursor-pointer ${
              mode === 'guest'
                ? 'bg-[var(--surface)] text-[var(--fg)] shadow-xs border border-[var(--border)]/50'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            Convidado
          </button>
        </div>

        {/* Mensagem de Erro se houver */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Botão Oficial do Google */}
        <div className="space-y-3">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[oklch(0.97_0.01_84)] text-xs sm:text-sm font-bold text-[var(--fg)] shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continuar com o Google</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-[var(--border)] w-full" />
            <span className="bg-[var(--surface)] px-3 text-[10px] uppercase font-bold text-[var(--muted)] absolute">
              ou com e-mail
            </span>
          </div>
        </div>

        {/* Formulário de E-mail / Senha */}
        {mode !== 'guest' ? (
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Seu Nome
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[var(--muted)] absolute left-3 top-3" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: Maria Silva"
                    required
                    className="w-full bg-[oklch(0.985_0.005_84)] border border-[var(--border)] rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-deep)]"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--muted)] absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  required
                  className="w-full bg-[oklch(0.985_0.005_84)] border border-[var(--border)] rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-deep)]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--muted)] absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-[oklch(0.985_0.005_84)] border border-[var(--border)] rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-deep)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl font-extrabold text-xs sm:text-sm bg-[var(--fg)] text-[oklch(0.97_0.01_84)] hover:bg-[oklch(0.25_0.05_280)] transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block animate-spin">⏳</span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Entrar no Lingo' : 'Criar minha Conta'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-3.5 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Apelido para a Sessão
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[var(--muted)] absolute left-3 top-3" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: Convidado Fluente"
                  className="w-full bg-[oklch(0.985_0.005_84)] border border-[var(--border)] rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-deep)]"
                />
              </div>
            </div>

            <button
              onClick={handleGuestLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl font-extrabold text-xs sm:text-sm bg-[var(--sunny)] text-[var(--fg)] hover:brightness-95 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Entrar sem Senha (Modo Convidado)</span>
              <Compass className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Atalho Rápido para Administrador de Demonstração */}
        <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
            <span className="font-bold">Acesso de Gestão:</span>
            <span>Conta com Privilégios ADM</span>
          </div>
          <button
            onClick={handleDemoAdminLogin}
            className="w-full py-2 px-3 rounded-xl border border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-700" />
            <span>Testar como Administrador (jhonatan.marcela@gmail.com)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
