import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('chat presentation contract', () => {
  it('uses local scrolling and identifiable mobile regions', () => {
    const chat = read('src/components/ChatTutor.tsx');

    expect(chat).toContain('messagesScrollRef');
    expect(chat).toContain('data-testid="chat-message-panel"');
    expect(chat).toContain('data-testid="chat-composer"');
    expect(chat).not.toContain('scrollIntoView');
  });

  it('starts guidance collapsed and hides message actions behind disclosure', () => {
    const chat = read('src/components/ChatTutor.tsx');
    const replies = read('src/components/QuickRepliesContainer.tsx');

    expect(replies).toContain('useState(true)');
    expect(chat).toContain('Mais ações');
    expect(chat).toContain('expandedMessageActionsId');
  });
});
