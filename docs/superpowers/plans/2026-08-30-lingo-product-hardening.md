# Lingo Product Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o fluxo principal do Lingo seguro, honesto, responsivo e acessível, sem dados simulados se passando por progresso real.

**Architecture:** Manter React, Vite, Express, Firebase e o armazenamento atual. Concentrar cálculos determinísticos em serviços puros já compatíveis com Vitest, usar o registro existente de idiomas como fonte única e reduzir componentes somente onde existe uma responsabilidade clara e testável. Cada entrega deve funcionar isoladamente; nenhuma tarefa depende de deploy remoto.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Vitest 4, Firebase 12, Express 4, Motion/Framer Motion.

**Spec:** `docs/superpowers/specs/2026-08-30-lingo-product-hardening.md`

## Global Constraints

- Never present seed, fallback, simulated, or inferred values as user history.
- Prefer deleting demo-only controls and fabricated defaults over adding configuration layers.
- Keep account creation optional for the learning flow.
- Preserve plan context through `OnboardingWizardModal` -> `App` -> `ChatTutor` -> `/api/chat`.
- Use `src/config/languages.ts` as the only source for BCP-47 and TTS locales.
- Do not add runtime or test dependencies.
- Do not redesign the visual identity or replace Tailwind, Motion, Firebase, Vitest, Vite, or Express.
- Do not deploy Firebase rules, publish the app, or mutate remote/user data during implementation.
- Run the narrowest relevant test first, then `npm run lint`, `npm test`, and `npm run build` at the final gate.
- Stage only files named in the current task; never use `git add -A`.

---

## ICE Prioritization

Scores use a 1-10 scale and `ICE = Impact x Confidence x Ease` (maximum 1,000). They rank product opportunity; execution still follows security gates and code dependencies.

| Task | Change cluster | Impact | Confidence | Ease | ICE | Priority rationale |
|---|---|---:|---:|---:|---:|---|
| 1 | Restore TypeScript gate | 8 | 10 | 9 | 720 | Fast prerequisite that makes every later change verifiable. |
| 8 | Active-language prompts and audio | 9 | 9 | 7 | 567 | Fixes a core learning promise with localized, bounded changes. |
| 10 | Reachable mobile navigation | 9 | 9 | 7 | 567 | Unlocks all primary destinations on the audited viewport. |
| 2 | Firestore role boundary | 10 | 9 | 6 | 540 | Highest risk reduction; must run before product polish regardless of rank. |
| 3 | Honest chat activity and mastery | 10 | 9 | 6 | 540 | Removes false rewards, minutes, and proficiency from the core loop. |
| 5 | Honest Home, Daily Tip, and reset | 8 | 9 | 7 | 504 | Corrects the first impression and makes clean-state QA reliable. |
| 11 | Keyboard and modal accessibility | 9 | 9 | 6 | 486 | Restores basic access without adding a dependency. |
| 7 | Coherent onboarding fallback | 10 | 9 | 5 | 450 | Repairs the first-run journey across six languages and seven days. |
| 6 | Real practice content only | 8 | 9 | 6 | 432 | Removes synthetic drills and false zero-to-positive mastery. |
| 4 | Evidence-backed dashboard | 9 | 9 | 5 | 405 | High trust impact with broader shared-data changes. |
| 9 | Mobile conversation layout | 10 | 8 | 5 | 400 | Critical core-loop improvement with higher layout regression risk. |
| 12 | Route-level lazy loading | 6 | 8 | 8 | 384 | Valuable but correctly deferred until behavior is stable. |

ICE bands: `>= 500` immediate, `400-499` next, `< 400` follow-up. Tasks 1-2 execute first because a broken verification gate or open authorization boundary overrides score order; Task 12 remains last because performance work should measure the settled view graph.

---

## File Structure and Responsibility Map

**New files**

- `src/services/progressMetrics.ts` — pure derivation of daily goals, milestones, and seven-day chart data from persisted records.
- `src/services/studyPlanFallback.ts` — deterministic, language-aware local onboarding plan.
- `src/services/languagePracticePrompts.ts` — target-language quick prompts and listen-only prompts.
- `src/hooks/useModalFocusTrap.ts` — shared focus containment and Escape behavior for the three audited modals.
- `tests/firestoreRulesContract.test.ts` — local regression contract for the role boundary and public admin surface.
- `tests/achievementIntegrity.test.ts` — clean-state and first-interaction achievement behavior.
- `tests/progressMetrics.test.ts` — zero-state and recorded-data dashboard derivation.
- `tests/emptyStateIntegrity.test.tsx` — Daily Tip and Duel zero-state regressions.
- `tests/studyPlanFallback.test.ts` — six-language fallback and seven-day schedule contract.
- `tests/languagePracticePrompts.test.ts` — target-language prompt and locale contract.
- `tests/chatPresentationContract.test.ts` — mobile chat scrolling and disclosure structure.
- `tests/accessibilityContracts.test.ts` — modal, keyboard, and mobile-navigation accessibility contracts.

**Existing files with focused changes**

- `firestore.rules` — prevent self-promotion and cross-user profile reads.
- `src/App.tsx` — enforce the admin render guard, add topic-dialog semantics, mobile bottom padding, and lazy view loading.
- `src/components/AuthModal.tsx` — remove demo admin and adopt accessible modal focus.
- `src/components/OnboardingWizardModal.tsx` — explicit interests, language-aware fallback, source disclosure, seven-day preview, accessible focus.
- `src/components/ChatTutor.tsx` — authenticated cloud write guard, honest progress events, language locale, local message scrolling, mobile layout, and progressive disclosure.
- `src/components/TopicProficiencyBar.tsx` — keep proficiency unscored until recorded evidence exists.
- `src/components/QuickRepliesContainer.tsx` — collapsed-by-default reply guide.
- `src/components/Navbar.tsx` — desktop containment and accessible mobile navigation.
- `src/components/WeeklyDashboard.tsx` — consume real progress derivations and remove simulation.
- `src/components/DailyTipCard.tsx` — render an honest no-graph state.
- `src/components/HomeOverview.tsx` — remove fabricated resume data and use native buttons.
- `src/components/FlashcardsView.tsx` — distinguish empty filter from empty knowledge base.
- `src/components/VocabularyDuelView.tsx` — advertise and run only available rounds.
- `src/components/GraphMemoryView.tsx` — remove concept simulation and fabricated recency highlights.
- `src/components/GraphTopologyCanvas.tsx` — remove the duplicate simulation entry point.
- `src/components/MisconceptionsDictionary.tsx` — lead with a direct action when empty.
- `src/components/ui/border-trail.tsx` — restore the `Transition` type contract.
- `src/services/achievementEngine.ts` — unlock the first achievement only from recorded activity.
- `src/services/flashcardsEngine.ts` — preserve explicit zero mastery in generated SRS cards.
- `src/services/graphEngine.ts` — remove empty-graph mastery, fabricated weekly metrics, and priority-topic fallbacks at their shared source.
- `src/services/storage.ts` — stop attaching inferred mastery to greetings and make the explicit reset clear multi-conversation state.
- `src/services/vocabDuelEngine.ts` — stop synthesizing fallback questions.
- `src/types.ts` — persist the selected onboarding learning style in generated plans.

---

### Task 1: Restore the TypeScript Quality Gate

**Files:**

- Modify: `src/components/ChatTutor.tsx:406-427`
- Modify: `src/components/ui/border-trail.tsx:23-27`
- Test: existing TypeScript gate via `npm run lint`

**Interfaces:**

- Consumes: `auth.currentUser: FirebaseUser | null`, `saveFrequentErrorToCloud(...): Promise<string>`, and Framer Motion `Transition`.
- Produces: no Firestore correction write for unauthenticated local sessions; a correctly typed `BASE_TRANSITION`.

- [ ] **Step 1: Reproduce the current failures**

Run:

```bash
npm run lint
```

Expected: FAIL for `stats.userId` in `ChatTutor.tsx` and the inferred string `ease` in `border-trail.tsx`.

- [ ] **Step 2: Guard the cloud-only correction write at the authentication boundary**

Replace the current `targetUid` block in `ChatTutor.tsx` with an authenticated-only write. The local `StorageService.addCorrection` call immediately above remains unchanged.

```tsx
const currentAuthUser = auth.currentUser;
if (currentAuthUser) {
  await saveFrequentErrorToCloud({
    id: pedagogicalCorrection.id,
    userId: currentAuthUser.uid,
    userEmail: currentAuthUser.email || undefined,
    userName: currentAuthUser.displayName || undefined,
    conceito: pedagogicalCorrection.conceito,
    erro: pedagogicalCorrection.erro,
    explicacao: pedagogicalCorrection.explicacao,
    resposta_corrigida: pedagogicalCorrection.resposta_corrigida,
    gravidade: pedagogicalCorrection.gravidade,
    evidencia: pedagogicalCorrection.evidencia,
    topico: currentTopic,
    categoria: 'gramatica',
    data: pedagogicalCorrection.data,
  });
}
```

Do not invent a guest UID for Firestore. A no-account user already retains the correction locally.

- [ ] **Step 3: Give the default border animation its declared library type**

Change only the declaration in `src/components/ui/border-trail.tsx`:

```tsx
const BASE_TRANSITION: Transition = {
  repeat: Infinity,
  duration: 5,
  ease: 'linear',
};
```

- [ ] **Step 4: Verify the gate and existing tests**

Run:

```bash
npm run lint
npm test
```

Expected: both commands PASS; the existing six tutor intelligence tests remain green.

- [ ] **Step 5: Commit the restored baseline**

```bash
git add src/components/ChatTutor.tsx src/components/ui/border-trail.tsx
git commit -m "fix: restore TypeScript quality gate"
```

---

### Task 2: Close the Firestore Role Boundary and Remove Public Admin Demo Access

**Files:**

- Create: `tests/firestoreRulesContract.test.ts`
- Modify: `firestore.rules:5-32`
- Modify: `src/components/AuthModal.tsx:1-145,383-396`
- Modify: `src/App.tsx:277-282`

**Interfaces:**

- Consumes: existing `UserProfile.role`, Firebase Authentication UID/email, and existing admin-managed role documents.
- Produces: owner-safe profile updates; `AdminView` rendering only for an authenticated profile whose role is `admin`; no public demo-admin action.

- [ ] **Step 1: Write the failing security surface contract**

Create `tests/firestoreRulesContract.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the contract and confirm it catches the current exposure**

Run:

```bash
npm test -- tests/firestoreRulesContract.test.ts
```

Expected: FAIL because the current owner update has no field allowlist, the modal exposes demo admin, and `App` checks only `currentUser`.

- [ ] **Step 3: Replace the profile rule block with immutable privileged fields**

Keep the existing collection rules below `/users`. Replace the helper/profile section of `firestore.rules` with:

```text
function isAuthenticated() {
  return request.auth != null;
}

function isOwner(userId) {
  return isAuthenticated() && request.auth.uid == userId;
}

function isTrustedAdminEmail() {
  return isAuthenticated() && request.auth.token.email in [
    'jhonatan.marcela@gmail.com',
    'admin@lingo.app',
    'adm@lingo.com'
  ];
}

function isAdmin() {
  return isAuthenticated() && (
    isTrustedAdminEmail() ||
    (
      exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
    )
  );
}

match /users/{userId} {
  allow read: if isOwner(userId) || isAdmin();
  allow create: if isOwner(userId) &&
    request.resource.data.uid == request.auth.uid &&
    (
      request.resource.data.role == 'user' ||
      (isTrustedAdminEmail() && request.resource.data.role == 'admin')
    );
  allow update: if isAdmin() || (
    isOwner(userId) &&
    request.resource.data.uid == resource.data.uid &&
    request.resource.data.role == resource.data.role &&
    request.resource.data.createdAt == resource.data.createdAt &&
    request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'email',
      'displayName',
      'photoURL',
      'lastLoginAt',
      'isAnonymous',
      'statsSummary'
    ])
  );
  allow delete: if isAdmin();

  match /{subcollection}/{docId} {
    allow read, write: if isOwner(userId) || isAdmin();
  }
}
```

This keeps current admin promotion semantics while preventing self-promotion.

- [ ] **Step 4: Delete the demo-admin branch from the authentication modal**

In `AuthModal.tsx`:

- Remove `KeyRound` from the Lucide imports.
- Delete `handleDemoAdminLogin` completely.
- Delete the entire “Atalho Rápido para Administrador de Demonstração” block.
- Leave Google, email, registration, guest, and no-account flows unchanged.

- [ ] **Step 5: Enforce the role at the component render boundary**

Change the admin branch in `App.tsx` to:

```tsx
{activeTab === 'admin' && currentUser?.role === 'admin' && (
  <AdminView
    currentUser={currentUser}
    onImportPackToCurrentBase={() => setStats(StorageService.getStats())}
  />
)}
```

- [ ] **Step 6: Run the local security and TypeScript checks**

Run:

```bash
npm test -- tests/firestoreRulesContract.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Verify candidate rules without deploying them**

In Firebase Rules Playground, use an unpublished candidate rules session and check these exact cases:

1. Auth UID `student-1` reads `/users/student-1` -> allow.
2. Auth UID `student-1` reads `/users/student-2` -> deny.
3. Auth UID `student-1` changes only `displayName` on `/users/student-1` -> allow.
4. Auth UID `student-1` changes `role` from `user` to `admin` -> deny.
5. An existing admin changes `/users/student-1.role` -> allow.

Expected: results match the arrows above. Stop before publish/deploy and record the simulator evidence for human review.

- [ ] **Step 8: Commit the security boundary**

```bash
git add firestore.rules src/App.tsx src/components/AuthModal.tsx tests/firestoreRulesContract.test.ts
git commit -m "fix: secure admin role boundary"
```

---

### Task 3: Make Chat Progress and Mastery Evidence-Driven

**Files:**

