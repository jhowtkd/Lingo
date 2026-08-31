# Lingo Product Hardening Specification

## Objective

Turn the current Lingo prototype into an honest, usable, keyboard-accessible learning flow whose visible progress comes only from persisted user activity and whose primary journey works on a 390 x 844 viewport.

The primary journey is:

1. Enter without an account or authenticate.
2. Complete onboarding and generate a seven-day plan.
3. Start the plan topic in the tutor.
4. Send the first message in the selected target language.
5. Review progress that reflects only completed activity.

## Product principles

- Never present seed, fallback, simulated, or inferred values as user history.
- Prefer deleting demo-only controls and fabricated defaults over adding configuration layers.
- Keep account creation optional for the learning flow.
- Preserve plan context through `OnboardingWizardModal` -> `App` -> `ChatTutor` -> `/api/chat`.
- Use the existing language registry in `src/config/languages.ts` as the canonical source for BCP-47 and TTS locales.
- Do not add runtime or test dependencies.
- Do not redesign the visual identity or replace Tailwind, Motion, Firebase, Vitest, Vite, or Express.
- Do not deploy Firebase rules, publish the app, or mutate remote/user data as part of implementation.

## Requirements

### SEC-1: Firestore authorization

- A signed-in user may read and update only their own profile unless they are already an administrator.
- A profile owner may not change `uid`, `role`, or `createdAt`.
- Administrator status may continue to come from the trusted email allowlist or an existing profile role, but an owner must not be able to self-assign that role.
- The public authentication modal must not expose a demo administrator identity or create a client-only administrator profile.
- The application must render `AdminView` only when `currentUser.role === 'admin'`.
- Rule deployment remains an explicit human gate after local verification.

### QUAL-1: Restored quality gate

- `npm run lint` must pass with no TypeScript errors.
- Guest sessions must not attempt Firestore writes that require an authenticated Firebase user.
- Existing `npm test` and `npm run build` behavior must remain green.

### DATA-1: Honest achievements and study time

- Opening or navigating to the chat must not unlock an achievement or award XP.
- `primeira_conversa` unlocks only after at least one successful tutor interaction has incremented `stats.total_respostas`.
- A text interaction must not record a fixed or invented number of study minutes.
- Welcome messages and an empty graph must not present a CEFR-derived or fallback mastery percentage as measured user history.
- Voice flows may continue recording measured duration.

### DATA-2: Honest weekly progress

- Daily goals, milestones, chart points, vocabulary counts, session counts, streaks, and accuracy must be derived from `UserStats`, `StudySession`, `GraphNode`, and `PedagogicalCorrection` records.
- A clean profile must show zero activity and guidance to begin; it must not show six terms, completed gold milestones, invented minutes, or simulated consistency.
- The dashboard must not expose `Simular Meta`.

### UX-1: Honest empty and resume states

- `DailyTipCard` must not invent a learning gap when the graph is empty.
- Home must not show a hard-coded resume count or 42% progress.
- Flashcards must distinguish “current filter is empty” from “the user has no cards at all.”
- Vocabulary Duel must use only the user’s graph nodes, advertise its actual round count, and refuse to start with zero questions.
- An explicit zero mastery/error count must remain zero across Flashcards, Duel, Daily Tip, and Equívocos until a recorded interaction changes it.
- Graph and topology screens must not expose `Simular Conceito`.
- The misconceptions screen must present one direct next action when no items exist instead of leading with inactive filters.

### ONB-1: Coherent onboarding fallback

- Interests start unselected; the user must select at least one before plan generation.
- The fallback plan must preserve the chosen language, CEFR level, motive, interests, learning style, and daily minutes.
- Applying a generated plan may create starter terms, but their mastery begins at zero.
- Its welcome text, initial graph nodes, vocabulary, examples, dialogue, and flashcards must belong to the selected language.
- The preview must display all seven generated days.
- When the API path fails, the preview must explicitly say that a local plan was produced; it must not imply that the AI service responded.

### LANG-1: Target-language audio and prompts

- Every tutor message, correction phrase, listen-only prompt, pronunciation action, and auto-play path must use `getLanguageConfig(currentLanguage).ttsLocale`.
- Listen-only prompts must name the active language rather than hard-code English or connected speech.
- Existing French, Spanish, and English quick prompts remain available; German, Italian, and Japanese use the generic active-language form.

### CHAT-1: Mobile conversation layout

- At 390 x 844, the message panel must occupy at least 40% of the viewport once the page header is present.
- The composer must remain visible without scrolling the document.
- New messages must scroll the message panel, not the entire page.
- The pedagogical reply guide starts collapsed and expands on demand.
- Advanced message actions must remain available but collapse behind one `Mais ações` control per tutor response.

### NAV-1: Mobile navigation

- At 390 px width, `Início`, `Conversar`, `Flashcards`, and `Materiais` must be directly reachable from a fixed bottom navigation.
- `Duelo`, `Equívocos`, `Grafo`, `Conquistas`, and `Painel` must be reachable through an accessible `Mais` menu.
- Desktop navigation keeps its current destinations and visual treatment.
- Page content must include bottom padding so the fixed navigation never obscures the composer or footer.

### A11Y-1: Modal and keyboard basics

- Authentication, onboarding, and topic-selection modals use `role="dialog"`, `aria-modal="true"`, and a programmatically associated title.
- Opening a modal moves focus inside it; Tab and Shift+Tab remain inside; Escape closes it; close restores the prior focus.
- Close icon buttons have accessible names.
- Home study-space tiles are native buttons and preserve their visual layout.

### PERF-1: Route-level loading

- Keep `Navbar` and `HomeOverview` in the initial bundle.
- Load Chat, Flashcards, Duel, Materials, Misconceptions, Graph, Achievements, Dashboard, and Admin views with `React.lazy` and `Suspense`.
- The production build must emit separate view chunks and reduce initial JavaScript transfer from the audited 620.58 kB gzip baseline.

## Acceptance criteria

1. On a clean local profile, Home, Daily Tip, Dashboard, Flashcards, Duel, Graph, and Misconceptions show zero-state language without invented progress.
2. Opening Chat leaves XP, achievements, answers, and minutes unchanged and shows no mastery percentage before graph evidence exists.
3. Completing one successful chat response increments real response/XP fields and unlocks `primeira_conversa` once.
4. A French A1 travel plan contains no English fallback vocabulary, previews exactly seven days, and applies starter terms at zero mastery.
5. French tutor audio requests use `fr-FR`; Spanish uses `es-ES`; Japanese uses `ja-JP`.
6. At 390 x 844, primary navigation and the chat composer are visible, and document scroll is not triggered by a new message.
7. Keyboard focus cannot leave the three audited modals while they are open.
8. A normal authenticated user cannot update their profile role under the candidate Firestore rules.
9. `npm run lint`, `npm test`, and `npm run build` pass.
10. The repository contains no public demo-admin entry point or production simulation buttons.

## Explicit non-goals

- Replacing the current UI design system.
- Adding a new analytics provider or event schema.
- Adding React Testing Library, jsdom, Firebase Emulator, Playwright, or another dependency.
- Creating a new backend role-management service or custom-claims workflow.
- Reworking every secondary modal in the application; this pass covers the three audited entry-flow modals.
- Deploying Firebase rules, publishing a build, or approving production behavior without human review.
