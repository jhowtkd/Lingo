import { apiFetch } from '../lib/api';

export type AudioRecordingStatus =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'completed'
  | 'error';

export interface AudioTranscriptionResult {
  text: string;
  confidence?: number;
  error?: string;
  audioBase64?: string;
  mimeType?: string;
  durationSeconds?: number;
}

export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private durationSeconds: number = 0;

  async startRecording(): Promise<boolean> {
    try {
      this.audioChunks = [];
      this.startTime = Date.now();
      this.durationSeconds = 0;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Seleciona mime type suportado
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(250);
      return true;
    } catch (err: any) {
      console.error('Erro ao iniciar gravação de áudio:', err);
      throw err;
    }
  }

  async stopRecordingAndTranscribe(
    idioma = 'pt-BR'
  ): Promise<AudioTranscriptionResult> {
    const elapsedMs = this.startTime > 0 ? Date.now() - this.startTime : 1000;
    this.durationSeconds = Math.max(1, Math.round((elapsedMs / 1000) * 10) / 10);
    const recordedDuration = this.durationSeconds;

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('Gravador não inicializado'));
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(this.audioChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });

          // Limpa tracks do microfone imediatamente para garantir privacidade
          if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
          }

          // Converte para base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string) || '';
            try {
              // Envia ao endpoint seguro do servidor
              const response = await apiFetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audio_base64: base64Audio,
                  mime_type: audioBlob.type,
                  idioma,
                }),
              });

              if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
              }

              const data = await response.json();
              resolve({
                text: data.texto || '',
                confidence: data.confianca || 0.9,
                audioBase64: base64Audio,
                mimeType: audioBlob.type,
                durationSeconds: recordedDuration,
              });
            } catch (apiErr: any) {
              console.warn('Falha no endpoint /api/transcribe, tentando fallback local...', apiErr);
              resolve({
                text: '',
                confidence: 0,
                error: apiErr instanceof Error ? apiErr.message : 'Falha na transcrição',
                audioBase64: base64Audio,
                mimeType: audioBlob.type,
                durationSeconds: recordedDuration,
              });
            }
          };
        } catch (err: any) {
          reject(err);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  cancelRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.audioChunks = [];
  }
}

/**
 * Utilitário para capturar MediaStream para visualização de espectro
 */
export async function requestMicrophoneStream(): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}