- Create: `tests/achievementIntegrity.test.ts`
- Modify: `src/services/achievementEngine.ts:10-22,157-161`
- Modify: `src/services/graphEngine.ts:21-89`
- Modify: `src/services/storage.ts:1220-1237,1382-1390,1497-1514`
- Modify: `src/components/ChatTutor.tsx:201-214,340-465`
- Modify: `src/components/TopicProficiencyBar.tsx:22-60,105-165`

**Interfaces:**

- Consumes: `UserStats.total_respostas` after a successful tutor response and stored graph nodes as the only mastery evidence.
- Produces: `AchievementEngine.evaluateAll()` that leaves a clean profile untouched and unlocks `primeira_conversa` once after real activity; `GraphEngine.analyzeStudentComprehension(...): ExplanationAdaptation | null`.

- [ ] **Step 1: Write clean-state and first-interaction regression tests**

Create `tests/achievementIntegrity.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AchievementEngine } from '../src/services/achievementEngine';
import { GraphEngine } from '../src/services/graphEngine';
import { StorageService } from '../src/services/storage';
import { UserStats } from '../src/types';

const cleanStats = (overrides: Partial<UserStats> = {}): UserStats => ({
  xp: 0,
  nivel: 1,
  sequencia_dias: 0,
  ultimo_dia_estudo: '2026-08-30',
  meta_diaria_minutos: 30,
  minutos_hoje: 0,
  conquistas_desbloqueadas: [],
  total_respostas: 0,
  respostas_corretas: 0,
  erros_corrigidos: 0,
  idioma_ativo: 'Francês',
  nivel_cefr: 'A1',
  materiais_gerados: 0,
  ...overrides,
});

const mockStorage = (stats: UserStats) => {
  vi.spyOn(StorageService, 'getAchievements').mockReturnValue([]);
  vi.spyOn(StorageService, 'getNodes').mockReturnValue([]);
  vi.spyOn(StorageService, 'getRelations').mockReturnValue([]);
  vi.spyOn(StorageService, 'getCorrections').mockReturnValue([]);
  vi.spyOn(StorageService, 'getMaterials').mockReturnValue([]);
  vi.spyOn(StorageService, 'getStats').mockReturnValue(stats);
  vi.spyOn(StorageService, 'saveAchievements').mockImplementation(() => undefined);
  vi.spyOn(StorageService, 'addXP').mockReturnValue({
    stats,
    subiu_nivel: false,
    novo_nivel: 1,
  });
};

afterEach(() => vi.restoreAllMocks());

describe('AchievementEngine integrity', () => {
  it('does not unlock or award XP for a clean profile', () => {
    mockStorage(cleanStats());

    const result = AchievementEngine.evaluateAll();

    expect(result.newlyUnlocked).toEqual([]);
    expect(result.achievements.find((item) => item.id === 'primeira_conversa')).toMatchObject({
      desbloqueada: false,
      progresso_atual: 0,
    });
    expect(StorageService.addXP).not.toHaveBeenCalled();
  });

  it('unlocks the first conversation after one recorded response', () => {
    mockStorage(cleanStats({ total_respostas: 1, respostas_corretas: 1 }));

    const result = AchievementEngine.evaluateAll();

    expect(result.newlyUnlocked.map((item) => item.id)).toContain('primeira_conversa');
    expect(StorageService.addXP).toHaveBeenCalledTimes(1);
  });

  it('does not infer mastery when the graph has no evidence', () => {
    vi.spyOn(StorageService, 'getNodes').mockReturnValue([]);

    expect(
      GraphEngine.analyzeStudentComprehension('Viagens', 'Bonjour', 'Francês')
    ).toBeNull();
  });

  it('keeps topic proficiency unscored before recorded evidence', () => {
    const source = readFileSync(
      new URL('../src/components/TopicProficiencyBar.tsx', import.meta.url),
      'utf8'
    );

    expect(source).toContain('hasProficiencyEvidence');
    expect(source).toContain('Aguardando evidências');
  });
});
```

- [ ] **Step 2: Run the test and verify the mount-driven bug is represented**

Run:

```bash
npm test -- tests/achievementIntegrity.test.ts
```

Expected: FAIL because `primeira_conversa` starts unlocked, its switch branch always forces progress to one, and an empty graph returns an invented 65% mastery adaptation.

- [ ] **Step 3: Make the achievement template start locked**

Change only the first template in `ALL_SYSTEM_ACHIEVEMENTS`:

```ts
{
  id: 'primeira_conversa',
  titulo: 'Primeiro Passo',
  descricao: 'Concluiu a primeira troca ativa com o tutor.',
  icone: 'Sparkles',
  xp_recompensa: 50,
  desbloqueada: false,
  progresso_atual: 0,
  progresso_meta: 1,
  categoria: 'consistencia',
},
```

- [ ] **Step 4: Derive first-conversation progress from recorded answers**

Replace the `primeira_conversa` switch branch with:

```ts
case 'primeira_conversa':
  currentProgress = Math.min(stats.total_respostas, 1);
  targetProgress = 1;
  if (stats.total_respostas >= 1) isUnlockedNow = true;
  break;
```

- [ ] **Step 5: Stop presenting inferred CEFR or empty-graph mastery as measured evidence**

In `GraphEngine.analyzeStudentComprehension`:

1. Change the return type to `ExplanationAdaptation | null`.
2. Immediately after deriving `activeNodes`, return `null` when it is empty.
3. Because the empty case has returned, calculate mastery without a fallback:

```ts
if (activeNodes.length === 0) return null;

const totalDominio = activeNodes.reduce(
  (sum, node) => sum + Math.max(0, node.dominio_estimado ?? 0),
  0
);
const avgDominio = Math.round(totalDominio / activeNodes.length);
```

In `ChatTutor.tsx`, derive `activePlan` and `currentLanguage` before the request. After processing `data.novos_nos_grafo`, calculate and persist only the graph-backed adaptation:

```tsx
const effectiveAdaptation = GraphEngine.analyzeStudentComprehension(
  currentTopic,
  content,
  currentLanguage
);
if (effectiveAdaptation) {
  GraphEngine.recordAdaptationUsed(
    currentTopic,
    effectiveAdaptation,
    currentLanguage
  );
}
```

Set the tutor message field to `adaptacao: effectiveAdaptation ?? undefined`. Do not coerce the server’s optional text `data.adaptacao` into the structured `ExplanationAdaptation` object. Remove the now-unused `ExplanationAdaptation` import.

In `StorageService.getConversations`, `createConversation`, and `resetChatToStudyPlan`, delete the `adaptacao` property from initial welcome messages. Keep CEFR as plan/session context, but do not convert it into a mastery percentage.

In `TopicProficiencyBar.tsx`, import `getLanguageConfig`, filter graph inputs to the active language, and replace the default 50% graph mastery, 75% accuracy, and 15% floor with recorded values only:

```tsx
const activeLanguage = getLanguageConfig(stats.idioma_ativo || currentTopic);
const languageNodes = allNodes.filter((node) =>
  getLanguageConfig(node.idioma || 'ingles').id === activeLanguage.id
);
const topicNodes = languageNodes.filter((node) => {
  const normTitle = GraphEngine.normalize(node.titulo);
  const normDesc = GraphEngine.normalize(node.descricao);
  return (
    normTitle.includes(normTopic) ||
    normTopic.includes(normTitle) ||
    normDesc.includes(normTopic)
  );
});
const relevantNodes = topicNodes.length > 0 ? topicNodes : languageNodes.slice(0, 10);
const hasProficiencyEvidence =
  stats.total_respostas > 0 ||
  relevantNodes.some(
    (node) => node.dominio_estimado > 0 || node.frequencia_erro > 0
  );
const avgNodeMastery = relevantNodes.length > 0
  ? relevantNodes.reduce(
      (sum, node) => sum + Math.max(0, node.dominio_estimado ?? 0),
      0
    ) / relevantNodes.length
  : 0;
const interactionScore = Math.min(100, Math.round((messagesCount / 12) * 100));
const accuracyRate = stats.total_respostas > 0
  ? Math.round((stats.respostas_corretas / stats.total_respostas) * 100)
  : 0;
const calculatedProficiency = hasProficiencyEvidence
  ? Math.min(
      100,
      Math.round(avgNodeMastery * 0.5 + interactionScore * 0.3 + accuracyRate * 0.2)
    )
  : 0;
```

Before deriving `stage`, return a neutral compact bar when `hasProficiencyEvidence` is false:

```tsx
if (!hasProficiencyEvidence) {
  return (
    <div className="shrink-0 mb-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between gap-2">
      <span className="text-xs font-bold text-[var(--fg)]">
        Proficiência no tópico
      </span>
      <span className="text-[10px] font-bold text-[var(--muted)]">
        Aguardando evidências da primeira prática
      </span>
    </div>
  );
}
```

- [ ] **Step 6: Remove mount-time achievement mutation and invented minutes**

In `ChatTutor.tsx`:

- Delete the `AchievementEngine.evaluateAll()` block from the mount effect.
- Delete `StorageService.recordMinutesStudied(3)` from successful text-message handling.
- Keep `recordAnswer`, XP from the server response, and the post-response achievement evaluation.
- Keep measured-duration recording in voice-specific components unchanged.

- [ ] **Step 7: Verify behavior and types**

Run:

```bash
npm test -- tests/achievementIntegrity.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit honest achievement behavior**

```bash
git add src/services/achievementEngine.ts src/services/graphEngine.ts src/services/storage.ts src/components/ChatTutor.tsx src/components/TopicProficiencyBar.tsx tests/achievementIntegrity.test.ts
git commit -m "fix: award progress only after study activity"
```

---

### Task 4: Derive Dashboard Goals, Milestones, and Trends from Persisted Data

**Files:**

- Create: `src/services/progressMetrics.ts`
- Create: `tests/progressMetrics.test.ts`
- Modify: `src/services/graphEngine.ts:274-383,386-612`
- Modify: `src/components/WeeklyDashboard.tsx:31-228,230-258,392-403`

**Interfaces:**

- Consumes: `ProgressMetricsInput` containing `UserStats`, `GraphNode[]`, `PedagogicalCorrection[]`, `StudySession[]`, and an injectable `Date`.
- Produces: `buildDailyGoals(input): DailyGoal[]`, `buildMilestones(input): MilestoneItem[]`, and `buildWeeklyTrend(input): DailyTrendPoint[]`.
- Preserves: `GraphEngine.calculateWeeklyMetrics(): WeeklyMetrics` and `GraphEngine.getPriorityTopicsFromMemoryGraph(limit): PriorityTopicSuggestion[]`, but both return only evidence-backed values.

- [ ] **Step 1: Write tests for a clean profile and recorded activity**

Create `tests/progressMetrics.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDailyGoals,
  buildMilestones,
  buildWeeklyTrend,
  ProgressMetricsInput,
} from '../src/services/progressMetrics';
import { GraphEngine } from '../src/services/graphEngine';
import { StorageService } from '../src/services/storage';

const cleanInput = (): ProgressMetricsInput => ({
  now: new Date('2026-08-30T12:00:00.000Z'),
  stats: {
    xp: 0,
    nivel: 1,
    sequencia_dias: 0,
    ultimo_dia_estudo: '2026-08-30',
    meta_diaria_minutos: 30,
    minutos_hoje: 0,
    conquistas_desbloqueadas: [],
    total_respostas: 0,
    respostas_corretas: 0,
    erros_corrigidos: 0,
    idioma_ativo: 'Inglês',
    nivel_cefr: 'A1',
    materiais_gerados: 0,
  },
  nodes: [],
  corrections: [],
  sessions: [],
});

describe('progress metrics', () => {
  it('returns only zero progress for a clean profile', () => {
    const input = cleanInput();

    expect(buildDailyGoals(input).every((goal) => goal.progresso_atual === 0)).toBe(true);
    expect(buildMilestones(input).every((item) => item.progresso_atual === 0)).toBe(true);
    expect(buildWeeklyTrend(input)).toHaveLength(7);
    expect(buildWeeklyTrend(input).every((point) =>
      point.minutos === 0 && point.vocabulario === 0 && point.taxaConsistencia === 0
    )).toBe(true);
  });

  it('uses only recorded sessions, nodes, corrections, and answers', () => {
    const input = cleanInput();
    input.stats = {
      ...input.stats,
      minutos_hoje: 20,
      total_respostas: 5,
      respostas_corretas: 4,
      sequencia_dias: 2,
    };
    input.sessions = [{
      id: 'session-1',
      titulo: 'Conversa real',
      topico: 'Viagens',
      inicio: '2026-08-30T10:00:00.000Z',
      fim: '2026-08-30T10:20:00.000Z',
      duracao_minutos: 20,
      respostas_totais: 5,
      respostas_corretas: 4,
      conceitos_trabalhados: ['bonjour'],
      erros_identificados: 1,
      xp_obtido: 80,
      concluida: true,
    }];
    input.nodes = [{
      id: 'node-1',
      tipo: 'vocabulario',
      titulo: 'bonjour',
      descricao: 'saudação',
      dominio_estimado: 85,
      dificuldade: 1,
      frequencia_erro: 0,
      ultima_revisao: '2026-08-30T10:00:00.000Z',
      proxima_revisao: '2026-09-02T10:00:00.000Z',
      evidencias: ['usado em conversa'],
      criado_em: '2026-08-30T10:00:00.000Z',
      atualizado_em: '2026-08-30T10:00:00.000Z',
      idioma: 'Francês',
    }];

    expect(buildDailyGoals(input).map((goal) => goal.progresso_atual)).toEqual([20, 80, 5]);
    expect(buildMilestones(input).map((item) => item.progresso_atual)).toEqual([2, 1, 0]);
    expect(buildWeeklyTrend(input).at(-1)).toMatchObject({
      minutos: 20,
      vocabulario: 1,
      taxaConsistencia: 67,
    });
  });
});

afterEach(() => vi.restoreAllMocks());

