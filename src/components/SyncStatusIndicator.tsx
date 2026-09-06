import { useEffect, useState } from 'react';
import { CloudOff, CloudCheck, RefreshCw } from 'lucide-react';
import {
  getLastStorageHealthEvent,
  subscribeStorageHealth,
  type StorageHealthEvent,
} from '../services/storageCore';
import { StorageService } from '../services/storage';

type SyncState = { status: 'success' | 'error'; at: string; error?: string };

/**
 * Ponto de status da sincronização com o Firestore. Erros de sync deixam de
 * ser invisíveis (console.warn) e ganham uma ação de retry com um clique.
 */
export function SyncStatusIndicator() {
  const [state, setState] = useState<SyncState | null>(() => {
    const last = getLastStorageHealthEvent();
    return last?.kind === 'cloud-sync' ? { status: last.status, at: last.at, error: last.error } : null;
  });

  useEffect(() => {
    const unsubscribe = subscribeStorageHealth((event: StorageHealthEvent) => {
      if (event.kind === 'cloud-sync') {
        setState({ status: event.status, at: event.at, error: event.error });
      }
    });
    return unsubscribe;
  }, []);

  if (!state) return null;

  const horario = new Date(state.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500" role="status">
      {state.status === 'success' ? (
        <>
          <CloudCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
          <span>Sincronizado às {horario}</span>
        </>
      ) : (
        <>
          <CloudOff className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
          <span title={state.error}>Falha ao sincronizar</span>
          <button
            type="button"
            aria-label="Tentar sincronizar novamente"
            className="ml-1 rounded p-0.5 hover:bg-slate-100"
            onClick={() => StorageService.scheduleCloudSync()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
