import { auth } from '../services/firebase';

/**
 * Wrapper de fetch para as rotas /api do backend:
 * - anexa o ID token do Firebase (o servidor exige autenticação);
 * - aplica timeout com AbortController (rotas de IA podem travar).
 * Retorna a Response crua para os chamados manterem seu tratamento de erro.
 */
export async function apiFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const headers = new Headers(init.headers);
  try {
    const user = auth.currentUser;
    if (user) {
      headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
    }
  } catch {
    // Sem sessão válida: segue sem header; o servidor responde 401.
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
