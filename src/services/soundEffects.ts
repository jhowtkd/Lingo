/**
 * Sound Effects Engine (Web Audio API)
 * Gera efeitos sonoros sintéticos de alta fidelidade sem necessidade de assets externos.
 * Totalmente configurável, com suporte a volume, mudo e persistência em localStorage.
 */

export type SfxType =
  | 'click'
  | 'pop'
  | 'word_tap'
  | 'success'
  | 'error'
  | 'notification'
  | 'level_up'
  | 'xp_gain'
  | 'flip'
  | 'card_flip'
  | 'streak';

class SoundEffectsService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5; // 0.0 a 1.0

  constructor() {
    // Carrega preferências salvas
    try {
      const savedMute = localStorage.getItem('lingo_sfx_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
      const savedVol = localStorage.getItem('lingo_sfx_volume');
      if (savedVol !== null) {
        this.volume = Math.max(0, Math.min(1, parseFloat(savedVol) || 0.5));
      }
    } catch {
      // Ignora erro de localStorage
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setIsMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('lingo_sfx_muted', String(muted));
    } catch {}
  }

  public toggleMute(): boolean {
    this.setIsMuted(!this.isMuted);
    if (!this.isMuted) {
      this.play('pop');
    }
    return this.isMuted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('lingo_sfx_volume', String(this.volume));
    } catch {}
  }

  /**
   * Toca um efeito sonoro sintetizado
   */
  public play(type: SfxType) {
    if (this.isMuted || this.volume <= 0) return;

    try {
      const ctx = this.initContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.volume * 0.4, now);
      masterGain.connect(ctx.destination);

      switch (type) {
        case 'click': {
          // Clique mecânico suave e nítido
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now);
          osc.stop(now + 0.045);
          break;
        }

        case 'pop': {
          // Pop moderno estilo bolha
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(950, now + 0.06);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now);
          osc.stop(now + 0.085);
          break;
        }

        case 'word_tap': {
          // Toque suave em palavra (duplo micro-tom agradável)
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc2.type = 'triangle';
          osc1.frequency.setValueAtTime(659.25, now); // E5
          osc1.frequency.exponentialRampToValueAtTime(880, now + 0.05); // A5
          osc2.frequency.setValueAtTime(1318.5, now); // E6

          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(masterGain);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.075);
          osc2.stop(now + 0.075);
          break;
        }

        case 'success': {
          // Acorde triunfante suave C-E-G (Dó Maior ascendente)
          const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
          freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const noteTime = now + idx * 0.06;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(0.28, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(noteTime);
            osc.stop(noteTime + 0.36);
          });
          break;
        }

        case 'error': {
          // Tom sutil de alerta (não agressivo, tom descendente duplo)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.setValueAtTime(260, now + 0.08);

          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(now);
          osc.stop(now + 0.23);
          break;
        }

        case 'notification': {
          // Chime de 2 notas cristalinas para nova mensagem do tutor
          const notes = [880, 1174.66]; // A5 -> D6
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const noteTime = now + idx * 0.09;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(0.2, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(noteTime);
            osc.stop(noteTime + 0.3);
          });
          break;
        }

        case 'level_up': {
          // Sequência triunfante de subida de nível / conquista
          const notes = [440, 554.37, 659.25, 880, 1108.73]; // A4, C#5, E5, A5, C#6
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const noteTime = now + idx * 0.08;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(0.3, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(noteTime);
            osc.stop(noteTime + 0.46);
          });
          break;
        }

        case 'xp_gain': {
          // Brilho sutil ascendente de XP
          const notes = [698.46, 880, 1046.5]; // F5 -> A5 -> C6
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const noteTime = now + idx * 0.045;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(0.22, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(noteTime);
            osc.stop(noteTime + 0.2);
          });
          break;
        }

        case 'card_flip':
        case 'flip': {
          // Virada suave de cartão com ruído branco filtrado
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.exponentialRampToValueAtTime(480, now + 0.06);

          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(now);
          osc.stop(now + 0.095);
          break;
        }

        case 'streak': {
          // Sequência rápida de faísca de streak
          const notes = [587.33, 739.99, 880, 1174.66];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const noteTime = now + idx * 0.05;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(0.25, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(noteTime);
            osc.stop(noteTime + 0.26);
          });
          break;
        }
      }
    } catch (err) {
      // Ignora silenciosamente erros em navegadores sem suporte
      console.warn('Erro ao reproduzir SFX:', err);
    }
  }
}

export const sfx = new SoundEffectsService();
export const playSfx = (type: SfxType) => sfx.play(type);