describe('GraphEngine dashboard integrity', () => {
  it('returns zero metrics and no priorities for clean storage', () => {
    vi.spyOn(StorageService, 'getNodes').mockReturnValue([]);
    vi.spyOn(StorageService, 'getRelations').mockReturnValue([]);
    vi.spyOn(StorageService, 'getSessions').mockReturnValue([]);
    vi.spyOn(StorageService, 'getCorrections').mockReturnValue([]);
    vi.spyOn(StorageService, 'getStats').mockReturnValue(cleanInput().stats);

    const metrics = GraphEngine.calculateWeeklyMetrics();

    expect(metrics).toMatchObject({
      sessoes_realizadas: 0,
      minutos_estudados: 0,
      total_respostas: 0,
      respostas_corretas: 0,
      taxa_acerto: 0,
      revisoes_pendentes: 0,
      topicos_dificeis: [],
      evolucao_dominio: [],
    });
    expect(metrics.comparativo_semana_anterior).toEqual({
      minutos_delta_pct: 0,
      taxa_acerto_delta_pct: 0,
      xp_delta_pct: 0,
    });
    expect(GraphEngine.getPriorityTopicsFromMemoryGraph(3)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and verify the service is absent**

Run:

```bash
npm test -- tests/progressMetrics.test.ts
```

Expected: FAIL because `src/services/progressMetrics.ts` does not exist; after the service is added, the `GraphEngine` assertion still fails on its fabricated non-zero defaults until Step 4.

- [ ] **Step 3: Implement the pure metrics service**

Create `src/services/progressMetrics.ts`:

```ts
import {
  DailyGoal,
  GraphNode,
  MilestoneItem,
  PedagogicalCorrection,
  StudySession,
  UserStats,
} from '../types';

export interface DailyTrendPoint {
  dia: string;
  data: string;
  minutos: number;
  vocabulario: number;
  taxaConsistencia: number;
}

export interface ProgressMetricsInput {
  stats: UserStats;
  nodes: GraphNode[];
  corrections: PedagogicalCorrection[];
  sessions: StudySession[];
  now?: Date;
}

export function buildDailyGoals({ stats }: ProgressMetricsInput): DailyGoal[] {
  const accuracy = stats.total_respostas > 0
    ? Math.round((stats.respostas_corretas / stats.total_respostas) * 100)
    : 0;

  return [
    {
      id: 'goal-time',
      titulo: 'Estudo diário',
      descricao: 'Tempo medido em atividades concluídas',
      categoria: 'tempo',
      progresso_atual: stats.minutos_hoje,
      meta_total: stats.meta_diaria_minutos,
      unidade: 'min',
      concluida: stats.minutos_hoje >= stats.meta_diaria_minutos,
      xp_recompensa: 50,
      icone: 'clock',
    },
    {
      id: 'goal-accuracy',
      titulo: 'Acurácia de conversação',
      descricao: 'Percentual calculado apenas sobre respostas registradas',
      categoria: 'precisao',
      progresso_atual: accuracy,
      meta_total: 80,
      unidade: '%',
      concluida: stats.total_respostas > 0 && accuracy >= 80,
      xp_recompensa: 75,
      icone: 'target',
    },
    {
      id: 'goal-conversation',
      titulo: 'Prática ativa',
      descricao: 'Trocas registradas com o tutor',
      categoria: 'conversacao',
      progresso_atual: stats.total_respostas,
      meta_total: 5,
      unidade: 'respostas',
      concluida: stats.total_respostas >= 5,
      xp_recompensa: 40,
      icone: 'message',
    },
  ];
}

export function buildMilestones({ stats, nodes, corrections }: ProgressMetricsInput): MilestoneItem[] {
  const masteredNodes = nodes.filter((node) => node.dominio_estimado >= 80).length;
  const consolidatedCorrections = corrections.filter(
    (correction) =>
      correction.estado_posterior === 'compreendido' &&
      correction.respondido_corretamente === true
  ).length;

  return [
    {
      id: 'milestone-streak',
      titulo: 'Guardião da Constância',
      descricao: 'Mantenha cinco dias consecutivos de prática ativa',
      nivel: 'Ouro',
      progresso_atual: stats.sequencia_dias,
      meta_total: 5,
      unidade: 'dias',
      concluida: stats.sequencia_dias >= 5,
      xp_recompensa: 200,
      categoria: 'streak',
    },
    {
      id: 'milestone-mastery',
      titulo: 'Mestre da Topologia SRS',
      descricao: 'Alcance 80% de domínio em seis nós do grafo',
      nivel: 'Prata',
      progresso_atual: masteredNodes,
      meta_total: 6,
      unidade: 'nós',
      concluida: masteredNodes >= 6,
      xp_recompensa: 150,
      categoria: 'mastery',
    },
    {
      id: 'milestone-corrections',
      titulo: 'Superador de Equívocos',
      descricao: 'Consolide três correções pedagógicas',
      nivel: 'Bronze',
      progresso_atual: consolidatedCorrections,
      meta_total: 3,
      unidade: 'erros',
      concluida: consolidatedCorrections >= 3,
      xp_recompensa: 100,
      categoria: 'accuracy',
    },
  ];
}

export function buildWeeklyTrend(input: ProgressMetricsInput): DailyTrendPoint[] {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const targetMinutes = Math.max(1, input.stats.meta_diaria_minutos);
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return Array.from({ length: 7 }, (_, index) => {
    const daysAgo = 6 - index;
    const targetDate = new Date(now);
    targetDate.setUTCDate(now.getUTCDate() - daysAgo);
    const date = targetDate.toISOString().slice(0, 10);
    const sessionMinutes = input.sessions
      .filter((session) => session.concluida && session.inicio.startsWith(date))
      .reduce((sum, session) => sum + Math.max(0, session.duracao_minutos), 0);
    const minutes = date === today
      ? Math.max(sessionMinutes, Math.max(0, input.stats.minutos_hoje))
      : sessionMinutes;
    const vocabulary = input.nodes.filter(
      (node) =>
        ['vocabulario', 'expressao_idiomatica', 'falso_amigo'].includes(node.tipo) &&
        node.criado_em.slice(0, 10) <= date
    ).length;

    return {
      dia: dayNames[targetDate.getUTCDay()],
      data: date,
      minutos: minutes,
      vocabulario: vocabulary,
      taxaConsistencia: Math.min(100, Math.round((minutes / targetMinutes) * 100)),
    };
  });
}
```

- [ ] **Step 4: Remove fabricated defaults from the shared graph engine**

Replace `GraphEngine.calculateWeeklyMetrics` with an evidence-only derivation:

```ts
calculateWeeklyMetrics(): WeeklyMetrics {
  const nodes = StorageService.getNodes();
  const sessions = StorageService.getSessions().filter((session) => session.concluida);
  const corrections = StorageService.getCorrections();
  const stats = StorageService.getStats();

  const now = new Date();
  const metaDiariaMinutos = Math.max(1, stats.meta_diaria_minutos);
  const seteDiasAtras = new Date(now.getTime() - 7 * 86400000);
  const quatorzeDiasAtras = new Date(now.getTime() - 14 * 86400000);
  const hoje = now.toISOString().slice(0, 10);

  const sessoesUltimos7Dias = sessions.filter(
    (session) => new Date(session.inicio) >= seteDiasAtras
  );
  const sessoesSemanaAnterior = sessions.filter((session) => {
    const inicio = new Date(session.inicio);
    return inicio >= quatorzeDiasAtras && inicio < seteDiasAtras;
  });

  const minutosHojeEmSessoes = sessoesUltimos7Dias
    .filter((session) => session.inicio.startsWith(hoje))
    .reduce((sum, session) => sum + Math.max(0, session.duracao_minutos), 0);
  const minutosOutrosDias = sessoesUltimos7Dias
    .filter((session) => !session.inicio.startsWith(hoje))
    .reduce((sum, session) => sum + Math.max(0, session.duracao_minutos), 0);
  const minutosEstudados =
    minutosOutrosDias + Math.max(minutosHojeEmSessoes, Math.max(0, stats.minutos_hoje));
  const minutosSemanaAnterior = sessoesSemanaAnterior.reduce(
    (sum, session) => sum + Math.max(0, session.duracao_minutos),
    0
  );

  const totalRespostas = sessoesUltimos7Dias.reduce(
    (sum, session) => sum + Math.max(0, session.respostas_totais),
    0
  );
  const respostasCorretas = sessoesUltimos7Dias.reduce(
    (sum, session) => sum + Math.max(0, session.respostas_corretas),
    0
  );
  const taxaAcerto = totalRespostas > 0
    ? Math.round((respostasCorretas / totalRespostas) * 100)
    : 0;

  const totalRespostasAnterior = sessoesSemanaAnterior.reduce(
    (sum, session) => sum + Math.max(0, session.respostas_totais),
    0
  );
  const respostasCorretasAnterior = sessoesSemanaAnterior.reduce(
    (sum, session) => sum + Math.max(0, session.respostas_corretas),
    0
  );
  const taxaAcertoAnterior = totalRespostasAnterior > 0
    ? Math.round((respostasCorretasAnterior / totalRespostasAnterior) * 100)
    : 0;
  const xpGanho = sessoesUltimos7Dias.reduce(
    (sum, session) => sum + Math.max(0, session.xp_obtido),
    0
  );
  const xpSemanaAnterior = sessoesSemanaAnterior.reduce(
    (sum, session) => sum + Math.max(0, session.xp_obtido),
    0
  );

  const correcoesSemana = corrections.filter(
    (correction) => new Date(correction.data) >= seteDiasAtras
  );
  const errosCorrigidos = correcoesSemana.filter(
    (correction) => correction.estado_posterior === 'compreendido'
  ).length;
  const errosRecorrentes = correcoesSemana.filter(
    (correction) =>
      correction.estado_posterior === 'precisa_revisar' ||
      correction.gravidade === 'critica'
  ).length;
  const revisoesPendentes = nodes.filter(
    (node) => new Date(node.proxima_revisao) <= now
  ).length;
  const topicosDificeis = nodes
    .filter(
      (node) =>
        node.tipo === 'dificuldade' ||
        node.tipo === 'equivoco' ||
        node.frequencia_erro > 0
    )
    .sort((a, b) => b.frequencia_erro - a.frequencia_erro)
    .slice(0, 4)
    .map((node) => ({
      topico: node.titulo,
      erros: node.frequencia_erro,
      dominio_medio: node.dominio_estimado,
    }));

  const minutosPorDia = new Map<string, number>();
  sessoesUltimos7Dias.forEach((session) => {
    const dia = session.inicio.slice(0, 10);
    minutosPorDia.set(
      dia,
      (minutosPorDia.get(dia) ?? 0) + Math.max(0, session.duracao_minutos)
    );
  });
  minutosPorDia.set(
    hoje,
    Math.max(minutosPorDia.get(hoje) ?? 0, Math.max(0, stats.minutos_hoje))
  );
  const metasDiasConcluidas = [...minutosPorDia.values()].filter(
    (minutes) => minutes >= metaDiariaMinutos
  ).length;
  const percentageDelta = (current: number, previous: number) =>
    previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;

  return {
    periodo: {
      inicio: seteDiasAtras.toISOString().slice(0, 10),
      fim: now.toISOString().slice(0, 10),
    },
    sessoes_realizadas: sessoesUltimos7Dias.length,
    minutos_estudados: minutosEstudados,
    total_respostas: totalRespostas,
    respostas_corretas: respostasCorretas,
    taxa_acerto: taxaAcerto,
    erros_corrigidos: errosCorrigidos,
    erros_recorrentes: errosRecorrentes,
    xp_ganho: xpGanho,
    sequencia_atual: stats.sequencia_dias,
    metas_dias_concluidas: metasDiasConcluidas,
    topicos_dificeis: topicosDificeis,
    evolucao_dominio: [],
    revisoes_pendentes: revisoesPendentes,
    comparativo_semana_anterior: {
      minutos_delta_pct: percentageDelta(minutosEstudados, minutosSemanaAnterior),
      taxa_acerto_delta_pct: percentageDelta(taxaAcerto, taxaAcertoAnterior),
      xp_delta_pct: percentageDelta(xpGanho, xpSemanaAnterior),
    },
    recomendacao_objetiva: topicosDificeis.length > 0
      ? `Dedique a próxima sessão para revisar ${topicosDificeis[0].topico}, o ponto com mais equívocos registrados.`
      : sessoesUltimos7Dias.length === 0 && nodes.length === 0
        ? 'Conclua uma prática para que o painel identifique prioridades com base em evidências.'
        : 'Nenhuma prioridade específica foi identificada nas evidências registradas.',
  };
},
```

`evolucao_dominio` remains empty because the current storage schema has no historical mastery snapshots. Do not infer a starting value from the current value.

In `getPriorityTopicsFromMemoryGraph`, replace the empty-graph branch with:

```ts
if (!nodes || nodes.length === 0) {
  return [];
}
```

Then delete the entire `defaults` fill block after `scoredNodes.sort(...)` and return only stored topics:

```ts
return scoredNodes.slice(0, limit).map((item) => item.suggestion);
```

- [ ] **Step 5: Replace local fabricated state in the dashboard**

In `WeeklyDashboard.tsx`:

1. Import the three builders and `DailyTrendPoint` from `../services/progressMetrics`.
2. Delete the local `DailyTrendPoint` interface.
3. Delete hard-coded `useState` initializers for `dailyGoals` and `milestones`.
4. Read persisted inputs once per metrics refresh:

```tsx
const stats = StorageService.getStats();
const nodes = StorageService.getNodes();
const corrections = StorageService.getCorrections();
const sessions = StorageService.getSessions();
const progressInput = { stats, nodes, corrections, sessions };
const dailyGoals = buildDailyGoals(progressInput);
const milestones = buildMilestones(progressInput);
```

5. Replace the current `weeklyGrowthData` calculation with:

```tsx
const weeklyGrowthData = useMemo(
  () => buildWeeklyTrend({
    stats: StorageService.getStats(),
    nodes: StorageService.getNodes(),
    corrections: StorageService.getCorrections(),
    sessions: StorageService.getSessions(),
  }),
  [metrics]
);
```

6. Delete `triggerMilestoneCelebration`, `handleToggleDailyGoal`, `handleCompleteMilestone`, the `Simular Meta` button, and the milestone `Concluir` button.
7. Replace the daily-goal checkbox button with a read-only status marker:

```tsx
<div
  aria-hidden="true"
  className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border ${
    isAchieved
      ? 'bg-[var(--ok)] text-white border-[var(--ok)] shadow-xs'
      : 'border-[var(--border)] text-transparent bg-white'
  }`}
>
  <Check className="w-3.5 h-3.5 stroke-[3]" />
</div>
<span className="sr-only">
  {isAchieved ? 'Meta concluída' : 'Meta em andamento'}
</span>
```

For an unfinished milestone, render a non-interactive `<span>Em andamento</span>` using the current badge styles.

8. Remove imports that become unused (`confetti`, `DailyGoal`, `MilestoneItem`, simulation-only icons, and state setters).
9. Remove the final chart fallback `|| 8`; render `weeklyGrowthData.at(-1)?.vocabulario ?? 0`.
10. Make card captions conditional instead of claiming progress on zero state:

```tsx
const minutesDelta = metrics.comparativo_semana_anterior.minutos_delta_pct;
const accuracyDelta = metrics.comparativo_semana_anterior.taxa_acerto_delta_pct;

// In metricCardsData:
badge: `${minutesDelta > 0 ? '+' : ''}${minutesDelta}% vs. semana anterior`,
badge: `${accuracyDelta > 0 ? '+' : ''}${accuracyDelta}% vs. semana anterior`,
subtext: metrics.sessoes_realizadas > 0 ? 'registradas no período' : 'nenhuma registrada',
subtext: metrics.sequencia_atual > 0 ? 'sequência atual' : 'comece hoje',
```

Apply the four lines to Tempo, Precisão, Sessões, and Hábito respectively; do not leave `ritmo constante` or `Meta batida` as unconditional copy.

- [ ] **Step 6: Give a clean dashboard an explicit beginning state**

Directly before the dashboard content sections, derive:

```tsx
const hasRecordedActivity =
  metrics.sessoes_realizadas > 0 ||
  metrics.total_respostas > 0 ||
  StorageService.getNodes().length > 0;
```

When false, render this message above the real zero-valued cards:

```tsx
{!hasRecordedActivity && (
  <section className="view-card p-6 text-left space-y-2">
    <h2 className="font-display font-bold text-lg text-[var(--fg)]">
      Seu painel começa com a primeira prática
    </h2>
    <p className="text-sm text-[var(--muted)]">
      Ainda não há sessões, respostas ou termos registrados. Conclua uma atividade para acompanhar sua evolução aqui.
    </p>
  </section>
)}
```

Do not replace zeros with friendly-looking sample values.

- [ ] **Step 7: Run focused and type checks**

Run:

```bash
npm test -- tests/progressMetrics.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit real dashboard derivation**

```bash
git add src/services/progressMetrics.ts src/services/graphEngine.ts src/components/WeeklyDashboard.tsx tests/progressMetrics.test.ts
git commit -m "fix: derive dashboard from recorded progress"
```

---
### Task 5: Replace Fabricated Daily Tip and Home Resume States

**Files:**

- Create: `tests/emptyStateIntegrity.test.tsx`
- Modify: `src/components/DailyTipCard.tsx:64-205,786-832`
- Modify: `src/components/HomeOverview.tsx:43-51,381-442`
- Modify: `src/services/storage.ts:1855-1875`

**Interfaces:**

- Consumes: `StorageService.getNodes()`, `getMaterials()`, and `getConversations()` without creating new records.
- Produces: a no-graph Daily Tip CTA; a Home resume card only when a user message or material exists; a reset that clears both conversation keys.

- [ ] **Step 1: Write a server-rendered clean-state regression test**

Create `tests/emptyStateIntegrity.test.tsx`:

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyTipCard } from '../src/components/DailyTipCard';
import { StorageService } from '../src/services/storage';
import { UserStats } from '../src/types';

const stats: UserStats = {
  xp: 0,
  nivel: 1,
  sequencia_dias: 0,
  ultimo_dia_estudo: '2026-08-30',
  meta_diaria_minutos: 30,
  minutos_hoje: 0,
  conquistas_desbloqueadas: [],
  total_respostas: 0,
  respostas_corretas: 0,
  erros_corrigidos: 0,
  idioma_ativo: 'Francês',
  nivel_cefr: 'A1',
  materiais_gerados: 0,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('honest empty learning states', () => {
  it('does not invent a graph gap for a clean profile', () => {
    vi.spyOn(StorageService, 'getNodes').mockReturnValue([]);
    vi.spyOn(StorageService, 'getMaterials').mockReturnValue([]);
    vi.spyOn(StorageService, 'getCorrections').mockReturnValue([]);

    const html = renderToStaticMarkup(
      <DailyTipCard
        stats={stats}
        currentTopic="Francês: Viagens"
        onNavigateToMaterials={() => undefined}
        onNavigateToChat={() => undefined}
      />
    );

    expect(html).toContain('Ainda não há uma lacuna detectada');
    expect(html).toContain('Começar conversa');
    expect(html).not.toContain('Actually');
    expect(html).not.toContain('45%');
  });

  it('clears multi-conversation state during an explicit reset', () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { removeItem });
    StorageService.setCurrentUser(null);

    StorageService.resetAllData();

    expect(removeItem).toHaveBeenCalledWith('tutor_conversations_v2');
    expect(removeItem).toHaveBeenCalledWith('tutor_active_conv_id_v2');
  });
});
```

- [ ] **Step 2: Run the test and confirm the synthetic gap appears**

Run:

```bash
npm test -- tests/emptyStateIntegrity.test.tsx
```

Expected: FAIL because the card renders the default “Actually vs Currently” insight and reset leaves multi-conversation state behind.

- [ ] **Step 3: Make an empty graph return no learning gaps**

In `DailyTipCard.tsx`:

1. Replace the empty fallback branch with `return [];`.
2. Change the current selection to:

```tsx
const currentGap: LearningGapInsight | null = learningGaps[selectedGapIndex] ?? null;
```

3. Add `if (!currentGap) return;` to handlers that dereference `currentGap`, including quiz submission and “mark understood”.
4. Delete `getDefaultGapInsight` completely.
5. Preserve recorded zero mastery instead of replacing it with sample values:

```tsx
targetNode.dominio_estimado = Math.min(
  100,
  (targetNode.dominio_estimado ?? 0) + 12
);
targetNode.frequencia_erro = Math.max(
  0,
  (targetNode.frequencia_erro ?? 0) - 1
);
```

Use the same `?? 0` base in the “mark understood” update, and render `{currentGap.node.dominio_estimado ?? 0}% domínio` instead of `|| 45`.

6. Before the existing populated-card return, render this clean state:

```tsx
if (!currentGap) {
  return (
    <section className="view-card p-6 sm:p-8 text-left space-y-4">
      <div className="space-y-1">
        <h2 className="font-display font-bold text-lg text-[var(--fg)]">
          Ainda não há uma lacuna detectada
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Converse com o tutor ou adicione um material. Quando houver evidências no grafo, sua próxima revisão aparecerá aqui.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onNavigateToChat(currentTopic)}
          className="rounded-full px-4 py-2 text-xs font-extrabold bg-[var(--accent)] text-[var(--fg)]"
        >
          Começar conversa
        </button>
        <button
          type="button"
          onClick={() => onNavigateToMaterials()}
          className="rounded-full px-4 py-2 text-xs font-extrabold border border-[var(--border)] text-[var(--fg)]"
        >
          Adicionar material
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Make the explicit reset clear conversation state**

In `StorageService.resetAllData`, add the two omitted keys next to the legacy chat removal:

```ts
localStorage.removeItem(this.getKey(STORAGE_KEYS.CONVERSATIONS));
localStorage.removeItem(this.getKey(STORAGE_KEYS.ACTIVE_CONVERSATION_ID));
```

- [ ] **Step 5: Derive a resumable Home context without creating one**

At the top of `HomeOverview`, immediately after `studyPlan`, add:

```tsx
const graphNodes = StorageService.getNodes();
const materials = StorageService.getMaterials();
const resumableConversation = StorageService.getConversations().find((conversation) =>
  conversation.mensagens.some((message) => message.remetente === 'user')
);
const hasResumeContext = Boolean(resumableConversation || materials.length > 0);
const resumeDestination = resumableConversation ? 'chat' : 'materials';
const resumeDescription = resumableConversation
  ? `${resumableConversation.topico} · ${graphNodes.length} termos no grafo`
  : `${materials[0]?.titulo} · ${graphNodes.length} termos no grafo`;
```

Do not call `getActiveConversation()` here because that method creates a default conversation when none exists.

- [ ] **Step 6: Replace the hard-coded Home resume section**

Wrap the existing section in `hasResumeContext` and remove the 42% bar entirely:

```tsx
{hasResumeContext && (
  <section className="bg-[var(--fg)] text-[oklch(0.95_0.01_84)] rounded-[var(--r-lg)] p-6 sm:p-8 shadow-[var(--shadow-view)] flex flex-col md:flex-row items-center gap-6 text-left">
    <div className="w-18 h-18 rounded-2xl bg-[var(--accent)] flex items-center justify-center shrink-0">
      <Play className="w-8 h-8 text-[var(--fg)] fill-[var(--fg)] ml-1" />
    </div>
    <div className="space-y-1.5 flex-1 w-full">
      <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
        Continuar de onde parou
      </h3>
      <p className="text-xs sm:text-sm text-[oklch(0.80_0.03_285)]">
        {resumeDescription}
      </p>
    </div>
    <button
      type="button"
      onClick={() => onNavigate(resumeDestination)}
      className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-extrabold text-sm bg-[var(--accent)] text-[var(--fg)]"
    >
      <span>{resumableConversation ? 'Retomar conversa' : 'Abrir material'}</span>
    </button>
  </section>
)}
```

- [ ] **Step 7: Verify clean-state rendering and types**

Run:

```bash
npm test -- tests/emptyStateIntegrity.test.tsx
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit honest Home and Daily Tip states**

```bash
git add src/components/DailyTipCard.tsx src/components/HomeOverview.tsx src/services/storage.ts tests/emptyStateIntegrity.test.tsx
git commit -m "fix: show honest home learning states"
```

---

### Task 6: Remove Synthetic Practice Content and Production Simulation Controls

**Files:**

- Modify: `tests/emptyStateIntegrity.test.tsx`
- Modify: `src/services/flashcardsEngine.ts:110-135`
- Modify: `src/services/vocabDuelEngine.ts:12-68,387-564`
- Modify: `src/components/VocabularyDuelView.tsx:54-97,314-410`
- Modify: `src/components/FlashcardsView.tsx:535-547`
- Modify: `src/components/GraphMemoryView.tsx:61-75,146-205,312-321,335-346`
- Modify: `src/components/GraphTopologyCanvas.tsx:31-52,222-233`
- Modify: `src/components/MisconceptionsDictionary.tsx:544-632`

**Interfaces:**

- Consumes: graph nodes actually stored for the active language.
- Produces: `VocabDuelEngine.getEligibleNodes(idioma): GraphNode[]`; zero-question Duel behavior; zero mastery preserved across Flashcards, Duel, and Equívocos; direct empty-state CTAs; no simulation controls.

- [ ] **Step 1: Add a zero-node Duel assertion to the existing empty-state test**

Add the two service imports to `tests/emptyStateIntegrity.test.tsx` and extend its existing type import from `../src/types` to include `GraphNode`:

```ts
import { VocabDuelEngine } from '../src/services/vocabDuelEngine';
import { FlashcardsEngine } from '../src/services/flashcardsEngine';
import { GraphNode, UserStats } from '../src/types';
```

Append this test inside the existing `describe` block:

```ts
it('does not synthesize duel questions when the graph is empty', () => {
  vi.spyOn(StorageService, 'getNodes').mockReturnValue([]);

  expect(VocabDuelEngine.generateDuelQuestions('Francês', 8)).toEqual([]);
  expect(VocabDuelEngine.getEligibleNodes('Francês')).toEqual([]);
});

it('preserves zero mastery in cards and duel outcomes', () => {
  const node: GraphNode = {
    id: 'node-zero',
    tipo: 'vocabulario',
    titulo: 'Bonjour',
    descricao: 'Saudação em francês',
    dominio_estimado: 0,
    dificuldade: 1,
    frequencia_erro: 0,
    ultima_revisao: '2026-08-30T10:00:00.000Z',
    proxima_revisao: '2026-08-31T10:00:00.000Z',
    evidencias: ['Plano local'],
    criado_em: '2026-08-30T10:00:00.000Z',
    atualizado_em: '2026-08-30T10:00:00.000Z',
    idioma: 'Francês',
  };
  vi.spyOn(StorageService, 'getNodes').mockReturnValue([node]);
  vi.spyOn(StorageService, 'saveNodes').mockImplementation(() => undefined);

  expect(FlashcardsEngine.convertNodeToFlashcard(node).dominio_atual).toBe(0);

  VocabDuelEngine.updateNodeWithDuelResult(node.id, true, false);
  expect(node.dominio_estimado).toBe(8);

  node.dominio_estimado = 0;
  VocabDuelEngine.updateNodeWithDuelResult(node.id, false, false);
  expect(node.dominio_estimado).toBe(0);
});
```

- [ ] **Step 2: Run the focused test and confirm fallback questions are returned**

Run:

```bash
npm test -- tests/emptyStateIntegrity.test.tsx
```

Expected: FAIL because the engine fills the empty set with canned questions, `getEligibleNodes` does not exist, and zero mastery is replaced by 30/50-point defaults.

- [ ] **Step 3: Make the Duel engine select only recorded graph nodes**

In `src/services/vocabDuelEngine.ts`, add this method above `generateDuelQuestions`:

```ts
getEligibleNodes(idiomaAlvo = 'Inglês'): GraphNode[] {
  const targetLang = getLanguageConfig(idiomaAlvo);
  return StorageService.getNodes().filter((node) => {
    const nodeLang = getLanguageConfig(node.idioma || 'ingles');
    return (
      nodeLang.id === targetLang.id &&
      ['vocabulario', 'falso_amigo', 'expressao_idiomatica', 'dificuldade', 'conceito'].includes(node.tipo)
    );
  });
},
```

Then make `generateDuelQuestions` start with:

```ts
const targetLang = getLanguageConfig(idiomaAlvo);
const relevantNodes = this.getEligibleNodes(idiomaAlvo);
```

Delete the fallback-fill block and delete `getFallbackQuestions` in full. Keep sorting, question construction, shuffling, and slicing over real nodes.

- [ ] **Step 4: Preserve explicit zero mastery through practice surfaces**

In `VocabDuelEngine`, use nullish zero values in priority sorting:

```ts
const scoreA =
  100 - (a.dominio_estimado ?? 0) + (a.frequencia_erro ?? 0) * 15;
const scoreB =
  100 - (b.dominio_estimado ?? 0) + (b.frequencia_erro ?? 0) * 15;
```

Replace `updateNodeWithDuelResult` with:

```ts
updateNodeWithDuelResult(nodeId: string, isCorrect: boolean, isFast: boolean): void {
  const nodes = StorageService.getNodes();
  const nodeIndex = nodes.findIndex((node) => node.id === nodeId);
  if (nodeIndex === -1) return;

  const node = nodes[nodeIndex];
  const currentMastery = Math.max(0, node.dominio_estimado ?? 0);
  if (isCorrect) {
    const increment = isFast ? 12 : 8;
    node.dominio_estimado = Math.min(100, currentMastery + increment);
    node.frequencia_erro = Math.max(0, (node.frequencia_erro ?? 0) - 1);
    node.ultima_revisao = new Date().toISOString();
    node.proxima_revisao = new Date(Date.now() + 4 * 86400000).toISOString();
    node.evidencias = [
      `Acertou no Duelo de Vocabulário com resposta ${isFast ? 'ultra-rápida' : 'precisa'}`,
      ...(node.evidencias ?? []).slice(0, 4),
    ];
  } else {
    node.dominio_estimado = Math.max(0, currentMastery - 10);
    node.frequencia_erro = (node.frequencia_erro ?? 0) + 1;
    node.proxima_revisao = new Date().toISOString();
    node.evidencias = [
      'Errou termo no Duelo de Vocabulário (marcado para revisão espaçada prioritária)',
      ...(node.evidencias ?? []).slice(0, 4),
    ];
  }

  node.atualizado_em = new Date().toISOString();
  StorageService.saveNodes(nodes);
},
```

In `FlashcardsEngine.convertNodeToFlashcard`, change the mapped fields to:

```ts
dominio_atual: node.dominio_estimado ?? 0,
frequencia_erro: node.frequencia_erro ?? 0,
dificuldade: node.dificuldade ?? 3,
repeticoes: Math.max(0, Math.floor((node.dominio_estimado ?? 0) / 25)),
```

In `MisconceptionsDictionary`, map `frequenciaErro: node.frequencia_erro ?? 0` and `dominioEstimado: node.dominio_estimado ?? 0` so a new term is not displayed as one error and 50% mastery.

- [ ] **Step 5: Advertise and run the actual Duel round count**

In `VocabularyDuelView.tsx`, derive:

```tsx
const activeLanguage = stats.idioma_ativo || currentTopic;
const availableRoundCount = Math.min(
  8,
  VocabDuelEngine.getEligibleNodes(activeLanguage).length
);
```

Guard the start handler:

```tsx
const handleStartGame = () => {
  const generated = VocabDuelEngine.generateDuelQuestions(activeLanguage, 8);
  if (generated.length === 0) return;
  setQuestions(generated);
  setCurrentIndex(0);
  setAnswers([]);
  setInputAnswer('');
  setSelectedOption(null);
  setScore(0);
  setCurrentCombo(0);
  setFinalSession(null);
  setGameState('playing');
  startQuestionTimer(generated[0].tempo_limite_segundos || 12);
};
```

Replace the lobby action area with:

```tsx
{availableRoundCount === 0 ? (
  <div className="space-y-3 text-center">
    <p className="text-sm text-[var(--muted)]">
      Seu grafo ainda não tem termos em {activeTheme.nome} para montar um duelo.
    </p>
    {onPracticeInChat && (
      <Button onClick={() => onPracticeInChat(currentTopic)} className="rounded-full font-bold">
        Criar termos conversando
      </Button>
    )}
  </div>
) : (
  <Button
    size="lg"
    variant="default"
    onClick={handleStartGame}
    className="w-full sm:w-auto px-8 py-3 text-sm font-bold tracking-wide rounded-full"
  >
    <Zap className="w-4 h-4 text-[var(--accent)]" />
    <span>
      INICIAR DUELO ({availableRoundCount} RODADA{availableRoundCount === 1 ? '' : 'S'})
    </span>
  </Button>
)}
```

- [ ] **Step 6: Distinguish a filtered empty Flashcard deck from a globally empty deck**

Replace the action inside the current `cards.length === 0` branch:

```tsx
{filterMode !== 'todos' ? (
  <Button
    onClick={() => setFilterMode('todos')}
    size="sm"
    variant="default"
    className="rounded-full font-bold"
  >
    Limpar filtro
  </Button>
) : onPracticeInChat ? (
  <Button
    onClick={() => onPracticeInChat(currentTopic)}
    size="sm"
    variant="default"
    className="rounded-full font-bold"
  >
    Criar cartões conversando
  </Button>
) : null}
```

Use `Nenhum cartão corresponde a este filtro` when filtered and `Você ainda não tem cartões` when `todos` is empty.

- [ ] **Step 7: Delete graph simulation and fabricated “new” highlights**

In `GraphMemoryView.tsx`:

- Delete the branch that marks the first one or two old nodes as recent when no node was created today.
- Delete `handleSimulateDiscoveredConcept` completely.
- Delete the header `Simular Conceito` button.
- Stop passing `onSimulateNewNode` to `GraphTopologyCanvas`.
- Remove imports used only by simulation after checking them with `rg`.

In `GraphTopologyCanvas.tsx`:

- Remove `onSimulateNewNode` from the props interface and destructuring.
- Delete the duplicate simulation button.
- Remove `Zap` if it becomes unused.

- [ ] **Step 8: Lead the empty misconceptions screen with one action**

Wrap search/category/status controls in `items.length > 0`. When `items.length === 0`, render:

```tsx
<div className="text-center py-12 border border-dashed border-[var(--border)] rounded-[var(--r-md)] space-y-3">
  <BookOpen className="w-8 h-8 text-[var(--muted)] mx-auto" />
  <p className="text-sm font-semibold text-[var(--fg)]">
    Nenhum equívoco foi registrado ainda
  </p>
  <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
    As correções aparecem aqui depois que o tutor identifica e registra uma dificuldade real.
  </p>
  <button
    type="button"
    onClick={() => onPracticeTopic('Conversação livre')}
    className="rounded-full px-4 py-2 text-xs font-extrabold bg-[var(--accent)] text-[var(--fg)]"
  >
    Praticar com o tutor
  </button>
</div>
```

Retain the current filtered-empty message when `items.length > 0 && filteredItems.length === 0`.

- [ ] **Step 9: Verify no synthetic practice remains**

Run:

```bash
npm test -- tests/emptyStateIntegrity.test.tsx
npm run lint
rg -n "Simular Meta|Simular Conceito|INICIAR DUELO \(8 RODADAS\)|getFallbackQuestions" src
```

Expected: tests and lint PASS; `rg` returns no matches.

- [ ] **Step 10: Commit honest practice states**

```bash
git add tests/emptyStateIntegrity.test.tsx src/services/flashcardsEngine.ts src/services/vocabDuelEngine.ts src/components/VocabularyDuelView.tsx src/components/FlashcardsView.tsx src/components/GraphMemoryView.tsx src/components/GraphTopologyCanvas.tsx src/components/MisconceptionsDictionary.tsx
git commit -m "fix: remove synthetic practice content"
```

---

### Task 7: Build a Language-Aware, Explicit Onboarding Fallback

**Files:**

- Create: `src/services/studyPlanFallback.ts`
- Create: `tests/studyPlanFallback.test.ts`
- Modify: `src/types.ts:626-643`
- Modify: `src/components/OnboardingWizardModal.tsx:105-297,752-770`
- Modify: `src/services/storage.ts:1927-1965`

**Interfaces:**

- Consumes: `createFallbackStudyPlan(answers: OnboardingAnswers, now?: Date): GeneratedStudyPlan`.
- Produces: `GeneratedStudyPlan.estilo_aprendizado`; an API/local source flag held only in modal state; seven language-correct days and materials; initial graph nodes that retain zero mastery until practice.

- [ ] **Step 1: Write the fallback contract across all supported languages**

Create `tests/studyPlanFallback.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFallbackStudyPlan } from '../src/services/studyPlanFallback';
import { StorageService } from '../src/services/storage';
import { OnboardingAnswers } from '../src/types';

const cases = [
  ['Inglês', 'Hello'],
  ['Espanhol', 'Hola'],
  ['Francês', 'Bonjour'],
  ['Alemão', 'Hallo'],
  ['Italiano', 'Ciao'],
  ['Japonês', 'こんにちは'],
] as const;

afterEach(() => vi.unstubAllGlobals());

describe('local onboarding plan', () => {
  it.each(cases)('creates a coherent seven-day %s plan', (language, expectedTerm) => {
    const answers: OnboardingAnswers = {
      idioma_alvo: language,
      nivel_atual: 'A1',
      motivo_principal: 'Viagens',
      motivo_detalhado: 'pedir comida e transporte',
      interesses: ['Gastronomia & Culinária'],
      tempo_diario_minutos: 30,
      estilo_aprendizado: 'conversacao_voz',
    };

    const plan = createFallbackStudyPlan(
      answers,
      new Date('2026-08-30T12:00:00.000Z')
    );

    expect(plan.idioma).toBe(language);
    expect(plan.nivel_cefr).toBe('A1');
    expect(plan.meta_diaria_minutos).toBe(30);
    expect(plan.motivo_principal).toBe('Viagens');
    expect(plan.interesses_principais).toEqual(['Gastronomia & Culinária']);
    expect(plan.estilo_aprendizado).toBe('conversacao_voz');
    expect(JSON.stringify(plan)).toContain('pedir comida e transporte');
    expect(plan.cronograma_semanal).toHaveLength(7);
    expect(plan.nos_iniciais_grafo[0]?.titulo).toBe(expectedTerm);
    expect(plan.nos_iniciais_grafo.every((node) => node.idioma === language)).toBe(true);
    expect(plan.primeiro_material_estudo.idioma_alvo).toBe(language);
  });

  it('does not leak English fallback vocabulary into French', () => {
    const plan = createFallbackStudyPlan({
      idioma_alvo: 'Francês',
      nivel_atual: 'A1',
      motivo_principal: 'Viagens',
      interesses: ['Gastronomia & Culinária'],
      tempo_diario_minutos: 15,
      estilo_aprendizado: 'equilibrio_completo',
    });
    const serialized = JSON.stringify(plan);

    expect(serialized).not.toContain('Touch base');
    expect(serialized).not.toContain('Actually');
  });

  it('does not turn an initial zero-mastery term into sample progress', () => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    });
    StorageService.setCurrentUser(null);

    const plan = createFallbackStudyPlan({
      idioma_alvo: 'Francês',
      nivel_atual: 'A1',
      motivo_principal: 'Viagens',
      interesses: ['Gastronomia & Culinária'],
      tempo_diario_minutos: 15,
      estilo_aprendizado: 'equilibrio_completo',
    });

    StorageService.applyGeneratedPlan(plan);

    expect(StorageService.getNodes()[0]?.dominio_estimado).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and verify the builder is absent**

Run:

```bash
npm test -- tests/studyPlanFallback.test.ts
```

Expected: FAIL because the fallback service does not exist.

- [ ] **Step 3: Persist the selected learning style in the plan type**

Add this required field to `GeneratedStudyPlan` in `src/types.ts`:

```ts
estilo_aprendizado: OnboardingAnswers['estilo_aprendizado'];
```

Place it after `interesses_principais` so profile inputs remain grouped.

- [ ] **Step 4: Define exact seed content for all six languages**

Create `src/services/studyPlanFallback.ts` with these seed definitions and imports:

```ts
import { getLanguageConfig } from '../config/languages';
import { GeneratedStudyPlan, OnboardingAnswers, WeeklyPlanDay } from '../types';

interface SeedTerm {
  term: string;
  translation: string;
  example: string;
  ipa: string;
}

interface LanguageSeed {
  welcome: string;
  tutorLine: string;
  studentLine: string;
  terms: [SeedTerm, SeedTerm];
}

const LANGUAGE_SEEDS: Record<string, LanguageSeed> = {
  ingles: {
    welcome: 'Hello! Welcome to your study plan.',
    tutorLine: 'Hello! What would you like to practice today?',
    studentLine: 'I would like to practice a real travel situation.',
    terms: [
      { term: 'Hello', translation: 'Olá', example: 'Hello, nice to meet you.', ipa: '/həˈloʊ/' },
      { term: 'Thank you', translation: 'Obrigado', example: 'Thank you for your help.', ipa: '/ˈθæŋk juː/' },
    ],
  },
  espanhol: {
    welcome: '¡Hola! Bienvenido a tu plan de estudio.',
    tutorLine: '¡Hola! ¿Qué te gustaría practicar hoy?',
    studentLine: 'Me gustaría practicar una situación real de viaje.',
    terms: [
      { term: 'Hola', translation: 'Olá', example: 'Hola, mucho gusto.', ipa: '/ˈola/' },
      { term: 'Gracias', translation: 'Obrigado', example: 'Gracias por tu ayuda.', ipa: '/ˈɡɾa.sjas/' },
    ],
  },
  frances: {
    welcome: 'Bonjour ! Bienvenue dans votre programme d’étude.',
    tutorLine: 'Bonjour ! Qu’aimeriez-vous pratiquer aujourd’hui ?',
    studentLine: 'Je voudrais pratiquer une situation réelle de voyage.',
    terms: [
      { term: 'Bonjour', translation: 'Olá', example: 'Bonjour, enchanté !', ipa: '/bɔ̃.ʒuʁ/' },
      { term: 'Merci', translation: 'Obrigado', example: 'Merci pour votre aide.', ipa: '/mɛʁ.si/' },
    ],
  },
  alemao: {
    welcome: 'Hallo! Willkommen zu deinem Lernplan.',
    tutorLine: 'Hallo! Was möchtest du heute üben?',
    studentLine: 'Ich möchte eine echte Reisesituation üben.',
    terms: [
      { term: 'Hallo', translation: 'Olá', example: 'Hallo, schön dich kennenzulernen.', ipa: '/haˈloː/' },
      { term: 'Danke', translation: 'Obrigado', example: 'Danke für deine Hilfe.', ipa: '/ˈdaŋ.kə/' },
    ],
  },
  italiano: {
    welcome: 'Ciao! Benvenuto nel tuo piano di studio.',
    tutorLine: 'Ciao! Che cosa vorresti praticare oggi?',
    studentLine: 'Vorrei praticare una situazione reale di viaggio.',
    terms: [
      { term: 'Ciao', translation: 'Olá', example: 'Ciao, piacere di conoscerti.', ipa: '/ˈtʃa.o/' },
      { term: 'Grazie', translation: 'Obrigado', example: 'Grazie per il tuo aiuto.', ipa: '/ˈɡrat.tsje/' },
    ],
  },
  japones: {
    welcome: 'こんにちは！学習プランへようこそ。',
    tutorLine: 'こんにちは！今日は何を練習したいですか？',
    studentLine: '旅行で使う会話を練習したいです。',
    terms: [
      { term: 'こんにちは', translation: 'Olá', example: 'こんにちは、はじめまして。', ipa: '/koɲ.ɲi.tɕi.wa/' },
      { term: 'ありがとう', translation: 'Obrigado', example: '手伝ってくれて、ありがとう。', ipa: '/a.ɾi.ɡa.toː/' },
    ],
  },
};
```

- [ ] **Step 5: Implement the deterministic plan builder**

Continue the same file with:

```ts
const STYLE_LABELS: Record<OnboardingAnswers['estilo_aprendizado'], string> = {
  conversacao_voz: 'conversação e voz',
  vocabulario_flashcards: 'vocabulário e repetição espaçada',
  gramatica_pratica: 'gramática aplicada',
  equilibrio_completo: 'prática equilibrada',
};

function buildSchedule(minutes: number): WeeklyPlanDay[] {
  return [
    { dia_semana: 'Segunda-feira', foco: 'Vocabulário inicial', duracao_minutos: minutes, tipo_atividade: 'chat', descricao_pratica: 'Usar as primeiras expressões em contexto.' },
    { dia_semana: 'Terça-feira', foco: 'Revisão espaçada', duracao_minutos: minutes, tipo_atividade: 'flashcards', descricao_pratica: 'Revisar os termos gerados pelo plano.' },
    { dia_semana: 'Quarta-feira', foco: 'Diálogo situacional', duracao_minutos: minutes, tipo_atividade: 'chat', descricao_pratica: 'Simular uma situação ligada ao objetivo.' },
    { dia_semana: 'Quinta-feira', foco: 'Agilidade lexical', duracao_minutos: minutes, tipo_atividade: 'duel', descricao_pratica: 'Praticar os termos já registrados no grafo.' },
    { dia_semana: 'Sexta-feira', foco: 'Kit de estudo', duracao_minutos: minutes, tipo_atividade: 'materials', descricao_pratica: 'Revisar diálogo, exemplos e pronúncia.' },
    { dia_semana: 'Sábado', foco: 'Conversação livre', duracao_minutos: minutes, tipo_atividade: 'chat', descricao_pratica: 'Responder livremente usando o idioma-alvo.' },
    { dia_semana: 'Domingo', foco: 'Revisão leve', duracao_minutos: Math.max(10, Math.round(minutes / 2)), tipo_atividade: 'flashcards', descricao_pratica: 'Consolidar os termos da semana.' },
  ];
}

export function createFallbackStudyPlan(
  answers: OnboardingAnswers,
  now = new Date()
): GeneratedStudyPlan {
  const language = getLanguageConfig(answers.idioma_alvo);
  const seed = LANGUAGE_SEEDS[language.id];
  const createdAt = now.toISOString();
  const primaryInterest = answers.interesses[0];
  const focus = [
    answers.motivo_principal,
    answers.motivo_detalhado,
    primaryInterest,
  ].filter(Boolean).join(' · ');

  return {
    id: `plan-local-${now.getTime()}`,
    titulo_plano: `${answers.idioma_alvo} para ${answers.motivo_principal}`,
    descricao_plano: `Plano local de ${answers.tempo_diario_minutos} min/dia com foco em ${focus}.`,
    idioma: answers.idioma_alvo,
    nivel_cefr: answers.nivel_atual,
    meta_diaria_minutos: answers.tempo_diario_minutos,
    motivo_principal: answers.motivo_principal,
    interesses_principais: answers.interesses,
    estilo_aprendizado: answers.estilo_aprendizado,
    topico_inicial_recomendado: `${answers.idioma_alvo}: ${focus}`,
    mensagem_boas_vindas_tutor: `${seed.welcome} ${seed.tutorLine}`,
    estrategia_pedagogica: `Plano com ${STYLE_LABELS[answers.estilo_aprendizado]} e revisão progressiva.`,
    cronograma_semanal: buildSchedule(answers.tempo_diario_minutos),
    nos_iniciais_grafo: seed.terms.map((term, index) => ({
      id: `node-local-${language.id}-${index + 1}`,
      tipo: 'vocabulario',
      titulo: term.term,
      descricao: `Expressão inicial de ${answers.idioma_alvo}.`,
      dominio_estimado: 0,
      dificuldade: 1,
      frequencia_erro: 0,
      pronuncia_ipa: term.ipa,
      traducao: term.translation,
      exemplo_uso: term.example,
      idioma: answers.idioma_alvo,
    })),
    primeiro_material_estudo: {
      id: `material-local-${now.getTime()}`,
      titulo: `Guia inicial de ${answers.idioma_alvo}: ${answers.motivo_principal}`,
      tipo_fonte: 'texto',
      fonte_original: 'Plano local do assistente',
      idioma_alvo: answers.idioma_alvo,
      nivel_cefr: answers.nivel_atual,
      resumo: `Primeiro diálogo e vocabulário para ${focus}.`,
      vocabulario: seed.terms.map((term) => ({
        termo: term.term,
        traducao: term.translation,
        exemplo: term.example,
        pronuncia_ipa: term.ipa,
      })),
      gramatica: [],
      dialogo_pratica: [
        { personagem: 'Tutor', fala: seed.tutorLine },
        { personagem: 'Você', fala: seed.studentLine },
      ],
      questoes_compreensao: [{
        pergunta: `Como se usa “${seed.terms[0].term}”?`,
        resposta_correta: seed.terms[0].example,
        explicacao: `É uma expressão inicial de ${answers.idioma_alvo}.`,
      }],
      flashcards: seed.terms.map((term) => ({
        frente: term.term,
        verso: term.translation,
        dica: term.example,
      })),
      conteudo_markdown: `# ${answers.idioma_alvo}: ${answers.motivo_principal}\n\n${seed.tutorLine}\n\n${seed.studentLine}`,
      criado_em: createdAt,
      adicionado_ao_grafo: true,
    },
    dicas_personalizadas: [
      `Reserve ${answers.tempo_diario_minutos} minutos por dia.`,
      `Pratique em voz alta com foco em ${focus}.`,
    ],
    criado_em: createdAt,
  };
}
```

- [ ] **Step 6: Preserve zero mastery when applying the generated plan**

In `StorageService.applyGeneratedPlan`, replace falsey numeric defaults with nullish defaults so an explicit zero remains zero:

```ts
stats.meta_diaria_minutos = plan.meta_diaria_minutos ?? 30;
// ...inside fullNode:
dominio_estimado: newNode.dominio_estimado ?? 0,
dificuldade: newNode.dificuldade ?? 2,
frequencia_erro: newNode.frequencia_erro ?? 0,
```

Do not stamp initial nodes with practiced mastery. Keep the existing plan evidence label and dates; those identify provenance, not achievement.

- [ ] **Step 7: Make onboarding selections explicit and disclose the fallback source**

In `OnboardingWizardModal.tsx`:

1. Import `createFallbackStudyPlan`.
2. Initialize `selectedInterests` with `[]`.
3. Let `toggleInterest` remove the final selection; keep the five-item maximum.
4. Add state:

```tsx
const [generationSource, setGenerationSource] = useState<'api' | 'local' | null>(null);
```

5. At the beginning of `handleGeneratePlan`, return if no interest is selected.
6. Require `response.ok` before reading a successful plan.
7. On success, persist the style selected locally:

```tsx
const plan: GeneratedStudyPlan = {
  ...data.plano,
  estilo_aprendizado: answers.estilo_aprendizado,
};
setGeneratedPlan(plan);
setGenerationSource('api');
```

8. Replace the entire inline fallback object with:

```tsx
setGeneratedPlan(createFallbackStudyPlan(answers));
setGenerationSource('local');
setStep(5);
```

9. Move all three `clearTimeout` calls into `finally` so the loading messages cannot continue after either path.
10. Disable the generate/continue action while `selectedInterests.length === 0` and display `Selecione pelo menos um interesse` next to it.

- [ ] **Step 8: Show plan provenance and all seven days**

In the result screen, above the plan title, render:

```tsx
{generationSource === 'local' && (
  <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-900">
    A IA não respondeu desta vez. Criamos um plano local com as preferências que você informou; você pode revisar antes de aplicar.
  </div>
)}
```

Replace `generatedPlan.cronograma_semanal.slice(0, 4).map(...)` with `generatedPlan.cronograma_semanal.map(...)` and use:

```tsx
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2"
```

- [ ] **Step 9: Run fallback, type, and existing tests**

Run:

```bash
npm test -- tests/studyPlanFallback.test.ts
npm run lint
npm test
```

Expected: all PASS.

- [ ] **Step 10: Commit coherent onboarding fallback**

```bash
git add src/services/studyPlanFallback.ts src/components/OnboardingWizardModal.tsx src/services/storage.ts src/types.ts tests/studyPlanFallback.test.ts
git commit -m "fix: localize onboarding fallback plans"
```

---

### Task 8: Use the Active Language for Tutor Prompts and Every Audio Path

**Files:**

- Create: `src/services/languagePracticePrompts.ts`
- Create: `tests/languagePracticePrompts.test.ts`
- Modify: `src/components/ChatTutor.tsx:55-64,470-472,721-768,785-830,1721-1760,1910-1949`

**Interfaces:**

- Consumes: `getLanguageConfig(language)` and optional `Pick<GeneratedStudyPlan, 'motivo_principal'>`.
- Produces: `buildQuickPrompts(language, topic, plan?)`, `buildListenOnlyPrompts(language, topic)`, and one `targetLocale` used by all Tutor TTS calls.

- [ ] **Step 1: Write prompt and locale expectations**

Create `tests/languagePracticePrompts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getLanguageConfig } from '../src/config/languages';
import {
  buildListenOnlyPrompts,
  buildQuickPrompts,
} from '../src/services/languagePracticePrompts';

