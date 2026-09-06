import type confetti from 'canvas-confetti';

type ConfettiOptions = Parameters<typeof confetti>[0];

let loaded: typeof confetti | null = null;

// Lazy singleton: the ~5KB library só entra em um chunk separado quando
// a primeira celebração acontece, fora do caminho crítico do app.
export function fireConfetti(options?: ConfettiOptions): void {
  if (typeof document === 'undefined') return;
  if (loaded) {
    loaded(options);
    return;
  }
  void import('canvas-confetti').then((mod) => {
    loaded = mod.default;
    loaded(options);
  });
}
