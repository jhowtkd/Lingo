import http from 'http';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireAdmin, verifyWsToken } from './server/auth/verifyFirebaseToken';
import { GoogleGenAI, Modality } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { chatRouter } from './server/routes/chat';
import { transcriptionRouter } from './server/routes/transcription';
import { pronunciationRouter } from './server/routes/pronunciation';
import { createWordContextRouter } from './server/routes/wordContext';
import { createTtsRouter } from './server/routes/tts';
import { createMaterialsRouter } from './server/routes/materials';
import { createOnboardingRouter } from './server/routes/onboarding';
import { createInsightsRouter } from './server/routes/insights';
import { AiTelemetry } from './server/observability/aiTelemetry';
import { createUserDailyQuota } from './server/middleware/userQuota';
import { loadEnvConfig } from './server/config/env';

dotenv.config();

// Configuração de ambiente validada em um único lugar (PORT, chave Gemini,
// projeto Firebase, admins, timeout). Avisos de config faltante vão para o log
// de startup, antes de qualquer rota subir.
const appEnv = loadEnvConfig();
const PORT = appEnv.port;

for (const warning of appEnv.warnings) {
  console.warn(`[Config] ${warning}`);
}

let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!ai && process.env.GEMINI_API_KEY) {
    try {
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (err) {
      console.error('Erro ao inicializar Gemini client:', err);
    }
  }
  return ai;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Telemetria AI persistida em disco: sobrevive a restarts do servidor
  // (snapshots periódicos; caminho configurável via AI_TELEMETRY_PATH).
  AiTelemetry.enablePersistence(
    process.env.AI_TELEMETRY_PATH || '.telemetry/ai-telemetry.json'
  );

  // Respeita X-Forwarded-For atrás de proxy (necessário para rate limit por IP)
  app.set('trust proxy', 1);
  app.use(compression());

  // Parse grande (25MB, base64 de áudio) apenas nas rotas de áudio; todo o
  // resto fica em 64kb para evitar exaustão de memória por payload gigante.
  const AUDIO_ROUTES = [
    '/api/transcribe',
    '/api/transcribe-audio',
    '/api/pronunciation-assessment',
    '/api/pronunciation',
  ];
  app.use(AUDIO_ROUTES, express.json({ limit: '25mb' }));
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: true, limit: '64kb' }));

  // Health check (aberto, para load balancers). Sem expor detalhes de config
  // (ex.: presença de API key) — o endpoint é público.
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Telemetria & Observabilidade AI (restrita a administradores)
  app.get('/api/telemetry', requireAdmin, (_req, res) => {
    res.json({
      summary: AiTelemetry.getMetricsSummary(),
      usageByRoute: AiTelemetry.getUsageByRoute(),
      recentLogs: AiTelemetry.getRecentLogs(50),
    });
  });

  // --- Auth + Rate Limiting: rotas de IA custam dinheiro real (Gemini) ---
  const jsonLimiter = (max: number) =>
    rateLimit({ windowMs: 60_000, limit: max, standardHeaders: true, legacyHeaders: false });

  // Toda rota /api exige ID token Firebase válido (login anônimo conta).
  app.use('/api', jsonLimiter(120), requireAuth);
  // Limites mais rígidos nas rotas caras:
  app.use('/api/chat', jsonLimiter(30));
  app.use('/api/tts', jsonLimiter(20));
  app.use(AUDIO_ROUTES, jsonLimiter(20));

  // Cotas diárias por usuário (uid) nas gerações mais caras de IA: proteção de
  // custo adicional além do rate limit por minuto (ajustáveis via .env).
  const materialsQuota = createUserDailyQuota(Number(process.env.AI_DAILY_MATERIALS_LIMIT) || 20);
  const onboardingQuota = createUserDailyQuota(Number(process.env.AI_DAILY_ONBOARDING_LIMIT) || 10);

  // Rotas Modulares do Tutor de Inteligência Artificial
  app.use('/api/chat', chatRouter);
  app.use('/api/transcribe', transcriptionRouter);
  app.use('/api/transcribe-audio', transcriptionRouter);
  app.use('/api/pronunciation-assessment', pronunciationRouter);
  app.use('/api/pronunciation', pronunciationRouter);

  // Cota diária por usuário + burst/min restrito (6/min) na geração de materiais.
  app.use('/api/materials/generate', materialsQuota, jsonLimiter(6), createMaterialsRouter(getGeminiClient));

  app.use('/api/word-context', createWordContextRouter(getGeminiClient));

  app.use('/api/tts', createTtsRouter(getGeminiClient));

  app.use('/api', createInsightsRouter(getGeminiClient));

  // Cota diária por usuário + burst/min restrito (6/min) na geração de planos.
  app.use(
    '/api/onboarding/generate-plan',
    onboardingQuota,
    jsonLimiter(6),
    createOnboardingRouter(getGeminiClient)
  );


  // ==========================================
  // WEBSOCKET BRIDGE: GEMINI LIVE VOICE API (LANGUAGE TUTOR)
  // ==========================================
  // --- Hardening do /live: cada conexão abre uma sessão Gemini Live paga ---
  const wss = new WebSocketServer({ server, path: '/live', maxPayload: 512 * 1024 });

  // Heartbeat: reivindica sessões órfãs (rede móvel, sleep) via ping/pong
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const client = ws as WebSocket & { isAlive?: boolean };
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30000);
  wss.on('close', () => clearInterval(heartbeat));

  const liveConnectionsByIp = new Map<string, number>();
  const MAX_LIVE_CONNECTIONS_PER_IP = 3;

  // Limites por usuário (uid Firebase): cada sessão Live é paga, então 1 conexão
  // por usuário e no máximo 30 minutos por sessão.
  const liveConnectionsByUser = new Map<string, number>();
  const MAX_LIVE_CONNECTIONS_PER_USER = 1;
  const MAX_LIVE_SESSION_MS = 30 * 60_000;

  wss.on('connection', async (clientWs: WebSocket, request) => {
    (clientWs as WebSocket & { isAlive?: boolean }).isAlive = true;
    clientWs.on('pong', () => {
      (clientWs as WebSocket & { isAlive?: boolean }).isAlive = true;
    });

    // Autenticação obrigatória no handshake (?token=<Firebase ID token>):
    // sem token válido nenhuma sessão Live paga é aberta.
    const firebaseUser = await verifyWsToken(request);
    if (!firebaseUser) {
      clientWs.close(4401, 'UNAUTHENTICATED');
      return;
    }

    // Limite de sessões simultâneas por IP
    const ip = request.socket.remoteAddress || 'unknown';
    const activeForIp = liveConnectionsByIp.get(ip) ?? 0;
    if (activeForIp >= MAX_LIVE_CONNECTIONS_PER_IP) {
      clientWs.close(4408, 'TOO_MANY_CONNECTIONS');
      return;
    }

    // Limite de sessões simultâneas por usuário: um uid só pode abrir uma
    // sessão Live paga por vez (mesmo trocando de IP/dispositivo). Checado
    // antes de qualquer incremento para não vazar vaga por rejeição.
    const uid = firebaseUser.sub;
    const activeForUser = liveConnectionsByUser.get(uid) ?? 0;
    if (activeForUser >= MAX_LIVE_CONNECTIONS_PER_USER) {
      clientWs.close(4408, 'TOO_MANY_CONNECTIONS');
      return;
    }

    liveConnectionsByIp.set(ip, activeForIp + 1);
    liveConnectionsByUser.set(uid, activeForUser + 1);

    // Duração máxima da sessão: encerra o socket para conter o custo de uma
    // sessão paga esquecida (o 'close' abaixo limpa contador e timer).
    const sessionTimer = setTimeout(
      () => clientWs.close(1000, 'SESSION_LIMIT'),
      MAX_LIVE_SESSION_MS
    );

    clientWs.on('close', () => {
      clearTimeout(sessionTimer);
      const nu = liveConnectionsByUser.get(uid) ?? 1;
      if (nu <= 1) liveConnectionsByUser.delete(uid);
      else liveConnectionsByUser.set(uid, nu - 1);
      const n = liveConnectionsByIp.get(ip) ?? 1;
      if (n <= 1) liveConnectionsByIp.delete(ip);
      else liveConnectionsByIp.set(ip, n - 1);
    });

    const client = getGeminiClient();
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const topic = url.searchParams.get('topic') || 'Conversação Geral';
    const targetLang = url.searchParams.get('lang') || 'Inglês';
    const studentLevel = url.searchParams.get('level') || 'Intermediário (B1)';
    const requestedVoice = url.searchParams.get('voice') || 'Aoede';

    const validVoices = ['Aoede', 'Zephyr', 'Puck', 'Fenrir', 'Kore', 'Charon'];
    const voiceName = validVoices.includes(requestedVoice) ? requestedVoice : 'Aoede';

    if (!client) {
      // Simulação interativa com retorno em áudio simulado ou texto quando sem chave
      clientWs.send(
        JSON.stringify({
          type: 'tutor_text',
          text: `Hello! I'm your ${targetLang} Voice Tutor. Let's practice speaking about "${topic}"! How are you doing today?`,
        })
      );

      clientWs.on('message', (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.text) {
            clientWs.send(
              JSON.stringify({
                type: 'tutor_text',
                text: `Great point! When discussing "${topic}" in ${targetLang}, that's a very natural way to express it. Tell me more!`,
              })
            );
          }
        } catch (e) {}
      });
      return;
    }

    let sessionClosed = false;

    try {
      const liveSession = await client.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `Você é um Tutor de Línguas nativo e caloroso especialista no ensino de ${targetLang} para estudantes brasileiros.
Tópico de estudo atual: "${topic}" (Nível estimado: ${studentLevel}).

Diretrizes Pedagógicas para Voz em Tempo Real:
1. Fale predominantemente em ${targetLang} de maneira clara, articulada e amigável. Se o estudante falar em Português ou demonstrar dúvida, acolha e encoraje.
2. Mantenha cada turno de fala curto (2 a 3 frases no máximo), sempre terminando com uma pergunta aberta ou provocação conversacional para manter o estudante falando.
3. Se o estudante cometer um erro evidente de vocabulário, falso cognato, pronúncia ou tempo verbal, ofereça um feedback encorajador e mostre a forma mais idiomática de dizer.
4. Estimule a autoconfiança e a fluência do aluno.`,
        },
        callbacks: {
          onmessage: (msg: any) => {
            // 1. Chunk de áudio gerado pelo modelo (24kHz PCM)
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'audio', audio: audioData }));
            }

            // 2. Notificação de interrupção (usuário falou por cima)
            if (msg.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }

            // 3. Transcrição do tutor
            const modelParts = msg.serverContent?.modelTurn?.parts;
            if (modelParts) {
              for (const part of modelParts) {
                if (part.text && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'tutor_text', text: part.text }));
                }
              }
            }

            // 4. Transcrição da fala do usuário
            const userParts = msg.serverContent?.userTurn?.parts;
            if (userParts) {
              for (const part of userParts) {
                if (part.text && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'user_text', text: part.text }));
                }
              }
            }

            // 5. Final de turno
            const turnComplete = msg.serverContent?.turnComplete;
            if (turnComplete && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'turn_complete' }));
            }
          },
          onerror: (err: any) => {
            console.error('Erro na sessão Gemini Live:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  error: err?.message || 'Erro na sessão de voz do Gemini Live',
                })
              );
            }
          },
          onclose: () => {
            sessionClosed = true;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'closed' }));
            }
            // Encerra também o socket do cliente: sem isso o navegador segue
            // transmitindo áudio para uma sessão morta.
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.close(1000, 'SESSION_CLOSED');
            }
          },
        },
      });

      clientWs.on('message', (raw) => {
        if (sessionClosed) return;
        try {
          const payload = JSON.parse(raw.toString());
          if (payload.audio) {
            liveSession.sendRealtimeInput({
              audio: {
                data: payload.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } else if (typeof payload.text === 'string' && payload.text) {
            liveSession.sendRealtimeInput({
              text: payload.text.slice(0, 4000),
            });
          }
        } catch (e) {
          console.error('Erro ao processar pacote do cliente no Live WebSocket:', e);
        }
      });

      clientWs.on('close', () => {
        try {
          liveSession.close();
        } catch (e) {}
      });
    } catch (liveErr: any) {
      console.error('Falha ao iniciar Gemini Live:', liveErr);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            error: liveErr.message || 'Falha ao conectar com o Gemini Live',
          })
        );
      }
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Assets com hash de conteúdo: cache imutável de 1 ano. HTML revalida.
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), { maxAge: '1y', immutable: true })
    );
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      })
    );
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Middleware de erro global: contrato JSON uniforme + log centralizado
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Unhandled route error]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno', code: 'INTERNAL_ERROR', retryable: true });
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Tutor de Línguas Server rodando em http://0.0.0.0:${PORT}`);
  });
}

// Rede de segurança: rejeições não tratadas não devem derrubar o processo
// (derrubaria todas as sessões de voz ativas junto).
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

startServer();