describe('language practice prompts', () => {
  it('builds French prompts for a French plan', () => {
    const prompts = buildQuickPrompts(
      'Francês',
      'Francês: Gastronomia e viagens',
      { motivo_principal: 'Viagens' }
    );

    expect(prompts).toHaveLength(4);
    expect(prompts.join(' ')).toContain('français');
    expect(getLanguageConfig('Francês').ttsLocale).toBe('fr-FR');
  });

  it('names the active language in listen-only prompts', () => {
    const prompts = buildListenOnlyPrompts('Japonês', 'Restaurantes');

    expect(prompts).toHaveLength(2);
    expect(prompts.every((item) => item.prompt.includes('Japonês'))).toBe(true);
    expect(getLanguageConfig('Japonês').ttsLocale).toBe('ja-JP');
  });

  it('keeps Spanish prompts in the Spanish path', () => {
    expect(buildQuickPrompts('Espanhol', 'Viagens')[0]).toContain('¡Hola!');
    expect(getLanguageConfig('Espanhol').ttsLocale).toBe('es-ES');
  });
});
```

- [ ] **Step 2: Run the test and confirm the prompt service is absent**

Run:

```bash
npm test -- tests/languagePracticePrompts.test.ts
```

Expected: FAIL because `languagePracticePrompts.ts` does not exist.

- [ ] **Step 3: Implement target-language prompt builders**

Create `src/services/languagePracticePrompts.ts`:

```ts
import { getLanguageConfig } from '../config/languages';
import { GeneratedStudyPlan } from '../types';

