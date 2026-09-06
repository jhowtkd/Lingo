import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Clock,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { ChatConversation } from '../types';
import { StorageService } from '../services/storage';
import { getLanguageTheme } from '../services/languageThemes';
import { playSfx } from '../services/soundEffects';

export interface ConversationHistorySectionProps {
  onSelectConversation: (conversationId: string, topic?: string) => void;
  onNewConversation?: () => void;
  className?: string;
  limit?: number;
}

export const ConversationHistorySection: React.FC<ConversationHistorySectionProps> = ({
  onSelectConversation,
  onNewConversation,
  className = '',
  limit = 5,
}) => {
  const [recentConversations, setRecentConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('');

  const loadConversations = () => {
    const recents = StorageService.getRecentConversations(limit);
    setRecentConversations(recents);
    setActiveConvId(StorageService.getActiveConversationId());
  };

  useEffect(() => {
    loadConversations();

    // Escuta evento de storage para sincronizar alterações feitas em abas ou no chat
    const handleStorageChange = () => {
      loadConversations();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [limit]);

  const handleResume = (conv: ChatConversation) => {
    playSfx('pop');
    StorageService.setActiveConversationId(conv.id);
    setActiveConvId(conv.id);
    onSelectConversation(conv.id, conv.topico);
  };

  const handleResumeLatest = () => {
    if (recentConversations.length > 0) {
      handleResume(recentConversations[0]);
    } else if (onNewConversation) {
      onNewConversation();
    }
  };

  // Formata data e hora de maneira contextual (Hoje, Ontem, ou data)
  const formatTimeAgo = (isoString?: string): string => {
    if (!isoString) return 'Recentemente';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Recentemente';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (diffMins < 2) return 'Agora mesmo';
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return `Hoje às ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) {
      return `Ontem às ${timeStr}`;
    }

    if (diffDays < 7) {
      return `Há ${diffDays} dias às ${timeStr}`;
    }

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ` às ${timeStr}`;
  };

  // Limpa caracteres especiais de Markdown para exibição no card de histórico
  const cleanSnippet = (text?: string): string => {
    if (!text) return '';
    return text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*•]\s+/gm, '')
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  // Extrai a última fala da conversa com indicação de quem falou
  const getLastMessageInfo = (conv: ChatConversation) => {
    const msgs = conv.mensagens || [];
    if (msgs.length === 0) {
      return { sender: '', text: 'Conversa recém-iniciada pronta para prática.' };
    }
    const last = msgs[msgs.length - 1];
    const sender = last.remetente === 'user' ? 'Você' : 'Tutor';
    const cleaned = cleanSnippet(last.conteudo);
    const snippet = cleaned.length > 130 ? cleaned.slice(0, 130) + '...' : cleaned;
    return { sender, text: snippet };
  };

  const latestConv = recentConversations[0];

  return (
    <section
      id="section-conversation-history"
      className={`space-y-3 text-left ${className}`}
      aria-label="Histórico das últimas conversas"
    >
      {/* Cabeçalho da Seção com Ação Direta para Retomar a Última */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-deep)] flex items-center justify-center text-xs shrink-0">
              <MessageSquare className="w-3.5 h-3.5" />
            </span>
            <h3 className="text-sm sm:text-base font-bold text-[var(--fg)] tracking-tight">
              Histórico de Conversação
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]">
              {recentConversations.length} {recentConversations.length === 1 ? 'sessão' : 'sessões'}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Retome suas últimas sessões de diálogo exatamente de onde você parou.
          </p>
        </div>

        {latestConv && (
          <button
            id="btn-resume-latest-conversation"
            onClick={handleResumeLatest}
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition shadow-[0_2px_0_oklch(0.55_0.15_48)] hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer shrink-0"
            title="Retomar a última conversa ativa de onde parou"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retomar Última Conversa</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Lista das Últimas 5 Sessões */}
      {recentConversations.length > 0 ? (
        <div className="grid grid-cols-1 gap-2.5">
          {recentConversations.map((conv, idx) => {
            const isFirst = idx === 0;
            const isActive = conv.id === activeConvId;
            const lastMsg = getLastMessageInfo(conv);
            const theme = getLanguageTheme(conv.idioma || 'Inglês');
            const flag = theme?.bandeira ? theme.bandeira.split(' ')[0] : '🌐';
            const totalMsgs = conv.total_mensagens || conv.mensagens?.length || 0;

            return (
              <div
                key={conv.id}
                id={`history-conv-card-${conv.id}`}
                onClick={() => handleResume(conv)}
                className={`group relative rounded-2xl p-4 transition-all duration-200 cursor-pointer border text-left ${
                  isActive
                    ? 'bg-[var(--accent-soft)]/40 border-[var(--accent)] shadow-xs'
                    : isFirst
                    ? 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)] shadow-2xs hover:shadow-xs hover:-translate-y-0.5'
                    : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)]/80 shadow-2xs hover:-translate-y-0.5'
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleResume(conv);
                  }
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Topo / Informações de Identificação */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm" aria-hidden="true">
                        {flag}
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-[var(--fg)] group-hover:text-[var(--accent-deep)] transition truncate max-w-md">
                        {conv.titulo || conv.topico}
                      </h4>

                      {/* Badges de Status */}
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--fg)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Sessão Ativa
                        </span>
                      )}

                      {!isActive && isFirst && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25">
                          <Sparkles className="w-2.5 h-2.5" />
                          Mais Recente
                        </span>
                      )}

                      {conv.nivel_cefr && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--border)]/70 text-[var(--muted)]">
                          {conv.nivel_cefr}
                        </span>
                      )}

                      {conv.material_titulo && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-800 dark:text-sky-300 border border-sky-500/20 max-w-[200px] truncate">
                          <BookOpen className="w-2.5 h-2.5 shrink-0" />
                          {conv.material_titulo}
                        </span>
                      )}
                    </div>

                    {/* Trecho da Última Mensagem (Onde a conversa parou) */}
                    {lastMsg.text && (
                      <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-1 group-hover:text-[var(--fg)] transition-colors">
                        <strong className="text-[var(--fg)] font-semibold">
                          {lastMsg.sender ? `${lastMsg.sender}: ` : ''}
                        </strong>
                        <span className="italic">"{lastMsg.text}"</span>
                      </p>
                    )}
                  </div>

                  {/* Lado Direito: Timestamp & Ação de Retomar */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]/60">
                    <div className="flex items-center gap-2.5 text-[11px] text-[var(--muted)]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[var(--muted)]" />
                        <span>{formatTimeAgo(conv.atualizado_em || conv.criado_em)}</span>
                      </span>

                      <span>•</span>

                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-[var(--muted)]" />
                        <span>{totalMsgs} {totalMsgs === 1 ? 'msg' : 'msgs'}</span>
                      </span>
                    </div>

                    <button
                      id={`btn-resume-conv-${conv.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResume(conv);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--surface)] text-[var(--accent-deep)] border border-[var(--border)] group-hover:border-[var(--accent)] group-hover:bg-[var(--accent-soft)] transition cursor-pointer shrink-0"
                      title="Retomar esta conversa de onde parou"
                    >
                      <span>Retomar</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Estado Vazio Amigável */
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-[var(--accent-soft)] text-[var(--accent-deep)] flex items-center justify-center mx-auto">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-[var(--fg)]">Nenhuma sessão registrada ainda</h4>
            <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
              Inicie sua primeira conversa com o tutor para destravar sua fala e registrar seu histórico.
            </p>
          </div>
          <button
            onClick={() => onSelectConversation('new')}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Iniciar Primeira Conversa</span>
          </button>
        </div>
      )}
    </section>
  );
};
