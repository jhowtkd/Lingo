import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  LogOut,
  CalendarCheck,
  Info,
  Bell,
  BellRing,
  BellOff,
  Plus,
  Trash2,
  Volume2,
  Play,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarEventProposal, PracticeReminder } from '../types';
import { CalendarService, CalendarAuthToken } from '../services/calendarService';
import { StorageService } from '../services/storage';
import { ReminderService } from '../services/reminderService';

const DAYS_OF_WEEK = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 },
];

export const CalendarPlanning: React.FC = () => {
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [preferredTime, setPreferredTime] = useState('19:00');
  const [proposals, setProposals] = useState<CalendarEventProposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [authState, setAuthState] = useState<CalendarAuthToken>({
    accessToken: null,
    connected: false,
  });

  // Sistema de Lembretes Locais & Notificações
  const [reminders, setReminders] = useState<PracticeReminder[]>([]);
  const [isCreatingReminder, setIsCreatingReminder] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [activeAlertReminder, setActiveAlertReminder] = useState<PracticeReminder | null>(null);

  // Form State para Novo Lembrete
  const [remTitle, setRemTitle] = useState('');
  const [remTopic, setRemTopic] = useState('');
  const [remTime, setRemTime] = useState('19:00');
  const [remDays, setRemDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [remAdvance, setRemAdvance] = useState<number>(5);
  const [remType, setRemType] = useState<'browser' | 'som' | 'visual'>('browser');

  // Modal de Confirmação Explícita Google Calendar
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedEventToSync, setSelectedEventToSync] = useState<CalendarEventProposal | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    inProgress: boolean;
    successMessage?: string;
    errorMessage?: string;
  }>({ inProgress: false });

  // Token input manual para testes/OAuth Bearer
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [showTokenField, setShowTokenField] = useState(false);

  useEffect(() => {
    setAuthState(CalendarService.getAuthState());
    setReminders(StorageService.getReminders());
    generateProposals();

    // Inicializa serviço de lembretes e checa permissão de notificação
    ReminderService.init();
    setNotificationPermission(ReminderService.getPermissionState());

    const unsubscribe = ReminderService.subscribe((rem) => {
      setActiveAlertReminder(rem);
      setReminders(StorageService.getReminders());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRequestPermission = async () => {
    const perm = await ReminderService.requestPermission();
    setNotificationPermission(perm);
  };

  const handleToggleReminder = (id: string) => {
    StorageService.toggleReminder(id);
    setReminders(StorageService.getReminders());
  };

  const handleDeleteReminder = (id: string) => {
    StorageService.deleteReminder(id);
    setReminders(StorageService.getReminders());
  };

  const handleTestReminder = (reminder: PracticeReminder) => {
    ReminderService.triggerReminder(reminder);
  };

  const handleSaveNewReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) return;

    const newReminder: PracticeReminder = {
      id: `rem-${Date.now()}`,
      titulo: remTitle.trim(),
      topico: remTopic.trim() || undefined,
      horario: remTime,
      dias_semana: remDays.length > 0 ? remDays : [1, 2, 3, 4, 5],
      ativo: true,
      tipo_notificacao: remType,
      antecedencia_minutos: remAdvance,
      criado_em: new Date().toISOString(),
    };

    StorageService.addReminder(newReminder);
    setReminders(StorageService.getReminders());
    setIsCreatingReminder(false);
    setRemTitle('');
    setRemTopic('');
  };

  const handleCreateReminderFromProposal = (proposal: CalendarEventProposal) => {
    const startDate = new Date(proposal.inicio);
    const timeStr = startDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const dayOfWeek = startDate.getDay();

    const newReminder: PracticeReminder = {
      id: `rem-prop-${Date.now()}`,
      titulo: `Sessão: ${proposal.titulo}`,
      topico: proposal.topicos.join(', '),
      horario: timeStr,
      dias_semana: [dayOfWeek],
      ativo: true,
      tipo_notificacao: 'browser',
      antecedencia_minutos: 10,
      criado_em: new Date().toISOString(),
      origem_sessao_id: proposal.id,
    };

    StorageService.addReminder(newReminder);
    setReminders(StorageService.getReminders());
  };

  const toggleDaySelection = (day: number) => {
    if (remDays.includes(day)) {
      setRemDays(remDays.filter((d) => d !== day));
    } else {
      setRemDays([...remDays, day].sort());
    }
  };

  const generateProposals = async () => {
    setIsLoading(true);
    const nodes = StorageService.getNodes();
    const hardTopics = nodes
      .filter((n) => n.tipo === 'dificuldade' || n.frequencia_erro > 0)
      .map((n) => n.titulo);
    const pendingReviews = nodes
      .filter((n) => new Date(n.proxima_revisao) <= new Date())
      .map((n) => n.titulo);

    try {
      const res = await fetch('/api/calendar/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dias_disponiveis: 7,
          duracao_sessao_min: durationMinutes,
          horario_preferido: preferredTime,
          topicos_dificeis: hardTopics,
          revisoes_pendentes: pendingReviews,
        }),
      });

      if (!res.ok) throw new Error('Falha ao obter propostas');
      const data = await res.json();
      setProposals(data.propostas || []);
    } catch (err) {
      console.error('Erro ao gerar propostas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportICS = () => {
    if (proposals.length === 0) return;
    CalendarService.downloadICS(proposals);
  };

  const handleConnectToken = () => {
    if (!manualTokenInput.trim()) return;
    const newState: CalendarAuthToken = {
      accessToken: manualTokenInput.trim(),
      userEmail: 'estudante@google.com',
      connected: true,
    };
    CalendarService.setAuthState(newState);
    setAuthState(newState);
    setShowTokenField(false);
  };

  const handleDisconnect = () => {
    if (window.confirm('Deseja desconectar a integração com o Google Calendar?')) {
      CalendarService.disconnect();
      setAuthState({ accessToken: null, connected: false });
    }
  };

  const handleOpenSyncModal = (event?: CalendarEventProposal) => {
    setSelectedEventToSync(event || null);
    setShowConfirmModal(true);
    setSyncStatus({ inProgress: false });
  };

  const handleConfirmGoogleCalendarSync = async () => {
    if (!authState.accessToken) {
      setSyncStatus({
        inProgress: false,
        errorMessage: 'Conecte sua conta do Google com o token OAuth para criar eventos reais.',
      });
      return;
    }

    setSyncStatus({ inProgress: true });

    const eventsToCreate = selectedEventToSync ? [selectedEventToSync] : proposals;
    let createdCount = 0;
    let lastError = '';

    for (const ev of eventsToCreate) {
      const res = await CalendarService.createGoogleCalendarEvent(ev, authState.accessToken);
      if (res.success) {
        createdCount++;
      } else {
        lastError = res.error || 'Erro desconhecido';
      }
    }

    if (createdCount > 0) {
      setSyncStatus({
        inProgress: false,
        successMessage: `${createdCount} evento(s) criado(s) com sucesso no seu Google Calendar!`,
      });
    } else {
      setSyncStatus({
        inProgress: false,
        errorMessage: `Não foi possível criar os eventos no Google Calendar: ${lastError}`,
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toast / Alerta Ativo de Lembrete Disparado */}
      <AnimatePresence>
        {activeAlertReminder && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-[var(--surface)] border-2 border-[var(--sunny)] rounded-[var(--r-lg)] shadow-xl text-[var(--fg)] flex items-center justify-between gap-4"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-[var(--r-md)] bg-[var(--sunny)] flex items-center justify-center text-[var(--fg)] animate-bounce font-bold">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-[var(--fg)]">
                    ⏰ Lembrete de Estudo Agendado
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface-sunken)] text-[var(--fg)] font-mono font-bold">
                    {activeAlertReminder.horario}
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-[var(--fg)]">
                  {activeAlertReminder.titulo}
                </h4>
                {activeAlertReminder.topico && (
                  <p className="text-xs text-[var(--muted)] font-mono">
                    Foco pedagógico: <span className="font-semibold text-[var(--fg)]">{activeAlertReminder.topico}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 font-mono">
              <button
                onClick={() => setActiveAlertReminder(null)}
                className="px-3.5 py-1.5 bg-[var(--fg)] hover:bg-[var(--fg)]/90 text-[var(--bg)] text-xs font-bold rounded-full transition shadow-xs cursor-pointer font-sans"
              >
                Dispensar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabeçalho */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-6 shadow-[var(--shadow-sm)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-[var(--fg)]" />
            <h2 className="text-xl font-display font-bold text-[var(--fg)]">Planejamento & Lembretes de Estudos</h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-1 font-mono">
            Gere um cronograma diário adaptado às suas dificuldades, agende lembretes locais e sincronize com o Google Calendar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto font-mono">
          <button
            onClick={handleExportICS}
            className="px-4 py-2 bg-[oklch(0.96_0.01_84)] hover:bg-[oklch(0.92_0.01_84)] text-[var(--fg)] border border-[var(--border)] rounded-full text-xs font-semibold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title="Download de arquivo padrão .ics compatível com todos os calendários"
          >
            <Download className="w-4 h-4" />
            <span>Exportar .ICS</span>
          </button>

          <button
            onClick={() => handleOpenSyncModal()}
            className="px-4 py-2 bg-[var(--fg)] hover:bg-[var(--fg)]/90 text-[var(--bg)] rounded-full text-xs font-semibold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Sincronizar Google Calendar</span>
          </button>
        </div>
      </div>

      {/* NOVO: Sistema de Lembretes & Notificações de Prática (Persistido Localmente) */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow-sm)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-[var(--r-md)] bg-[var(--sunny)] text-[var(--fg)] flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold font-display text-[var(--fg)]">
                  Lembretes de Prática & Notificações
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[oklch(0.96_0.01_84)] text-[var(--fg)] border border-[var(--border)]">
                  {reminders.filter((r) => r.ativo).length} ativos
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] font-mono">
                Horários salvos no armazenamento local com alertas sonoros e notificações do navegador.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 font-mono">
            {notificationPermission !== 'granted' ? (
              <button
                onClick={handleRequestPermission}
                className="px-3 py-1.5 bg-[var(--sunny)]/20 hover:bg-[var(--sunny)]/30 text-[var(--fg)] border border-[var(--sunny)] rounded-full text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                title="Ativar permissão de notificações nativas no navegador"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Ativar Notificações</span>
              </button>
            ) : (
              <span className="px-2.5 py-1 bg-[var(--mint)] text-[var(--ok)] border border-[var(--ok)]/30 rounded-full text-[11px] font-bold flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>Notificações Permitidas</span>
              </span>
            )}

            <button
              onClick={() => setIsCreatingReminder(!isCreatingReminder)}
              className="px-3.5 py-1.5 bg-[var(--fg)] hover:bg-[var(--fg)]/90 text-[var(--bg)] rounded-full text-xs font-bold flex items-center space-x-1.5 transition shadow-xs cursor-pointer font-sans"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreatingReminder ? 'Fechar' : 'Novo Lembrete'}</span>
            </button>
          </div>
        </div>

        {/* Formulário de Criação de Lembrete */}
        <AnimatePresence>
          {isCreatingReminder && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSaveNewReminder}
              className="p-4 bg-[oklch(0.97_0.01_84)] border border-[var(--border)] rounded-[var(--r-md)] space-y-4 text-xs font-mono overflow-hidden"
            >
              <h4 className="font-bold text-[var(--fg)] text-sm font-sans flex items-center space-x-1.5">
                <Plus className="w-4 h-4 text-[var(--fg)]" />
                <span>Agendar Novo Horário de Prática</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[var(--muted)]">Título da Notificação:</label>
                  <input
                    type="text"
                    value={remTitle}
                    onChange={(e) => setRemTitle(e.target.value)}
                    placeholder="Ex: Treino Diário de Pronúncia & Fluência"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-sm)] p-2 text-[var(--fg)] focus:outline-none focus:border-[var(--fg)] shadow-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[var(--muted)]">Tópico de Foco (Opcional):</label>
                  <input
                    type="text"
                    value={remTopic}
                    onChange={(e) => setRemTopic(e.target.value)}
                    placeholder="Ex: Connected Speech, Phrasal Verbs, Gramática"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-sm)] p-2 text-[var(--fg)] focus:outline-none focus:border-[var(--fg)] shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[var(--muted)]">Horário do Lembrete:</label>
                  <input
                    type="time"
                    value={remTime}
                    onChange={(e) => setRemTime(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-sm)] p-2 text-[var(--fg)] font-semibold focus:outline-none focus:border-[var(--fg)] shadow-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[var(--muted)]">Avisar com antecedência:</label>
                  <select
                    value={remAdvance}
                    onChange={(e) => setRemAdvance(Number(e.target.value))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-sm)] p-2 text-[var(--fg)] font-semibold focus:outline-none focus:border-[var(--fg)] shadow-xs cursor-pointer"
                  >
                    <option value={0}>Exato no horário</option>
                    <option value={5}>5 minutos antes</option>
                    <option value={10}>10 minutos antes</option>
                    <option value={15}>15 minutos antes</option>
                    <option value={30}>30 minutos antes</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[var(--muted)]">Modo de Alerta:</label>
                  <select
                    value={remType}
                    onChange={(e) => setRemType(e.target.value as any)}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-sm)] p-2 text-[var(--fg)] font-semibold focus:outline-none focus:border-[var(--fg)] shadow-xs cursor-pointer"
                  >
                    <option value="browser">🔔 Notificação Navegador + Som</option>
                    <option value="som">🔊 Somente Sino Sonoro</option>
                    <option value="visual">👁️ Notificação Visual In-App</option>
                  </select>
                </div>
              </div>

              {/* Seletor de Dias da Semana */}
              <div className="space-y-1.5">
                <label className="font-bold text-[var(--muted)]">Repetir nos dias da semana:</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((d) => {
                    const isSelected = remDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDaySelection(d.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs'
                            : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setRemDays([1, 2, 3, 4, 5])}
                    className="text-[11px] text-[var(--fg)] hover:underline px-2 font-semibold cursor-pointer"
                  >
                    Seg-Sex
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemDays([0, 1, 2, 3, 4, 5, 6])}
                    className="text-[11px] text-[var(--fg)] hover:underline px-2 font-semibold cursor-pointer"
                  >
                    Todos os dias
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsCreatingReminder(false)}
                  className="px-3.5 py-2 bg-[var(--surface)] border border-[var(--border)] hover:bg-[oklch(0.96_0.01_84)] text-[var(--fg)] rounded-full font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--fg)] hover:bg-[var(--fg)]/90 text-[var(--bg)] rounded-full font-bold transition shadow-xs flex items-center space-x-1 cursor-pointer font-sans"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Lembrete no LocalStorage</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Lista de Lembretes Salvos */}
        {reminders.length === 0 ? (
          <div className="p-6 text-center text-[var(--muted)] bg-[oklch(0.97_0.01_84)] border border-dashed border-[var(--border)] rounded-[var(--r-md)] space-y-1 text-xs font-mono">
            <BellOff className="w-6 h-6 mx-auto text-[var(--muted)]/50 mb-1" />
            <p className="font-semibold text-[var(--fg)]">Nenhum lembrete configurado no momento.</p>
            <p>Clique em "Novo Lembrete" ou use o botão de atalho nas sessões sugeridas abaixo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
            {reminders.map((r) => (
              <div
                key={r.id}
                className={`p-3.5 rounded-[var(--r-md)] border transition flex flex-col justify-between space-y-2.5 ${
                  r.ativo
                    ? 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--fg)]/40 shadow-xs'
                    : 'bg-[oklch(0.96_0.01_84)] border-[var(--border)] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-[var(--fg)] text-sm font-sans">{r.titulo}</span>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--sunny)]/30 text-[var(--fg)]">
                        {r.horario}
                      </span>
                    </div>
                    {r.topico && (
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        Tópico: <strong className="text-[var(--fg)]">{r.topico}</strong>
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleReminder(r.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition cursor-pointer ${
                      r.ativo
                        ? 'bg-[var(--mint)] text-[var(--ok)] border border-[var(--ok)]/30'
                        : 'bg-[oklch(0.92_0.01_84)] text-[var(--muted)]'
                    }`}
                  >
                    {r.ativo ? 'ATIVO' : 'PAUSADO'}
                  </button>
                </div>

                {/* Dias da semana e antecedência */}
                <div className="flex items-center justify-between text-[11px] text-[var(--muted)] border-t border-[var(--border)] pt-2">
                  <div className="flex items-center space-x-1">
                    {DAYS_OF_WEEK.map((d) => (
                      <span
                        key={d.value}
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                          r.dias_semana.includes(d.value)
                            ? 'bg-[var(--fg)] text-[var(--bg)]'
                            : 'bg-[oklch(0.92_0.01_84)] text-[var(--muted)]'
                        }`}
                      >
                        {d.label[0]}
                      </span>
                    ))}
                    {r.antecedencia_minutos > 0 && (
                      <span className="text-[10px] text-[var(--muted)] ml-1.5">
                        ({r.antecedencia_minutos}m antes)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleTestReminder(r)}
                      className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[oklch(0.94_0.01_84)] rounded-full transition cursor-pointer"
                      title="Testar som e disparo imediato deste lembrete"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteReminder(r.id)}
                      className="p-1.5 text-[var(--muted)] hover:text-rose-600 hover:bg-rose-50 rounded-full transition cursor-pointer"
                      title="Excluir lembrete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configurações de Sessão e Disponibilidade */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-5 shadow-[var(--shadow-sm)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm font-mono">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[var(--muted)]" />
              <span className="text-[var(--fg)] font-medium font-sans">Duração diária:</span>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="bg-[oklch(0.97_0.01_84)] border border-[var(--border)] rounded-[var(--r-sm)] px-2.5 py-1 text-[var(--fg)] font-semibold focus:outline-none focus:border-[var(--fg)]"
              >
                <option value={15}>15 minutos (Rápido)</option>
                <option value={30}>30 minutos (Padrão)</option>
                <option value={45}>45 minutos (Recomendado)</option>
                <option value={60}>60 minutos (Intensivo)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[var(--fg)] font-medium font-sans">Horário preferencial:</span>
              <input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="bg-[oklch(0.97_0.01_84)] border border-[var(--border)] rounded-[var(--r-sm)] px-2 py-1 text-[var(--fg)] font-semibold focus:outline-none focus:border-[var(--fg)]"
              />
            </div>
          </div>

          <button
            onClick={generateProposals}
            disabled={isLoading}
            className="px-4 py-2 bg-[oklch(0.96_0.01_84)] hover:bg-[oklch(0.92_0.01_84)] text-[var(--fg)] border border-[var(--border)] rounded-full text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Recalcular Sugestões IA</span>
          </button>
        </div>

        {/* Status da Conexão OAuth */}
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between text-xs gap-2 font-mono">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[var(--ok)]" />
            <span className="text-[var(--fg)]">
              Status da Integração:{' '}
              {authState.connected ? (
                <span className="font-bold text-[var(--ok)]">
                  Conectado ao Google Calendar ({authState.userEmail || 'Autorizado'})
                </span>
              ) : (
                <span className="text-[var(--muted)]">
                  Desconectado (Fallback .ICS ativo ou conecte via token)
                </span>
              )}
            </span>
          </div>

          {authState.connected ? (
            <button
              onClick={handleDisconnect}
              className="text-rose-600 hover:underline flex items-center space-x-1 font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Desconectar Conta</span>
            </button>
          ) : (
            <button
              onClick={() => setShowTokenField(!showTokenField)}
              className="text-[var(--fg)] hover:underline font-semibold underline cursor-pointer"
            >
              {showTokenField ? 'Ocultar Configuração OAuth' : 'Configurar Token OAuth do Google'}
            </button>
          )}
        </div>

        {showTokenField && !authState.connected && (
          <div className="mt-3 p-3 bg-[oklch(0.97_0.01_84)] rounded-[var(--r-md)] border border-[var(--border)] space-y-2 text-xs font-mono">
            <p className="text-[var(--fg)]">
              Cole o Token de Acesso OAuth do Google (escopo: <code>calendar.events</code>) para habilitar a criação direta na nuvem:
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={manualTokenInput}
                onChange={(e) => setManualTokenInput(e.target.value)}
                placeholder="ya29.a0AfH6..."
                className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-sm)] px-3 py-1.5 text-xs text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--fg)] shadow-xs"
              />
              <button
                onClick={handleConnectToken}
                className="px-3 py-1.5 bg-[var(--fg)] hover:bg-[var(--fg)]/90 text-[var(--bg)] rounded-full font-bold shadow-xs cursor-pointer font-sans"
              >
                Conectar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prévia do Cronograma Semanal */}
      <div className="space-y-3">
        <h3 className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wider text-[var(--muted)] flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[var(--fg)]" />
          <span>Prévia das Próximas Sessões Sugeridas:</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {proposals.map((prop, idx) => {
            const startDate = new Date(prop.inicio);
            const diaSemana = startDate.toLocaleDateString('pt-BR', { weekday: 'long' });
            const dataFormatada = startDate.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            });
            const horaFormatada = startDate.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={prop.id || idx}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-4 flex flex-col justify-between space-y-3 hover:border-[var(--fg)]/40 shadow-[var(--shadow-sm)] transition"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1 font-mono">
                    <span className="font-bold text-[var(--fg)] capitalize">
                      {diaSemana}, {dataFormatada}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        prop.prioridade === 'alta'
                          ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                          : 'bg-[oklch(0.94_0.01_84)] text-[var(--fg)] border-[var(--border)]'
                      }`}
                    >
                      {prop.prioridade}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-[var(--fg)] font-display">{prop.titulo}</h4>
                  <p className="text-xs text-[var(--muted)] mt-1 font-mono">{prop.descricao}</p>
                </div>

                <div className="pt-2 border-t border-[var(--border)] text-xs space-y-2 font-mono">
                  <div className="flex items-center justify-between text-[var(--muted)]">
                    <span>Horário: {horaFormatada}</span>
                    <span>{prop.duracao_minutos} minutos</span>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {prop.topicos.map((t, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[oklch(0.96_0.01_84)] text-[var(--fg)] border border-[var(--border)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleCreateReminderFromProposal(prop)}
                      className="text-xs text-[var(--fg)] hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
                      title="Agendar lembrete sonoro local para este horário"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Agendar Lembrete</span>
                    </button>

                    <button
                      onClick={() => handleOpenSyncModal(prop)}
                      className="text-xs text-[var(--fg)] hover:underline font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Google Calendar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Confirmação Explícita Obrigatória */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] max-w-lg w-full p-6 space-y-4 shadow-2xl text-[var(--fg)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <div className="flex items-center space-x-2 text-[var(--fg)] font-bold font-display">
                <CalendarCheck className="w-5 h-5" />
                <h3>Confirmação de Agendamento</h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-[var(--muted)] hover:text-[var(--fg)] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs sm:text-sm text-[var(--fg)] space-y-2 font-mono">
              <p>
                Você está prestes a agendar{' '}
                <strong>
                  {selectedEventToSync
                    ? `1 sessão: "${selectedEventToSync.titulo}"`
                    : `${proposals.length} sessões de estudos da semana`}
                </strong>{' '}
                no seu calendário.
              </p>
              <div className="p-3 bg-[var(--sunny)]/20 border border-[var(--sunny)] rounded-[var(--r-md)] text-[var(--fg)] text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                <span>
                  <strong>Aviso de Permissão:</strong> Eventos reais só serão criados mediante sua
                  confirmação explícita abaixo. Nenhum evento é gravado silenciosamente.
                </span>
              </div>

              {syncStatus.successMessage && (
                <div className="p-3 bg-[var(--mint)] border border-[var(--ok)]/30 rounded-[var(--r-md)] text-[var(--ok)] text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--ok)]" />
                  <span>{syncStatus.successMessage}</span>
                </div>
              )}

              {syncStatus.errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-[var(--r-md)] text-rose-600 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{syncStatus.errorMessage}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-[var(--border)] font-mono">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-[oklch(0.96_0.01_84)] hover:bg-[oklch(0.92_0.01_84)] text-[var(--fg)] rounded-full text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={syncStatus.inProgress}
                onClick={handleConfirmGoogleCalendarSync}
                className="px-4 py-2 bg-[var(--fg)] hover:bg-[var(--fg)]/90 disabled:opacity-50 text-[var(--bg)] rounded-full text-xs font-bold transition flex items-center space-x-1.5 shadow-xs cursor-pointer font-sans"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {syncStatus.inProgress ? 'Agendando...' : 'Confirmar e Criar Eventos'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