type PlanPromptContext = Pick<GeneratedStudyPlan, 'motivo_principal'>;

const cleanTopic = (topic: string) =>
  topic.replace(/^(Francês|Inglês|Espanhol|Alemão|Italiano|Japonês):\s*/i, '');

export function buildQuickPrompts(
  language: string,
  topic: string,
  plan?: PlanPromptContext | null
): string[] {
  const config = getLanguageConfig(language);
  const focus = cleanTopic(topic);

  if (config.id === 'frances') {
    return [
      'Bonjour ! Comment puis-je me présenter naturellement en français ?',
      `Simule un dialogue pratique sur ${focus} en français.`,
      `Quelles sont les expressions clés pour ${focus} ?`,
      `Pose-moi une question en français sur ${plan?.motivo_principal || focus}.`,
    ];
  }

  if (config.id === 'espanhol') {
    return [
      `¡Hola! ¿Cómo puedo iniciar una conversación natural sobre ${focus}?`,
      `Simula un diálogo práctico sobre ${focus} en español.`,
      `¿Cuáles son las expresiones clave para ${focus}?`,
      `Hazme una pregunta en español sobre ${plan?.motivo_principal || focus}.`,
    ];
  }

  if (config.id === 'ingles') {
    return [
      `Hello! Let's start a conversation about ${focus}.`,
      `Simulate a practical roleplay about ${focus}.`,
      `What are the most natural expressions for ${focus}?`,
      `Ask me a question in English about ${plan?.motivo_principal || focus}.`,
    ];
  }

  return [
    `Vamos iniciar uma conversa em ${config.displayName} sobre ${focus}.`,
    `Simule um diálogo prático sobre ${focus} em ${config.displayName}.`,
    `Ensine expressões essenciais em ${config.displayName} para ${focus}.`,
    `Faça uma pergunta em ${config.displayName} sobre ${plan?.motivo_principal || focus}.`,
  ];
}

