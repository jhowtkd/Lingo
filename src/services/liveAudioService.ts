export type LiveConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'speaking'
  | 'listening'
  | 'error'
  | 'closed';

export interface LiveTranscriptItem {
  id: string;
  speaker: 'user' | 'tutor';
  text: string;
  timestamp: string;
  isPartial?: boolean;
}

export class GeminiLiveVoiceService {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaSource: MediaStreamAudioSourceNode | null = null;

  private isConnected = false;
  private isMuted = false;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  // Callbacks
  public onStateChange?: (state: LiveConnectionState, details?: string) => void;
  public onTranscript?: (item: LiveTranscriptItem) => void;
  public onVolumeLevel?: (level: number, source: 'user' | 'tutor') => void;
  public onError?: (err: string) => void;

  async connect(
    topic: string,
    studentLevel: string,
    options?: { voice?: string; lang?: string }
  ): Promise<void> {
    this.onStateChange?.('connecting');

    try {
      // 1. Inicia conexões de áudio do navegador
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });

      // Resume contextos se estiverem suspensos
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      // 2. Conecta ao WebSocket do backend com parâmetros completos
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const voiceParam = options?.voice ? `&voice=${encodeURIComponent(options.voice)}` : '';
      const langParam = options?.lang ? `&lang=${encodeURIComponent(options.lang)}` : '';
      const wsUrl = `${protocol}//${window.location.host}/live?topic=${encodeURIComponent(topic)}&level=${encodeURIComponent(studentLevel)}${voiceParam}${langParam}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        this.isConnected = true;
        this.onStateChange?.('connected');
        await this.startMicrophoneCapture();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('Erro ao processar mensagem do Live WebSocket:', e);
        }
      };

      this.ws.onerror = (e) => {
        console.error('Erro no WebSocket Live:', e);
        this.onError?.('Falha na conexão de voz em tempo real.');
        this.onStateChange?.('error', 'Erro na conexão com o servidor');
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.cleanupAudio();
        this.onStateChange?.('closed');
      };
    } catch (err: any) {
      console.error('Erro ao inicializar Gemini Live:', err);
      this.cleanupAudio();
      this.onStateChange?.('error', err.message || 'Erro ao acessar microfone');
      throw err;
    }
  }

  private async startMicrophoneCapture(): Promise<void> {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!this.inputAudioCtx) return;

      this.mediaSource = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      // ScriptProcessorNode para coletar e converter PCM
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);

        // Calcula volume para visualizador
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const volumeLevel = Math.min(100, Math.round(rms * 150));
        this.onVolumeLevel?.(volumeLevel, 'user');

        if (volumeLevel > 5) {
          this.onStateChange?.('listening');
        }

        // Converte Float32 para 16-bit PCM Little Endian
        const pcm16Base64 = this.floatTo16BitPCMBase64(inputData);
        this.ws.send(JSON.stringify({ audio: pcm16Base64 }));
      };

      this.mediaSource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);
    } catch (micErr: any) {
      console.error('Erro ao capturar microfone:', micErr);
      this.onError?.('Permissão de microfone negada.');
      throw micErr;
    }
  }

  private handleServerMessage(msg: any): void {
    if (msg.type === 'audio' && msg.audio) {
      this.onStateChange?.('speaking');
      this.playAudioChunk(msg.audio);
    } else if (msg.type === 'interrupted') {
      this.stopCurrentAudioPlayback();
      this.onStateChange?.('listening');
    } else if (msg.type === 'tutor_text' && msg.text) {
      this.onTranscript?.({
        id: `tutor-live-${Date.now()}`,
        speaker: 'tutor',
        text: msg.text,
        timestamp: new Date().toISOString(),
      });
    } else if (msg.type === 'user_text' && msg.text) {
      this.onTranscript?.({
        id: `user-live-${Date.now()}`,
        speaker: 'user',
        text: msg.text,
        timestamp: new Date().toISOString(),
      });
    } else if (msg.type === 'turn_complete') {
      this.onStateChange?.('connected');
    } else if (msg.type === 'error') {
      this.onError?.(msg.error);
    }
  }

  private playAudioChunk(base64Audio: string): void {
    if (!this.outputAudioCtx) return;

    try {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);

      let sum = 0;
      for (let i = 0; i < int16Array.length; i++) {
        const floatVal = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
        float32Array[i] = floatVal;
        sum += floatVal * floatVal;
      }

      // Calcula volume de saída para animação
      const rms = Math.sqrt(sum / float32Array.length);
      const volumeLevel = Math.min(100, Math.round(rms * 160));
      this.onVolumeLevel?.(volumeLevel, 'tutor');

      // Cria AudioBuffer a 24000Hz (frequência nativa do Gemini Live)
      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.push(source);
      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx >= 0) this.activeSources.splice(idx, 1);
        if (this.activeSources.length === 0) {
          this.onStateChange?.('connected');
        }
      };
    } catch (e) {
      console.error('Erro ao tocar chunk de áudio do Gemini Live:', e);
    }
  }

  private stopCurrentAudioPlayback(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    }
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  sendTextMessage(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text }));
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  disconnect(): void {
    this.stopCurrentAudioPlayback();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanupAudio();
    this.isConnected = false;
    this.onStateChange?.('idle');
  }

  private cleanupAudio(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.mediaSource) {
      this.mediaSource.disconnect();
      this.mediaSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.inputAudioCtx && this.inputAudioCtx.state !== 'closed') {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx && this.outputAudioCtx.state !== 'closed') {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
  }

  private floatTo16BitPCMBase64(float32Array: Float32Array): string {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
