# Changes

## 0.1.0 — 2026-10-21 — initial scaffold (R1–R6)

New repo. Everything is new; the notable decisions:

- **Store = GitHub Discussions.** `react-app/src/github/codec.ts` defines the encoding (hidden `<!-- retro:{…} -->` JSON header + Markdown). Unit-tested.
- **Auth = GitHub OAuth via `relay/`** (Cloudflare Worker, two routes, stores nothing) with a PAT fallback in Settings. Token in IndexedDB (`lib/kvStore.ts`, copied from Bullpen).
- **All GitHub calls in `src/github/retros.ts`** — GraphQL for discussions/comments/reactions/issues/Projects, REST only for labels (GraphQL `createLabel` is still preview-gated).
- **Board polls every 5 s** while visible (`hooks/usePolling.ts`); GitHub is the only source of truth, no local state to reconcile.
- **Phases** Collect → Discuss → Actions → Closed, controlled by the Discussion's author (the facilitator); stored in the Discussion header so every browser sees the same phase.
- **Promote** = `createIssue` + `addProjectV2ItemById` + `updateProjectV2ItemFieldValue(Status)` + rewrite the note header with the issue link.
- **Fleet conventions:** hamburger accordion menu (View/Tools/Status/Links), build stamp + LLC footer, dark tokens from Bullpen, hash routing for shareable board links on Pages.
- `for-team-repos/`: fallback retro issue form and an Actions workflow that opens the retro issue when a `v*` sprint tag is pushed.
- `docs/lecture-notes.md`: the architecture & workflow lecture.
