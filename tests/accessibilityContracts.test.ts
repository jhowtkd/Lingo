import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('audited modal accessibility', () => {
  it.each([
    'src/components/AuthModal.tsx',
    'src/components/OnboardingWizardModal.tsx',
    'src/App.tsx',
  ])('%s declares dialog semantics', (path) => {
    const source = read(path);
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('aria-labelledby=');
  });

  it('cycles Tab, closes on Escape, and restores focus', async () => {
    const first = { focus: vi.fn() } as unknown as HTMLElement;
    const last = { focus: vi.fn() } as unknown as HTMLElement;
    const previouslyFocused = { focus: vi.fn() } as unknown as HTMLElement;
    const container = {
      focus: vi.fn(),
      querySelectorAll: vi.fn(() => [first, last]),
    } as unknown as HTMLElement;
    const listeners = new Map<string, EventListener>();
    let activeElement: Element | null = previouslyFocused;
    const cleanups: Array<() => void> = [];
    let refCalls = 0;
    const onClose = vi.fn();

    vi.resetModules();
    vi.stubGlobal('document', {
      get activeElement() {
        return activeElement;
      },
      addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    });
    vi.doMock('react', () => ({
      useRef: (initialValue: unknown) => {
        refCalls += 1;
        return { current: refCalls === 1 ? container : initialValue };
      },
      useEffect: (effect: () => void | (() => void)) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      },
    }));

    try {
      const { useModalFocusTrap } = await import('../src/hooks/useModalFocusTrap');
      useModalFocusTrap(true, onClose);
      const keydown = listeners.get('keydown');
      expect(keydown).toBeDefined();
      expect(first.focus).toHaveBeenCalledTimes(1);

      activeElement = last;
      const forwardTab = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent;
      keydown!(forwardTab);
      expect(forwardTab.preventDefault).toHaveBeenCalledTimes(1);
      expect(first.focus).toHaveBeenCalledTimes(2);

      activeElement = first;
      const backwardTab = { key: 'Tab', shiftKey: true, preventDefault: vi.fn() } as unknown as KeyboardEvent;
      keydown!(backwardTab);
      expect(backwardTab.preventDefault).toHaveBeenCalledTimes(1);
      expect(last.focus).toHaveBeenCalledTimes(1);

      const escape = { key: 'Escape', preventDefault: vi.fn() } as unknown as KeyboardEvent;
      keydown!(escape);
      expect(escape.preventDefault).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);

      cleanups[0]();
      expect(previouslyFocused.focus).toHaveBeenCalledTimes(1);
      expect(listeners.has('keydown')).toBe(false);
    } finally {
      vi.doUnmock('react');
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});

describe('keyboard navigation controls', () => {
  it('uses native study-space buttons and current-page navigation state', () => {
    expect(read('src/components/HomeOverview.tsx')).toContain('<button');
    expect(read('src/components/Navbar.tsx')).toContain('aria-current=');
    expect(read('src/components/Navbar.tsx')).toContain('aria-expanded=');
  });
});

describe('residual accessibility: skip-link and reduced motion', () => {
  it('App oferece skip-link e alvo de conteúdo principal', () => {
    const appSource = read('src/App.tsx');
    expect(appSource).toContain('SkipLink');
    expect(appSource).toContain('id="conteudo-principal"');
  });

  it('SkipLink é o primeiro elemento focável e aponta para o conteúdo principal', () => {
    const skipLinkSource = read('src/components/SkipLink.tsx');
    expect(skipLinkSource).toContain('href="#conteudo-principal"');
    expect(skipLinkSource).toContain('Pular para o conteúdo principal');
    expect(skipLinkSource).toContain('sr-only');
    expect(skipLinkSource).toContain('focus:not-sr-only');
  });

  it('CSS respeita prefers-reduced-motion', () => {
    const cssSource = read('src/index.css');
    expect(cssSource).toContain('prefers-reduced-motion');
    expect(cssSource).toContain('animation-iteration-count: 1 !important');
    expect(cssSource).toContain('scroll-behavior: auto !important');
  });
});
