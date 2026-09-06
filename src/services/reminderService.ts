import { PracticeReminder } from '../types';
import { StorageService } from './storage';

export type NotificationCallback = (reminder: PracticeReminder) => void;

class ReminderNotificationService {
  private activeListeners: Set<NotificationCallback> = new Set();
  private intervalId: any = null;

  init() {
    if (typeof window === 'undefined') return;
    if (this.intervalId) return;

    // Checar a cada 30 segundos
    this.intervalId = setInterval(() => {
      this.checkScheduledReminders();
    }, 30000);

    // Checa imediatamente
    this.checkScheduledReminders();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  subscribe(callback: NotificationCallback) {
    this.activeListeners.add(callback);
    return () => {
      this.activeListeners.delete(callback);
    };
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return await Notification.requestPermission();
  }

  getPermissionState(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  playReminderChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();

      // Duas notas harmônicas agradáveis (C5 -> G5)
      const now = audioCtx.currentTime;

      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(783.99, now + 0.15); // G5
      // Libera o contexto ao terminar: sem isso, um AudioContext novo vaza
      // (thread de áudio + handles do dispositivo) a cada lembrete.
      gain2.gain.setValueAtTime(0, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.25, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.8);

      osc2.onended = () => {
        audioCtx.close().catch(() => {});
      };
    } catch (e) {
      console.warn('Não foi possível tocar som de notificação:', e);
    }
  }

  triggerReminder(reminder: PracticeReminder) {
    // 1. Toca som
    if (reminder.tipo_notificacao === 'browser' || reminder.tipo_notificacao === 'som') {
      this.playReminderChime();
    }

    // 2. Dispara Notificação do Navegador se permitido
    if (
      reminder.tipo_notificacao === 'browser' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(`⏰ Hora do Treino: ${reminder.titulo}`, {
          body: reminder.topico
            ? `Tópico de foco: ${reminder.topico}. Dedique alguns minutos para manter sua fluência ativa!`
            : 'Sua sessão diária de conversação e prática está pronta.',
          icon: '/favicon.ico',
          tag: reminder.id,
        });
      } catch (e) {
        console.error('Erro ao exibir Notificação nativa:', e);
      }
    }

    // 3. Notifica ouvintes in-app (Toasts visuais)
    this.activeListeners.forEach((cb) => {
      try {
        cb(reminder);
      } catch (err) {
        console.error(err);
      }
    });

    // 4. Grava último disparo no storage
    const reminders = StorageService.getReminders();
    const target = reminders.find((r) => r.id === reminder.id);
    if (target) {
      target.ultimo_disparo = new Date().toISOString();
      StorageService.saveReminders(reminders);
    }
  }

  private checkScheduledReminders() {
    const reminders = StorageService.getReminders();
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Domingo ... 6 = Sábado
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const todayDateStr = now.toISOString().slice(0, 10);

    reminders.forEach((rem) => {
      if (!rem.ativo) return;
      if (!rem.dias_semana.includes(currentDay)) return;

      // Se já disparou hoje neste mesmo minuto, ignorar
      if (rem.ultimo_disparo && rem.ultimo_disparo.startsWith(todayDateStr)) {
        const lastDate = new Date(rem.ultimo_disparo);
        if (
          lastDate.getHours() === now.getHours() &&
          lastDate.getMinutes() === now.getMinutes()
        ) {
          return;
        }
      }

      // Comparação de horário (considerando antecedência se configurada)
      const [rHour, rMin] = rem.horario.split(':').map(Number);
      const targetDate = new Date(now);
      targetDate.setHours(rHour, rMin, 0, 0);

      const triggerDate = new Date(targetDate.getTime() - rem.antecedencia_minutos * 60000);
      const triggerHourStr = triggerDate.getHours().toString().padStart(2, '0');
      const triggerMinStr = triggerDate.getMinutes().toString().padStart(2, '0');
      const triggerTimeStr = `${triggerHourStr}:${triggerMinStr}`;

      if (currentTimeStr === triggerTimeStr) {
        this.triggerReminder(rem);
      }
    });
  }
}

export const ReminderService = new ReminderNotificationService();
