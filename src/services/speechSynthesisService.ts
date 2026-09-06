import { apiFetch } from '../lib/api';
/**
 * Serviço Avançado e Inteligente de Síntese de Voz Neural (Gemini AI TTS & Natural Audio)
 * Utiliza o modelo gemini-3.1-flash-tts-preview para vozes hiper-realistas e naturais,
 * com cache em memória, segmentação bilíngue e fallback transparente para síntese do navegador.
 */

export interface SpeechOptions {
  lang?: string; // 'en-US', 'pt-BR', 'es-ES', 'fr-FR', etc.
  voice?: string; // 'Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir', 'Aoede'
  rate?: number; // 0.75 a 1.2
  pitch?: number; // 0.9 a 1.1
  volume?: number;
  useNeuralAI?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export interface DetectedSegment {
  text: string;
  lang: string;
}

export interface NeuralVoiceInfo {
  id: string;
  name: string;
  gender: 'female' | 'male';
  description: string;
  badge: string;
}

export const NEURAL_VOICES: NeuralVoiceInfo[] = [
  {
    id: 'Kore',
    name: 'Kore (Recomendada)',
    gender: 'female',
    description: 'Voz feminina calorosa, empática e com dicção nativa perfeita',
    badge: 'Mais Natural',
  },
  {
    id: 'Puck',
    name: 'Puck (Dinâmico)',
    gender: 'male',
    description: 'Voz masculina expressiva, enérgica e envolvente',
    badge: 'Expressivo',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr (Serena)',
    gender: 'female',
    description: 'Voz feminina calma, cristalina e com cadência didática',
    badge: 'Didática',
  },
  {
    id: 'Charon',
    name: 'Charon (Firme)',
    gender: 'male',
    description: 'Voz masculina profunda, segura e equilibrada',
    badge: 'Profunda',
  },
];

class SpeechSynthesisManager {
  private availableVoices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private isPlaying = false;
  private currentPlayingId: string | null = null;
  private listeners: Set<(playing: boolean, id: string | null) => void> = new Set();
  // Cache de URL base64 por hash de texto + voz, com limite LRU: cada entrada
  // é áudio em base64 (dezenas de KB a MBs) e, sem limite, o heap cresce
  // monotonicamente em sessões longas de estudo.
  private audioCache = new Map<string, string>();
  private static readonly AUDIO_CACHE_MAX = 50;
  private preferredVoice = 'Kore';
  private neuralFallbackMode = false;
  private neuralFallbackResetTimer: any = null;

  // Web Audio API para análise de frequência em tempo real
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;
  private simulatedPhase = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ai_tutor_neural_voice');
      if (saved && ['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir', 'Aoede'].includes(saved)) {
        this.preferredVoice = saved;
      }

