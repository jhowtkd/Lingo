import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * Fronteira de erro de último nível: um throw em qualquer view (ex.: dado
 * malformado vindo da IA num gráfico) não pode apagar o app inteiro.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Falha capturada na árvore de UI:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--fg)]"
        >
          <div className="max-w-md w-full space-y-4 text-center bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 shadow-lg">
            <div className="text-4xl">🛠️</div>
            <h1 className="text-lg font-bold">Algo saiu do trilho por aqui</h1>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              Ocorreu um erro inesperado nesta área, mas o resto dos seus dados de estudo
              está seguro. Recarregue a página para continuar.
            </p>
            {this.state.errorMessage && (
              <pre className="text-left text-[10px] font-mono bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 overflow-auto max-h-24 text-[var(--muted)]">
                {this.state.errorMessage}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full font-bold text-sm bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition cursor-pointer"
            >
              Recarregar o app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