export interface ListenOnlyPrompt {
  label: string;
  prompt: string;
}

export function buildListenOnlyPrompts(language: string, topic: string): ListenOnlyPrompt[] {
  const config = getLanguageConfig(language);
  const focus = cleanTopic(topic);

  return [
    {
      label: '🎧 Exemplo natural',
      prompt: `Fale um exemplo natural em ${config.displayName} sobre ${focus} e destaque ritmo e pronúncia.`,
    },
    {
      label: '📝 Desafio de ditado',
      prompt: `Crie um desafio curto de ditado em ${config.displayName} sobre ${focus}, adequado ao meu nível.`,
    },
  ];
}
```

- [ ] **Step 4: Replace the component-local prompt function**

In `ChatTutor.tsx`:

1. Import `getLanguageConfig`, `buildQuickPrompts`, and `buildListenOnlyPrompts`.
2. Delete `getLanguageQuickPrompts` completely.
3. Immediately after `currentLang`, derive:

```tsx
const languageConfig = getLanguageConfig(currentLang);
const targetLocale = languageConfig.ttsLocale;
const quickPrompts = buildQuickPrompts(currentLang, currentTopic, activePlan);
const listenOnlyPrompts = buildListenOnlyPrompts(currentLang, currentTopic);
```

- [ ] **Step 5: Pass the same locale through every message audio path**

Make these exact changes in `ChatTutor.tsx`:

- Add `lang: targetLocale` to `handleToggleMessageAudio`’s `SpeechService.speak` options.
- Change `handlePlayPhraseAudio` to default to the active locale:

```tsx
const handlePlayPhraseAudio = async (
  phraseId: string,
  phrase: string,
  lang = targetLocale
) => {
  if (playingAudioId === phraseId) {
    SpeechService.stop();
    setPlayingAudioId(null);
    return;
  }

  setIsVoiceLoading(true);
  try {
    await SpeechService.speak(
      phrase,
      {
        lang,
        voice: selectedVoice,
        rate: speechSpeed,
        useNeuralAI: true,
        onEnd: () => setIsVoiceLoading(false),
        onError: () => setIsVoiceLoading(false),
      },
      phraseId
    );
  } finally {
    setIsVoiceLoading(false);
  }
};
```

- Call auto-play with `handlePlayPhraseAudio(tutorMsg.id, data.resposta_tutor)` and no English argument.
- Replace every correction, example, and message-level `'en-US'` argument with `targetLocale`.
- Leave locale literals inside the canonical language registry untouched.

- [ ] **Step 6: Render listen-only actions from the active-language builder**

Replace the two hard-coded listen-only buttons with:

```tsx
{listenOnlyPrompts.map((item) => (
  <button
    key={item.label}
    type="button"
    onClick={() => handleSendMessage(item.prompt)}
    className="px-2 py-0.5 rounded bg-background hover:bg-muted border border-border text-[10px] text-foreground transition cursor-pointer"
  >
    {item.label}
  </button>
))}
```

- [ ] **Step 7: Verify locale coverage**

Run:

```bash
npm test -- tests/languagePracticePrompts.test.ts
npm run lint
rg -n "['\"]en-US['\"]|connected speech" src/components/ChatTutor.tsx
```

Expected: tests and lint PASS; `rg` returns no hard-coded English locale or listening prompt inside `ChatTutor.tsx`.

- [ ] **Step 8: Commit language-consistent practice**

```bash
git add src/services/languagePracticePrompts.ts src/components/ChatTutor.tsx tests/languagePracticePrompts.test.ts
git commit -m "fix: use active language across tutor audio"
```

---

### Task 9: Make the Chat Usable on Mobile and Collapse Secondary Guidance

**Files:**

- Create: `tests/chatPresentationContract.test.ts`
- Modify: `src/components/QuickRepliesContainer.tsx:25-59`
- Modify: `src/components/ChatTutor.tsx:143-163,285-287,851-875,935-1175,1363-1365,1674-1711,1961-1987`

**Interfaces:**

- Consumes: current messages and reply tips.
- Produces: `messagesScrollRef`, `mobileToolsOpen`, `expandedMessageActionsId`, `data-testid="chat-message-panel"`, and `data-testid="chat-composer"`.

- [ ] **Step 1: Write a structural regression contract for the chat layout**

Create `tests/chatPresentationContract.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the contract and confirm the current overflow model fails it**

