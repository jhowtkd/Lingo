import { CEFRLevel } from '../../src/types';

export type ConversationMode = 'conversation' | 'accuracy' | 'lesson' | 'roleplay';

export interface CompactHistoryItem {
  role: 'user' | 'model';
  text: string;
}

export interface CompactMemoryItem {
  skillId: string;
  type: string;
  text: string;
  language: string;
}

export interface CompactCorrectionItem {
  error: string;
  correction: string;
}

export interface CompactUserProfile {
  goal?: string;
  interests?: string[];
  preferredSupportLanguage?: string;
}

export interface TutorChatRequest {
  message: string;
  sessionId: string;
  interactionId?: string;
  language: string;
  cefrLevel: CEFRLevel;
  conversationMode: ConversationMode;
  profile?: CompactUserProfile;
  recentHistory?: CompactHistoryItem[];
  relevantMemories?: CompactMemoryItem[];
  recentCorrections?: CompactCorrectionItem[];
  topic?: string;
}

export interface PedagogicalEventCandidate {
  skillId: string;
  type:
    | 'correct_use'
    | 'grammar_error'
    | 'vocabulary_error'
    | 'false_friend'
    | 'pronunciation_issue'
    | 'fluency_signal'
    | 'needs_review';
  evidence: string;
  correctedForm?: string;
  explanation?: string;
  confidence: number; // 0.0 a 1.0
  severity: 'low' | 'medium' | 'high';
  language: string;
}

export interface PedagogicalAnalysisResult {
  hasError: boolean;
  events: PedagogicalEventCandidate[];
  xpEarned: number;
  adaptationNotice?: string;
}

export type TutorStreamEvent =
  | {
      type: 'meta';
      requestId: string;
      modelRequested: string;
      modelUsed?: string;
      degraded: boolean;
      language: string;
      cefrLevel: string;
    }
  | {
      type: 'delta';
      text: string;
    }
  | {
      type: 'response_complete';
      fullText: string;
      interactionId?: string;
      modelUsed: string;
      degraded: boolean;
      durationMs: number;
    }
  | {
      type: 'pedagogical_analysis';
      analysis: PedagogicalAnalysisResult;
    }
  | {
      type: 'error';
      code: string;
      message: string;
      retryable: boolean;
    };

export interface UnavailableAssessment {
  available: false;
  reason:
    | 'missing_audio'
    | 'transcription_failed'
    | 'model_unavailable'
    | 'unsupported_language'
    | 'invalid_input';
  retryable: boolean;
  message: string;
}

export interface SanitizedTutorPayload {
  message: string;
  sessionId: string;
  language: string;
  cefrLevel: CEFRLevel;
  conversationMode: ConversationMode;
  profile: CompactUserProfile;
  recentHistory: CompactHistoryItem[];
  relevantMemories: CompactMemoryItem[];
  recentCorrections: CompactCorrectionItem[];
  topic: string;
}

/**
 * Sanitiza e aplica limites rígidos de payload tanto no cliente quanto no servidor
 */
export function sanitizeTutorChatPayload(raw: any): SanitizedTutorPayload {
  const message = (raw.message || raw.mensagem || '').trim().slice(0, 2000);
  const sessionId = (raw.sessionId || raw.session_id || `session-${Date.now()}`).trim();
  const language = (raw.language || raw.idioma_alvo || raw.idioma || 'Inglês').trim();
  const cefrLevel = (raw.cefrLevel || raw.nivel_estudante || raw.nivel_cefr || 'B1') as CEFRLevel;
  const conversationMode: ConversationMode =
    raw.conversationMode === 'accuracy' ||
    raw.conversationMode === 'lesson' ||
    raw.conversationMode === 'roleplay'
      ? raw.conversationMode
      : 'conversation';

  const topic = (raw.topic || raw.topico_atual || raw.topico || 'Conversação Geral').trim().slice(0, 150);

  // Limite estrito: no máximo 8 mensagens recentes
  const rawHistory = Array.isArray(raw.recentHistory)
    ? raw.recentHistory
    : Array.isArray(raw.historico)
    ? raw.historico
    : [];

  const recentHistory: CompactHistoryItem[] = rawHistory
    .filter((h: any) => h && typeof (h.text || h.content || h.conteudo) === 'string' && (h.text || h.content || h.conteudo).trim().length > 0)
    .slice(-8)
    .map((h: any) => ({
      role: (h.role === 'user' || h.remetente === 'user') ? 'user' : 'model',
      text: String(h.text || h.content || h.conteudo).trim().slice(0, 800),
    }));

  // Limite estrito: no máximo 3 memórias relevantes
  const rawMemories = Array.isArray(raw.relevantMemories)
    ? raw.relevantMemories
    : Array.isArray(raw.contexto_grafo)
    ? raw.contexto_grafo
    : [];

  const relevantMemories: CompactMemoryItem[] = rawMemories
    .filter((m: any) => m && typeof (m.text || m.descricao || m.titulo) === 'string')
    .slice(0, 3)
    .map((m: any) => ({
      skillId: String(m.skillId || m.id || m.titulo || 'general').trim(),
      type: String(m.type || m.tipo || 'vocabulario').trim(),
      text: String(m.text || m.descricao || m.titulo || '').trim().slice(0, 250),
      language: String(m.language || m.idioma || language).trim(),
    }));

  // Limite estrito: no máximo 2 correções recentes
  const rawCorrections = Array.isArray(raw.recentCorrections)
    ? raw.recentCorrections
    : Array.isArray(raw.correcoes_recentes)
    ? raw.correcoes_recentes
    : [];

  const recentCorrections: CompactCorrectionItem[] = rawCorrections
    .filter((c: any) => c && (c.error || c.erro || c.correction || c.resposta_corrigida))
    .slice(0, 2)
    .map((c: any) => ({
      error: String(c.error || c.erro || '').trim().slice(0, 150),
      correction: String(c.correction || c.resposta_corrigida || c.explicacao || '').trim().slice(0, 150),
    }));

  const rawInterests = raw.profile?.interests || raw.interesses || raw.plano_estudo?.interesses_principais || [];
  const profile: CompactUserProfile = {
    goal: String(raw.profile?.goal || raw.motivo_estudo || raw.plano_estudo?.motivo_principal || 'Fluência e Prática').trim().slice(0, 120),
    interests: (Array.isArray(rawInterests) ? rawInterests : []).slice(0, 5).map((i: any) => String(i).trim().slice(0, 40)),
    preferredSupportLanguage: String(raw.profile?.preferredSupportLanguage || 'Português').trim().slice(0, 40),
  };

  return {
    message,
    sessionId,
    language,
    cefrLevel,
    conversationMode,
    profile,
    recentHistory,
    relevantMemories,
    recentCorrections,
    topic,
  };
}
