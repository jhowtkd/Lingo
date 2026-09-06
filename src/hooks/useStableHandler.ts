import { useCallback, useRef } from 'react';

/**
 * Devolve uma versão de identidade estável do handler que SEMPRE executa a
 * closure mais recente (padrão "latest ref"). Permite memoizar componentes
 * filhos que recebem handlers como props sem risco de closure obsoleta e sem
 * invalidar o memo a cada render do pai.
 */
export function useStableHandler<T extends (...args: any[]) => any>(handler: T): T {
  const ref = useRef(handler);
  ref.current = handler;
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
}