Run:

```bash
npm test -- tests/chatPresentationContract.test.ts
```

Expected: FAIL for `scrollIntoView`, expanded reply guidance, and absent disclosures/test IDs.

- [ ] **Step 3: Collapse reply guidance by default**

In `QuickRepliesContainer.tsx`, change only:

```tsx
const [isCollapsed, setIsCollapsed] = useState(true);
```

Add `aria-expanded={!isCollapsed}` and `aria-controls="reply-guide-options"` to the toggle button. Add `id="reply-guide-options"` to the rendered grid.

- [ ] **Step 4: Scroll the message panel instead of the document**

In `ChatTutor.tsx`:

1. Replace `messagesEndRef` with:

```tsx
const messagesScrollRef = useRef<HTMLDivElement>(null);
```

2. Replace the `scrollIntoView` effect with:

```tsx
useEffect(() => {
  const panel = messagesScrollRef.current;
  if (!panel) return;
  panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
}, [messages, isLoading, reviewVoiceText]);
```

3. Remove the trailing element that only carried `messagesEndRef`.
4. Attach these attributes to the central message panel:

```tsx
ref={messagesScrollRef}
data-testid="chat-message-panel"
```

5. Change its classes to include `min-h-0 overflow-y-auto` and remove the conflicting second `overflow-hidden`.

- [ ] **Step 5: Constrain the chat to the dynamic viewport and keep the composer fixed in its flex column**

For the non-focus outer state, replace the fixed calculation with:

```tsx
'h-[calc(100dvh-7rem)] min-h-0 max-w-5xl w-full mx-auto p-2 sm:p-4 overflow-hidden'
```

On the composer wrapper add:

```tsx
data-testid="chat-composer"
```

and add `shrink-0` to its class list. Keep the reply guide immediately above the composer and collapsed by default.

- [ ] **Step 6: Collapse the top studio toolbar on small screens**

Add state near `isFocusMode`:

```tsx
const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
```

Immediately before `{/* Barra Superior Compacta e Unificada do Chat */}`, add:

```tsx
<button
  type="button"
  onClick={() => setMobileToolsOpen((open) => !open)}
  aria-expanded={mobileToolsOpen}
  aria-controls="chat-studio-controls"
  className="sm:hidden shrink-0 mb-2 rounded-full border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--fg)]"
>
  {mobileToolsOpen ? 'Ocultar ferramentas' : 'Ferramentas da conversa'}
</button>
```

Insert this opening element immediately before `{/* Barra Superior Compacta e Unificada do Chat */}`:

```tsx
<div
  id="chat-studio-controls"
  className={`${mobileToolsOpen ? 'block' : 'hidden'} sm:block shrink-0 max-h-[34dvh] overflow-y-auto sm:max-h-none sm:overflow-visible`}
>
```

Insert its closing `</div>` immediately after the integrated proficiency bar and immediately before `{/* Modal de Criação de Nova Conversa (Livre ou por Lição) */}`. The JSX between those two comment landmarks moves unchanged inside this wrapper.

Do not duplicate the controls in separate mobile and desktop trees.

- [ ] **Step 7: Put tutor-response actions behind one disclosure**

Add state:

```tsx
const [expandedMessageActionsId, setExpandedMessageActionsId] = useState<string | null>(null);
```

Replace the always-visible three-button tutor action block with:

```tsx
{!isUser && (
  <div className="mt-3 pt-2 border-t border-border/80 space-y-2">
    <button
      type="button"
      onClick={() => setExpandedMessageActionsId((current) =>
        current === msg.id ? null : msg.id
      )}
      aria-expanded={expandedMessageActionsId === msg.id}
      aria-controls={`message-actions-${msg.id}`}
      className="text-[10px] font-bold text-muted-foreground hover:text-foreground"
    >
      Mais ações
    </button>
    {expandedMessageActionsId === msg.id && (
      <div id={`message-actions-${msg.id}`} className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => handleSendMessage(`Poderia explicar novamente esse ponto sobre ${currentTopic} usando uma analogia intuitiva do cotidiano?`)} className="px-2 py-0.5 rounded border border-border text-[10px]">
          🌱 Simplificar com analogia
        </button>
        <button type="button" onClick={() => handleSendMessage(`Poderia aprofundar esse conceito com maior rigor técnico e exemplos adequados ao meu nível?`)} className="px-2 py-0.5 rounded border border-border text-[10px]">
          🔬 Aprofundar
        </button>
        <button type="button" onClick={() => handleSendMessage(`Poderia me mostrar um exemplo prático passo a passo sobre ${currentTopic}?`)} className="px-2 py-0.5 rounded border border-border text-[10px]">
          💡 Ver exemplo
        </button>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 8: Run contract and TypeScript checks**

Run:

```bash
npm test -- tests/chatPresentationContract.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 9: Verify the viewport with the existing Codex browser wrapper**

Start Vite in a separate terminal:

```bash
npx vite --host 127.0.0.1 --port 4173
```

Then run:

```bash
PLAYWRIGHT_CLI_SESSION=lingo-hardening /Users/jhonatan/.codex/skills/playwright/scripts/playwright_cli.sh open http://127.0.0.1:4173
PLAYWRIGHT_CLI_SESSION=lingo-hardening /Users/jhonatan/.codex/skills/playwright/scripts/playwright_cli.sh resize 390 844
PLAYWRIGHT_CLI_SESSION=lingo-hardening /Users/jhonatan/.codex/skills/playwright/scripts/playwright_cli.sh eval "() => { const messages = document.querySelector('[data-testid=chat-message-panel]')?.getBoundingClientRect(); const composer = document.querySelector('[data-testid=chat-composer]')?.getBoundingClientRect(); return { viewport: innerHeight, messagesHeight: messages?.height, composerBottom: composer?.bottom, bodyHeight: document.body.scrollHeight }; }"
```

Expected after navigating to Chat: `messagesHeight >= 338`, `composerBottom <= 844`, and receiving a message does not change document `scrollY`.

Close the browser session after the check:

```bash
PLAYWRIGHT_CLI_SESSION=lingo-hardening /Users/jhonatan/.codex/skills/playwright/scripts/playwright_cli.sh close
```

- [ ] **Step 10: Commit the mobile chat layout**

```bash
git add src/components/ChatTutor.tsx src/components/QuickRepliesContainer.tsx tests/chatPresentationContract.test.ts
git commit -m "fix: keep mobile chat focused on conversation"
```

---

### Task 10: Add Reachable Mobile Navigation

**Files:**

- Modify: `src/components/Navbar.tsx:1-83,131-215`
- Modify: `src/App.tsx:173-182,287-306`
- Test: `tests/accessibilityContracts.test.ts` created in Task 11; this task uses TypeScript plus browser verification before that contract lands.

**Interfaces:**

- Consumes: the existing `navLinks` array and `setActiveTab(tabId)` callback.
- Produces: four direct bottom-nav destinations and an accessible `Mais` menu for remaining destinations.

- [ ] **Step 1: Add mobile navigation state and derive both link groups**

In `Navbar.tsx`, import `MoreHorizontal` and `X` from Lucide, then add:

```tsx
const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
const mobilePrimaryIds = ['home', 'chat', 'flashcards', 'materials'];
const mobilePrimaryLinks = navLinks.filter((link) => mobilePrimaryIds.includes(link.id));
const mobileMoreLinks = navLinks.filter((link) => !mobilePrimaryIds.includes(link.id));
```

Update `handleTabClick` so every navigation action also calls `setIsMobileMoreOpen(false)`. Route the brand-logo click and `UserProfileMenu.onOpenAdminPanel` through `handleTabClick` as well, so they cannot leave the menu open.

- [ ] **Step 2: Keep the desktop link strip out of narrow layouts**

Change the current Nav Links wrapper from `flex` to:

```tsx
className="hidden lg:flex items-center gap-0.5 ml-auto overflow-x-auto scrollbar-none py-0.5"
```

Add `aria-current={isActive ? 'page' : undefined}` to each desktop link.

Hide sound, shared-base, and screenshot utility buttons below `sm` by adding `hidden sm:inline-flex`; keep the profile/account control visible.

