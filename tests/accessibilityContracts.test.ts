import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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

  it('ships a focus trap with Escape and focus restoration', () => {
    const hook = read('src/hooks/useModalFocusTrap.ts');
    expect(hook).toContain("event.key === 'Escape'");
    expect(hook).toContain("event.key !== 'Tab'");
    expect(hook).toContain('previouslyFocused?.focus()');
  });
});

describe('keyboard navigation controls', () => {
  it('uses native study-space buttons and current-page navigation state', () => {
    expect(read('src/components/HomeOverview.tsx')).toContain('<button');
    expect(read('src/components/Navbar.tsx')).toContain('aria-current=');
    expect(read('src/components/Navbar.tsx')).toContain('aria-expanded=');
  });
});
