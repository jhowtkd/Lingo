import { CalendarEventProposal } from '../types';

export interface CalendarAuthToken {
  accessToken: string | null;
  userEmail?: string;
  connected: boolean;
}

const CALENDAR_TOKEN_KEY = 'tutor_google_calendar_token_v1';

export const CalendarService = {
  // Estado da conexão
  getAuthState(): CalendarAuthToken {
    const raw = localStorage.getItem(CALENDAR_TOKEN_KEY);
    if (!raw) return { accessToken: null, connected: false };
    try {
      return JSON.parse(raw);
    } catch {
      return { accessToken: null, connected: false };
    }
  },

  setAuthState(state: CalendarAuthToken) {
    localStorage.setItem(CALENDAR_TOKEN_KEY, JSON.stringify(state));
  },

  disconnect() {
    localStorage.removeItem(CALENDAR_TOKEN_KEY);
  },

  // Gera arquivo .ics para download universal
  generateICSFile(events: CalendarEventProposal[]): string {
    const formatDate = (isoStr: string) => {
      return new Date(isoStr)
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0] + 'Z';
    };

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tutor Pedagogico//Estudos e Revisao Espacada//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ].join('\r\n');

    for (const ev of events) {
      const dtStart = formatDate(ev.inicio);
      const dtEnd = formatDate(ev.fim);
      const now = formatDate(new Date().toISOString());

      const eventBlock = [
        'BEGIN:VEVENT',
        `UID:${ev.id}@tutorpedagogico.app`,
        `DTSTAMP:${now}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${ev.titulo}`,
        `DESCRIPTION:${ev.descricao.replace(/\n/g, '\\n')} - Tópicos: ${ev.topicos.join(', ')}`,
        'STATUS:CONFIRMED',
        'CATEGORIES:Estudos,Revisão Espaçada',
        'END:VEVENT',
      ].join('\r\n');

      icsContent += '\r\n' + eventBlock;
    }

    icsContent += '\r\nEND:VCALENDAR';
    return icsContent;
  },

  // Faz o download do arquivo .ics no navegador
  downloadICS(events: CalendarEventProposal[], filename = 'plano-de-estudos-tutor.ics') {
    const icsData = this.generateICSFile(events);
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Cria evento real no Google Calendar (requer autorização explícita)
  async createGoogleCalendarEvent(
    event: CalendarEventProposal,
    token: string
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      const payload = {
        summary: event.titulo,
        description: `${event.descricao}\n\n📚 Tópicos: ${event.topicos.join(', ')}\n🎯 Prioridade: ${event.prioridade}\n🤖 Gerado pelo Tutor Conversacional Pedagógico`,
        start: {
          dateTime: new Date(event.inicio).toISOString(),
        },
        end: {
          dateTime: new Date(event.fim).toISOString(),
        },
        colorId: event.tipo === 'revisao_espacada' ? '9' : '10', // Cores distintas no Google Calendar
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 15 },
            { method: 'email', minutes: 60 },
          ],
        },
      };

      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP ${res.status}`);
      }

      const created = await res.json();
      return { success: true, eventId: created.id };
    } catch (err: any) {
      console.error('Erro ao criar evento no Google Calendar:', err);
      return { success: false, error: err.message };
    }
  },
};