- [ ] **Step 3: Render four direct destinations in a fixed mobile bar**

Immediately after the existing top `<nav>`, inside the Navbar wrapper, add:

```tsx
<nav
  data-testid="mobile-navigation"
  aria-label="Navegação principal móvel"
  className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-1.5 shadow-[var(--shadow)] backdrop-blur-md lg:hidden"
>
  {mobilePrimaryLinks.map((link) => {
    const Icon = link.icon;
    const isActive = activeTab === link.id;
    return (
      <button
        key={link.id}
        type="button"
        onClick={() => handleTabClick(link.id)}
        aria-current={isActive ? 'page' : undefined}
        className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${
          isActive ? 'bg-[var(--fg)] text-white' : 'text-[var(--muted)]'
        }`}
      >
        <Icon className="h-4 w-4" />
        <span>{link.label}</span>
      </button>
    );
  })}
  <button
    type="button"
    onClick={() => setIsMobileMoreOpen((open) => !open)}
    aria-expanded={isMobileMoreOpen}
    aria-controls="mobile-more-menu"
    className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-[var(--muted)]"
  >
    {isMobileMoreOpen ? <X className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
    <span>Mais</span>
  </button>
</nav>
```

- [ ] **Step 4: Render remaining destinations above the mobile bar**

Add this sibling immediately before the mobile nav:

```tsx
{isMobileMoreOpen && (
  <div
    id="mobile-more-menu"
    className="fixed inset-x-3 bottom-20 z-50 grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow)] lg:hidden"
  >
    {mobileMoreLinks.map((link) => {
      const Icon = link.icon;
      const isActive = activeTab === link.id;
      return (
        <button
          key={link.id}
          type="button"
          onClick={() => handleTabClick(link.id)}
          aria-current={isActive ? 'page' : undefined}
          className="flex items-center gap-2 rounded-xl px-3 py-3 text-left text-xs font-bold text-[var(--fg)] hover:bg-[oklch(0.955_0.012_84)]"
        >
          <Icon className="h-4 w-4" />
          <span>{link.label}</span>
        </button>
      );
    })}
  </div>
)}
```

- [ ] **Step 5: Reserve space for fixed mobile navigation**

In `App.tsx`, add `pb-24 lg:pb-0` to the main view container and footer wrapper so neither content nor the chat composer sits beneath the mobile bar.

- [ ] **Step 6: Verify all destinations at 390 px**

With Vite and the existing browser wrapper running at 390 x 844:

1. Confirm `Início`, `Conversar`, `Flashcards`, and `Materiais` are visible without horizontal scrolling.
2. Open `Mais` and confirm `Duelo`, `Equívocos`, `Grafo`, `Conquistas`, and `Painel` are visible.
3. Select `Painel`; confirm the menu closes and the selected view renders.
4. Return to `Conversar`; confirm the composer ends above the bottom bar.

Then run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit reachable mobile navigation**

```bash
git add src/components/Navbar.tsx src/App.tsx
git commit -m "feat: add mobile primary navigation"
```

---

### Task 11: Add Modal Focus Containment and Native Keyboard Controls

**Files:**

- Create: `src/hooks/useModalFocusTrap.ts`
- Create: `tests/accessibilityContracts.test.ts`
- Modify: `src/components/AuthModal.tsx:1-25,149-175`
- Modify: `src/components/OnboardingWizardModal.tsx:1-45,99-125,306-330`
- Modify: `src/App.tsx:1-35,306-335`
- Modify: `src/components/HomeOverview.tsx:381-411`
- Verify: `src/components/Navbar.tsx:131-end` navigation ARIA added in Task 10

**Interfaces:**

- Consumes: `useModalFocusTrap<T>(isOpen, onClose): RefObject<T | null>`.
- Produces: focus entry, Tab containment, Escape close, focus restoration, dialog semantics, and native Home buttons; verifies Task 10 navigation ARIA.

- [ ] **Step 1: Write source-level accessibility contracts**

Create `tests/accessibilityContracts.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the contract and confirm semantics are missing**

Run:

```bash
npm test -- tests/accessibilityContracts.test.ts
```

Expected: FAIL because the hook and modal attributes do not exist.

- [ ] **Step 3: Implement one focus hook for the three audited modals**

Create `src/hooks/useModalFocusTrap.ts`:

```ts
import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalFocusTrap<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (!container) return;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    (getFocusable()[0] || container).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  return containerRef;
}
```

- [ ] **Step 4: Apply dialog semantics to Auth**

In `AuthModal.tsx`, call the hook before `if (!isOpen) return null`:

```tsx
const dialogRef = useModalFocusTrap<HTMLDivElement>(isOpen, onClose);
```

On the inner modal panel add:

```tsx
ref={dialogRef}
role="dialog"
aria-modal="true"
aria-labelledby="auth-dialog-title"
tabIndex={-1}
```

Add `id="auth-dialog-title"` to the `<h2>` and `aria-label="Fechar autenticação"` to its close button.

- [ ] **Step 5: Apply dialog semantics to Onboarding**

In `OnboardingWizardModal.tsx`, use the same hook before the early return. Add to its inner panel:

```tsx
ref={dialogRef}
role="dialog"
aria-modal="true"
aria-labelledby="onboarding-dialog-title"
tabIndex={-1}
```

Give the visible step heading `id="onboarding-dialog-title"` and the close icon `aria-label="Fechar configuração"`.

- [ ] **Step 6: Apply dialog semantics to topic selection**

At App component scope, create:

```tsx
const topicDialogRef = useModalFocusTrap<HTMLDivElement>(
  showTopicModal,
  () => setShowTopicModal(false)
);
```

On the inner topic panel add:

```tsx
ref={topicDialogRef}
role="dialog"
aria-modal="true"
aria-labelledby="topic-dialog-title"
tabIndex={-1}
```

Give “Alterar Idioma & Tópico” `id="topic-dialog-title"` and its close button `aria-label="Fechar seleção de idioma e tópico"`.

- [ ] **Step 7: Convert study-space cards into native buttons**

In `HomeOverview.tsx`, replace the outer tile `<div>` with:

```tsx
<button
  type="button"
  key={tile.id}
  onClick={() => onNavigate(tile.id)}
  className="group bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-sm)] p-5 sm:p-6 shadow-xs flex flex-col gap-3.5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-depth)] cursor-pointer text-left"
>
```

Keep the current icon, heading, description, and action children byte-for-byte inside the new element, then replace the matching closing `</div>` at the end of the mapped tile with `</button>`. Do not add `role`, `tabIndex`, or keyboard handlers; the native element provides them.

- [ ] **Step 8: Run contracts and type checks**

Run:

```bash
npm test -- tests/accessibilityContracts.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 9: Perform keyboard verification in the browser**

For Auth, Onboarding, and Topic Selection separately:

1. Focus the trigger and open the modal.
2. Confirm focus moves to the first control inside.
3. Press Tab through the final control; confirm focus wraps to the first.
4. Press Shift+Tab on the first control; confirm focus wraps to the final control.
5. Press Escape; confirm the modal closes and focus returns to its trigger.
6. With a modal open, confirm no navbar control receives focus.

On Home, Tab to every study space and activate one with Enter, then repeat with Space.

- [ ] **Step 10: Commit accessibility basics**

```bash
git add src/hooks/useModalFocusTrap.ts src/components/AuthModal.tsx src/components/OnboardingWizardModal.tsx src/App.tsx src/components/HomeOverview.tsx tests/accessibilityContracts.test.ts
git commit -m "fix: add modal and keyboard accessibility"
```

---

### Task 12: Split Heavy Views from the Initial Bundle

**Files:**

- Modify: `src/App.tsx:1-21,180-283`
- Test: production build output via `npm run build`

**Interfaces:**

- Consumes: existing named component exports.
- Produces: lazy chunks for Chat, Flashcards, Duel, Materials, Misconceptions, Graph, Dashboard, Achievements, and Admin; a single accessible loading fallback.

- [ ] **Step 1: Record the pre-change build artifact baseline**

Run:

```bash
npm run build
find dist/assets -maxdepth 1 -type f -name '*.js' -exec ls -lh {} \;
```

Expected: build PASS; record the initial entry filename/size and the audited comparison baseline of 620.58 kB gzip.

- [ ] **Step 2: Replace heavy static imports with named-export lazy imports**

Keep `Navbar`, `HomeOverview`, theme selector, and modal imports static. Change the React import and heavy view definitions to:

```tsx
import React, { lazy, Suspense, useEffect, useState } from 'react';

const ChatTutor = lazy(() =>
  import('./components/ChatTutor').then((module) => ({ default: module.ChatTutor }))
);
const FlashcardsView = lazy(() =>
  import('./components/FlashcardsView').then((module) => ({ default: module.FlashcardsView }))
);
const VocabularyDuelView = lazy(() =>
  import('./components/VocabularyDuelView').then((module) => ({ default: module.VocabularyDuelView }))
);
const GraphMemoryView = lazy(() =>
  import('./components/GraphMemoryView').then((module) => ({ default: module.GraphMemoryView }))
);
const MaterialsView = lazy(() =>
  import('./components/MaterialsView').then((module) => ({ default: module.MaterialsView }))
);
const MisconceptionsDictionary = lazy(() =>
  import('./components/MisconceptionsDictionary').then((module) => ({ default: module.MisconceptionsDictionary }))
);
const WeeklyDashboard = lazy(() =>
  import('./components/WeeklyDashboard').then((module) => ({ default: module.WeeklyDashboard }))
);
const AchievementsView = lazy(() =>
  import('./components/AchievementsView').then((module) => ({ default: module.AchievementsView }))
);
const AdminView = lazy(() =>
  import('./components/AdminView').then((module) => ({ default: module.AdminView }))
);
```

Delete the corresponding static imports.

- [ ] **Step 3: Add one loading fallback around view selection**

Above `App`, add:

```tsx
const ViewLoadingFallback = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-64 items-center justify-center text-sm font-semibold text-[var(--muted)]"
  >
    Carregando área de estudo…
  </div>
);
```

Inside `#main-app-content`, insert `<Suspense fallback={<ViewLoadingFallback />}>` immediately before the Home `activeTab` branch. Insert the matching `</Suspense>` immediately after the Admin `activeTab` branch and before the closing tag of `#main-app-content`:

```tsx
<Suspense fallback={<ViewLoadingFallback />}>
</Suspense>
```

Home remains present in the initial chunk because its import stays static.

- [ ] **Step 4: Verify type, test, and production chunks**

Run:

```bash
npm run lint
npm test
npm run build
find dist/assets -maxdepth 1 -type f -name '*.js' -exec ls -lh {} \;
```

Expected:

- All checks PASS.
- Build output contains separate chunks whose names include multiple heavy views or corresponding hashed modules.
- The initial entry gzip size is lower than the recorded baseline.
- Do not add manual chunk configuration unless lazy imports fail to create separate view chunks.

- [ ] **Step 5: Smoke-test lazy destinations**

Run the app and visit, in order: Home, Chat, Flashcards, Duel, Materials, Equívocos, Grafo, Conquistas, Painel. Confirm the loading fallback disappears and each view renders without console errors. Log in as a real authorized admin only if available; otherwise verify the Admin chunk through the production manifest without bypassing authentication.

- [ ] **Step 6: Commit route-level loading**

```bash
git add src/App.tsx
git commit -m "perf: lazy load heavy study views"
```

---

## Final Acceptance Gate

- [ ] **Run the full automated gate**

```bash
npm run lint
npm test
npm run build
```

Expected: TypeScript PASS, all Vitest tests PASS, production client/server build PASS.

- [ ] **Verify the clean no-account journey**

Use the app’s existing reset action, then execute:

1. Continue without an account.
2. Confirm Home, Daily Tip, Dashboard, Flashcards, Duel, Graph, and Equívocos show no invented history.
3. Open Chat and confirm XP, minutes, answers, and achievements do not change.
4. Complete French A1 onboarding for travel/gastronomy.
5. Confirm the preview contains seven days and no English fallback terms.
6. Apply the plan, start its topic, send one message, and confirm the tutor receives French/plan context.
7. Confirm only the completed response changes answers/XP and unlocks the first-conversation achievement once.

- [ ] **Verify responsive and keyboard acceptance**

At 390 x 844:

- Direct bottom navigation shows Home, Chat, Flashcards, and Materials.
- The `Mais` menu reaches every other user view.
- The Chat message panel is at least 338 px tall.
- The composer remains above mobile navigation.
- New messages scroll only the panel.

With keyboard only:

- Auth, Onboarding, and Topic dialogs contain focus, close on Escape, and restore focus.
- Every Home study space activates with Enter and Space.

- [ ] **Review the final diff and repository hygiene**

```bash
git status --short
git diff --check
git log --oneline --decorate -12
```

Expected: no whitespace errors, no debug/screenshot artifacts, no unrelated files, and one scoped commit per task.

- [ ] **Hold external actions for human approval**

Do not deploy `firestore.rules`, publish the build, promote accounts, or migrate/overwrite user data. Present local test evidence, candidate rules evidence, build sizes, and the final diff for explicit approval.

---

## Requirement Coverage

| Requirement | Implemented by |
|---|---|
| SEC-1 | Tasks 1-2 |
| QUAL-1 | Tasks 1, 12, Final Gate |
| DATA-1 | Task 3 |
| DATA-2 | Task 4 |
| UX-1 | Tasks 5-6 |
| ONB-1 | Task 7 |
| LANG-1 | Task 8 |
| CHAT-1 | Task 9 |
| NAV-1 | Task 10 |
| A11Y-1 | Task 11 |
| PERF-1 | Task 12 |

## Execution Order

Execute tasks strictly in numeric order. Tasks 1-2 close the safety boundary; Tasks 3-6 establish truthful data; Tasks 7-9 repair the core learning journey; Tasks 10-11 make it reachable; Task 12 optimizes loading only after behavior is stable.
