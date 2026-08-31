import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

describe('Firestore profile authorization contract', () => {
  const rules = readRepoFile('firestore.rules');

  it('limits profile reads and owner updates', () => {
    expect(rules).toContain('allow read: if isOwner(userId) || isAdmin();');
    expect(rules).toContain('request.resource.data.diff(resource.data).affectedKeys().hasOnly');
    expect(rules).toContain(
      "isTrustedAdminEmail() && request.resource.data.role == 'admin'"
    );

    const allowlist =
      rules.match(/affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
    expect(allowlist).not.toContain("'role'");
    expect(allowlist).not.toContain("'uid'");
    expect(allowlist).not.toContain("'createdAt'");
  });
});

describe('Public admin surface contract', () => {
  it('contains no demo admin identity and enforces the render role', () => {
    const authModal = readRepoFile('src/components/AuthModal.tsx');
    const app = readRepoFile('src/App.tsx');

    expect(authModal).not.toContain('handleDemoAdminLogin');
    expect(authModal).not.toContain('Testar como Administrador');
    expect(authModal).not.toContain('jhonatan.marcela@gmail.com');
    expect(app).toContain("activeTab === 'admin' && currentUser?.role === 'admin'");
  });
});
