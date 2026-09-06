import http from 'http';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

// Verificação de ID tokens do Firebase Auth no servidor sem exigir service
// account: baixamos os certificados x509 públicos do Google (com o max-age do
// cache-Control deles) e validamos a assinatura RS256 + claims iss/aud.
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gn-coach';
const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;

// E-mails com poder administrativo (devem estar reservados no Firebase Auth).
const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS ||
  'jhonatan.marcela@gmail.com,admin@lingo.app,adm@lingo.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase());

interface CachedCerts {
  keys: Record<string, string>;
  expiresAt: number;
}
let certsCache: CachedCerts | null = null;
let certsPromise: Promise<CachedCerts> | null = null;

async function fetchPublicCerts(): Promise<CachedCerts> {
  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw new Error(`Falha ao obter certificados públicos do Firebase: ${res.status}`);
  }
  const keys = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const expiresAt = Date.now() + (maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600) * 1000;
  return { keys, expiresAt };
}

async function getPublicCerts(): Promise<CachedCerts> {
  if (certsCache && certsCache.expiresAt > Date.now()) return certsCache;
  if (!certsPromise) {
    certsPromise = fetchPublicCerts()
      .then((certs) => {
        certsCache = certs;
        return certs;
      })
      .finally(() => {
        certsPromise = null;
      });
  }
  return certsPromise;
}

export interface FirebaseTokenPayload {
  sub: string;
  user_id?: string;
  email?: string;
  firebase?: { sign_in_provider?: string };
  [key: string]: unknown;
}

export async function verifyFirebaseIdToken(token: string): Promise<FirebaseTokenPayload> {
  const decodedHeader = jwt.decode(token, { complete: true });
  if (!decodedHeader || typeof decodedHeader === 'string' || !decodedHeader.header.kid) {
    throw new Error('Token malformado');
  }
  const { keys } = await getPublicCerts();
  const publicKey = keys[decodedHeader.header.kid];
  if (!publicKey) {
    throw new Error('Certificado desconhecido para o token (kid inválido ou rotacionado)');
  }
  const payload = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    audience: PROJECT_ID,
    issuer: ISSUER,
  }) as unknown as FirebaseTokenPayload;
  return payload;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const queryToken = new URL(req.url, 'http://local').searchParams.get('token');
  return queryToken || null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      firebaseUser?: FirebaseTokenPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res
      .status(401)
      .json({ error: 'Autenticação obrigatória. Faça login para usar os recursos de IA.', code: 'UNAUTHENTICATED' });
  }
  try {
    req.firebaseUser = await verifyFirebaseIdToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.', code: 'INVALID_TOKEN' });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    const email = (req.firebaseUser?.email || '').toLowerCase();
    if (!email || !ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ error: 'Acesso restrito a administradores.', code: 'FORBIDDEN' });
    }
    next();
  });
}

// Valida o token de handshake de um upgrade WebSocket (?token=...).
// Retorna o payload decodificado ou null (conexão deve ser rejeitada).
export async function verifyWsToken(request: http.IncomingMessage): Promise<FirebaseTokenPayload | null> {
  const header = request.headers.authorization;
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  const token =
    (header?.startsWith('Bearer ') ? header.slice(7).trim() : null) ||
    url.searchParams.get('token');
  if (!token) return null;
  try {
    return await verifyFirebaseIdToken(token);
  } catch {
    return null;
  }
}