      if ('speechSynthesis' in window) {
        this.initVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = () => this.initVoices();
        }
      }
    }
  }

  private initAudioContext() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
          this.analyserNode = this.audioContext.createAnalyser();
          this.analyserNode.fftSize = 256;
          this.analyserNode.smoothingTimeConstant = 0.8;
        }
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    } catch (e) {
      console.warn('[SpeechService] Erro ao inicializar AudioContext:', e);
    }
  }

  private connectAudioElement(audio: HTMLAudioElement) {
    try {
      this.initAudioContext();
      if (this.audioContext && this.analyserNode) {
        // Desconecta fonte anterior se houver
        if (this.mediaSourceNode) {
          try {
            this.mediaSourceNode.disconnect();
          } catch (e) {}
        }
        this.mediaSourceNode = this.audioContext.createMediaElementSource(audio);
        this.mediaSourceNode.connect(this.analyserNode);
        this.analyserNode.connect(this.audioContext.destination);
      }
    } catch (e) {
      // Browsers podem restringir reconexão de media element source, fallback limpo
      console.warn('[SpeechService] Nota sobre conexão de áudio:', e);
    }
  }

  /**
   * Retorna o nó analisador de áudio Web Audio API
   */
  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  /**
   * Obtém os bytes brutos de frequência (0-255) diretamente no buffer fornecido
   */
  public getByteFrequencyDataDirect(targetArray: Uint8Array): boolean {
    if (this.analyserNode && this.audioContext && this.audioContext.state === 'running') {
      this.analyserNode.getByteFrequencyData(targetArray);
      return true;
    }
    return false;
  }

  /**
   * Obtém os bytes brutos de domínio do tempo (onda) diretamente no buffer fornecido
   */
  public getByteTimeDomainDataDirect(targetArray: Uint8Array): boolean {
    if (this.analyserNode && this.audioContext && this.audioContext.state === 'running') {
      this.analyserNode.getByteTimeDomainData(targetArray);
      return true;
    }
    return false;
  }

  /**
   * Retorna dados de frequência normalizados (0.0 a 1.0) para visualização de waveform/espectro
   */
  public getFrequencyData(numBars = 24): number[] {
    if (!this.isPlaying) {
      return new Array(numBars).fill(0.06);
    }

    if (this.analyserNode && this.audioContext && this.audioContext.state === 'running') {
      const bufferLength = this.analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyserNode.getByteFrequencyData(dataArray);

      // Agrupa os bins de frequência em numBars bandas
      const step = Math.floor(bufferLength / numBars);
      const bars: number[] = [];
      let hasRealAudio = false;

      for (let i = 0; i < numBars; i++) {
        let sum = 0;
        const start = i * step;
        const end = Math.min(start + step, bufferLength);
        for (let j = start; j < end; j++) {
          sum += dataArray[j];
        }
        const avg = sum / (end - start || 1);
        const norm = Math.min(1, Math.max(0.06, avg / 255));
        if (avg > 10) hasRealAudio = true;
        bars.push(norm);
      }

      if (hasRealAudio) {
        return bars;
      }
    }

    // Gerador de onda vocal orgânica responsiva (garante animação fluida caso analyser esteja em repouso)
    this.simulatedPhase += 0.15;
    const result: number[] = [];
    for (let i = 0; i < numBars; i++) {
      const centerDist = Math.abs(i - numBars / 2) / (numBars / 2);
      const envelope = Math.cos(centerDist * (Math.PI / 2));
      const wave1 = Math.sin(this.simulatedPhase * 1.5 + i * 0.4) * 0.35 + 0.5;
      const wave2 = Math.cos(this.simulatedPhase * 0.8 - i * 0.25) * 0.25 + 0.3;
      const wave3 = Math.sin(this.simulatedPhase * 2.2 + i * 0.7) * 0.2;
      const val = Math.min(1, Math.max(0.08, (wave1 * 0.6 + wave2 * 0.3 + wave3 * 0.1) * envelope * 1.2));
      result.push(val);
    }
    return result;
  }

  /**
   * Retorna dados de onda temporal (waveform) com amplitudes normalizadas (-1.0 a 1.0)
   */
  public getWaveformData(numPoints = 48): number[] {
    if (!this.isPlaying) {
      return new Array(numPoints).fill(0);
    }

    if (this.analyserNode && this.audioContext && this.audioContext.state === 'running') {
      const bufferLength = this.analyserNode.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      this.analyserNode.getByteTimeDomainData(dataArray);

      const step = Math.floor(bufferLength / numPoints);
      const points: number[] = [];
      let hasSignal = false;

      for (let i = 0; i < numPoints; i++) {
        const idx = Math.min(i * step, bufferLength - 1);
        const val = (dataArray[idx] - 128) / 128; // -1 to 1
        if (Math.abs(val) > 0.04) hasSignal = true;
        points.push(val);
      }

      if (hasSignal) {
        return points;
      }
    }

    // Onda simulada harmônica vocal
    const points: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const x = (i / numPoints) * Math.PI * 4;
      const wave =
        Math.sin(x + this.simulatedPhase * 2) * 0.5 +
        Math.sin(x * 2.5 - this.simulatedPhase * 3) * 0.3 +
        Math.sin(x * 4 + this.simulatedPhase) * 0.15;
      points.push(wave);
    }
    return points;
  }

  /**
   * Retorna o nível de energia/volume médio atual (0.0 a 1.0)
   */
  public getAudioLevel(): number {
    if (!this.isPlaying) return 0;
    const freqs = this.getFrequencyData(12);
    const sum = freqs.reduce((acc, v) => acc + v, 0);
    return Math.min(1, sum / freqs.length);
  }

  public getPreferredVoice(): string {
    return this.preferredVoice;
  }

  public setPreferredVoice(voice: string) {
    this.preferredVoice = voice;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_tutor_neural_voice', voice);
    }
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      this.availableVoices = voices;
      this.isInitialized = true;
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.isInitialized && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.initVoices();
    }
    return this.availableVoices;
  }

  /**
   * Limpa caracteres de Markdown, emojis, blocos de código e ruídos de formatação
   * para uma fala humana, clara e sem falar "asterisco asterisco".
   */
  public cleanTextForSpeech(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // Remove blocos de código
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // Remove referências de links [Texto](url) -> Texto
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove marcadores de negrito e itálico (*, **, _, __)
    cleaned = cleaned.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1');

    // Remove cabeçalhos Markdown (#, ##, ###)
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // Remove listas com marcadores (-, *, 1.)
    cleaned = cleaned.replace(/^\s*[-*•]\s+/gm, '');
    cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');

    // Remove emojis e símbolos visuais comuns
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '');

    // Remove quebras de linha excessivas
    cleaned = cleaned.replace(/\n+/g, '. ');

    // Remove múltiplos espaços
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

    return cleaned;
  }

  /**
   * Detecta se o texto está predominantemente em Português ou Inglês
   */
  public detectLanguage(text: string, defaultTarget = 'en-US'): string {
    const ptMarkers = [
      /\b(você|vocês|estou|está|para|ajudar|aprender|tutor|línguas|conversa|pronto|vamos|hoje|obrigado|dificuldade|gramática|exemplo|resposta|pergunta|com|não|sim|mais|menos|fazer|isso|aqui|então|porque|por que|como|onde|quando)\b/i,
      /[ãõáéíóúâêîôûç]/i,
    ];

    const esMarkers = [
      /\b(usted|ustedes|estoy|está|para|ayudar|aprender|lenguas|hablar|gracias|difícil|gramática|ejemplo|pregunta|con|más|hacer|entonces|porque|cómo|dónde|cuándo)\b/i,
      /[ñáéíóú¿¡]/i,
    ];

    const frMarkers = [
      /\b(vous|nous|suis|est|pour|aider|apprendre|langues|merci|grammaire|exemple|question|avec|plus|faire|alors|pourquoi|comment|où|quand)\b/i,
      /[éèêëàâîïôûùç]/i,
    ];

    let ptScore = 0;
    if (ptMarkers[0].test(text)) ptScore += 2;
    if (ptMarkers[1].test(text)) ptScore += 2;

    if (ptScore >= 2) {
      return 'pt-BR';
    }

    if (esMarkers[0].test(text) || esMarkers[1].test(text)) {
      return 'es-ES';
    }

    if (frMarkers[0].test(text) || frMarkers[1].test(text)) {
      return 'fr-FR';
    }

    return defaultTarget;
  }

  /**
   * Encontra a voz mais natural/neural do navegador disponível caso necessário
   */
  public getBestBrowserVoice(targetLang: string): SpeechSynthesisVoice | null {
    const voices = this.getVoices();
    if (!voices || voices.length === 0) return null;

    const langPrefix = targetLang.split('-')[0].toLowerCase();

    const matchingVoices = voices.filter(
      (v) =>
        v.lang.toLowerCase() === targetLang.toLowerCase() ||
        v.lang.toLowerCase().startsWith(langPrefix)
    );

    if (matchingVoices.length === 0) {
      const fallback = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
      return fallback || voices[0] || null;
    }

    const premiumKeywords = [
      'natural',
      'enhanced',
      'neural',
      'google',
      'samantha',
      'karen',
      'daniel',
      'luciana',
      'francisca',
      'jennifer',
      'oliver',
      'helena',
      'felipe',
      'maria',
      'carlos',
      'monica',
      'jorge',
      'thomas',
    ];

    const best = matchingVoices.find((v) => {
      const name = v.name.toLowerCase();
      return premiumKeywords.some((k) => name.includes(k)) && !name.includes('compact');
    });

    return best || matchingVoices[0];
  }

  /**
   * Busca áudio sintetizado em alta resolução via Gemini 3.1 Flash Neural TTS
   */
  public async fetchNeuralAudio(
    text: string,
    voiceName = this.preferredVoice,
    lang = 'en-US'
  ): Promise<string | null> {
    if (this.neuralFallbackMode) {
      return null;
    }

    const cacheKey = `${voiceName}:${lang}:${text}`;
    if (this.audioCache.has(cacheKey)) {
      // Re-insere para manter recência (ordem de inserção do Map = ordem LRU)
      const cached = this.audioCache.get(cacheKey)!;
      this.audioCache.delete(cacheKey);
      this.audioCache.set(cacheKey, cached);
      return cached;
    }

    try {
      const response = await apiFetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: voiceName,
          idioma: lang,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.fallback || !data.audioUrl) {
        if (data.reason === 'API_KEY_INVALID') {
          this.neuralFallbackMode = true;
          if (typeof window !== 'undefined' && !this.neuralFallbackResetTimer) {
            this.neuralFallbackResetTimer = window.setTimeout(() => {
              this.neuralFallbackMode = false;
              this.neuralFallbackResetTimer = null;
            }, 60000);
          }
        }
        return null;
      }

      if (data.audioUrl) {
        this.audioCache.set(cacheKey, data.audioUrl);
        if (this.audioCache.size > SpeechSynthesisManager.AUDIO_CACHE_MAX) {
          const oldest = this.audioCache.keys().next().value;
          if (oldest !== undefined) this.audioCache.delete(oldest);
        }
        return data.audioUrl;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Reproduz texto com Voz Neural Gemini (ou fallback suave)
   */
  public async speak(
    rawText: string,
    options: SpeechOptions = {},
    trackingId?: string
  ): Promise<boolean> {
    this.stop();

    const cleanText = this.cleanTextForSpeech(rawText);
    if (!cleanText) return false;

    const chosenVoice = options.voice || this.preferredVoice;
    const targetLang = options.lang || this.detectLanguage(cleanText, 'en-US');
    const useNeural = options.useNeuralAI !== false;

    this.isPlaying = true;
    this.currentPlayingId = trackingId || 'active';
    this.notifyListeners();
    options.onStart?.();

    // 1. Tenta reproduzir com Voz Neural Gemini de Alta Fidelidade
    if (useNeural) {
      const neuralAudioUrl = await this.fetchNeuralAudio(cleanText, chosenVoice, targetLang);

      // Se ainda for a mesma reprodução ativa
      if (this.isPlaying && this.currentPlayingId === (trackingId || 'active') && neuralAudioUrl) {
        try {
          const audio = new Audio(neuralAudioUrl);
          this.currentAudioElement = audio;

          // Conecta ao analisador de espectro de áudio para waveform em tempo real
          this.connectAudioElement(audio);

          if (options.rate && options.rate !== 1) {
            audio.playbackRate = options.rate;
          }

          audio.onended = () => {
            this.isPlaying = false;
            this.currentPlayingId = null;
            this.currentAudioElement = null;
            this.notifyListeners();
            options.onEnd?.();
          };

          audio.onerror = (e) => {
            console.warn('[SpeechService] Falha no elemento de áudio neural, acionando fallback', e);
            this.speakWithBrowserFallback(cleanText, options, trackingId);
          };

          await audio.play();
          return true;
        } catch (audioErr) {
          console.warn('[SpeechService] Erro ao reproduzir áudio neural:', audioErr);
        }
      }
    }

    // 2. Fallback para síntese local do navegador
    return this.speakWithBrowserFallback(cleanText, options, trackingId);
  }

  /**
   * Fallback com síntese local do navegador refinada
   */
  private speakWithBrowserFallback(
    cleanText: string,
    options: SpeechOptions = {},
    trackingId?: string
  ): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.isPlaying = false;
      this.currentPlayingId = null;
      this.notifyListeners();
      options.onError?.(new Error('Síntese de voz não suportada'));
      return false;
    }

    const targetLang = options.lang || this.detectLanguage(cleanText, 'en-US');
    const voice = this.getBestBrowserVoice(targetLang);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = targetLang;
    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = options.rate ?? (targetLang.startsWith('pt') ? 0.98 : 0.88);
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    utterance.onstart = () => {
      this.isPlaying = true;
      this.currentPlayingId = trackingId || 'active';
      this.notifyListeners();
    };

    utterance.onend = () => {
      this.isPlaying = false;
      this.currentPlayingId = null;
      this.currentUtterance = null;
      this.notifyListeners();
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isPlaying = false;
      this.currentPlayingId = null;
      this.currentUtterance = null;
      this.notifyListeners();
      options.onError?.(e);
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  /**
   * Reproduz mensagem bilíngue com a voz neural Gemini de forma contínua e fluida
   */
  public async speakBilingualSequentially(
    rawText: string,
    defaultTargetLang = 'en-US',
    options: SpeechOptions = {},
    trackingId?: string
  ): Promise<void> {
    // Para o modelo Gemini TTS neural, o texto higienizado completo é pronunciado com
    // entonação nativa perfeita bilíngue em uma única tomada contínua.
    await this.speak(rawText, { ...options, lang: defaultTargetLang }, trackingId);
  }

  /**
   * Interrompe qualquer áudio ou síntese em reprodução imediatamente
   */
  public stop() {
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch (e) {}
      this.currentAudioElement = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    this.isPlaying = false;
    this.currentPlayingId = null;
    this.currentUtterance = null;
    this.notifyListeners();
  }

  public isCurrentlyPlaying(id?: string): boolean {
    if (!this.isPlaying) return false;
    if (!id) return this.isPlaying;
    return this.currentPlayingId === id;
  }

  public subscribe(listener: (playing: boolean, id: string | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.isPlaying, this.currentPlayingId);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn(this.isPlaying, this.currentPlayingId));
  }
}

export const SpeechService = new SpeechSynthesisManager();
