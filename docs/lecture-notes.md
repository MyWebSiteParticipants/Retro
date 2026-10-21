# Lecture notes — Retro: architecture and workflow

*Software Tools and Practices · companion to the sprint-retrospective lecture.*
*These notes track the Retro app as built (v0.1, Oct 2026). Update them when the app changes.*

---

## 0. Why we are looking at this app

Three reasons, in the order a Scrum team cares about them:

1. **The ceremony.** Every sprint ends with a review (demo) and a retrospective (how we worked). Retro is the tool the teams use for the second one. You need to know how to run one.
2. **The architecture is a lesson by itself.** Retro is a *view over GitHub*. It has no database. The same idea — your Scrum board is a view over issues, your release is a view over tags — runs through the whole course.
3. **It's a real story on the backlog.** Everything in `ROADMAP.md` is a Bullpen-sized story that goes through the same fork → branch → PR into `dev` flow you use for the product. Dogfooding.

---

## 1. The retrospective, as a procedure

**When.** Last day of the sprint, right after the Sprint Review, 30–45 minutes, same room/call.
On our calendar: Sprint N ends on a Friday; the `release/sprint-N` branch has merged to `main` and been tagged `v0.(7+N)`. The tag is the trigger.

**Who.** Everyone on the team, including the Product Owner. The **Scrum Master facilitates** — on Bullpen that rotates so each student runs one; on WeShopAlot it's Abdullah. The facilitator does not vote first and does not decide the actions.

**The five steps** (the app's phases follow them):

| Step | Minutes | What happens | In the app |
|---|---|---|---|
| Previous actions | 5 | Open last sprint's action items. Done / dropped / carried? | History view |
| Collect | 8 | Everyone writes notes in silence, one thought per note. | Phase 1, timer, authors hidden |
| Discuss | 15 | Reveal. Group duplicates. Vote. Talk through the top three. | Phase 2, ⋯ → Group under, 👍 |
| Actions | 10 | Pick **2–3**. Each gets a verb-first title and **one owner**. | Phase 3, Promote → issue on the board |
| Close | 1 | Lock it. | Phase 4 |

**Rules that make retros work (and the reason for each):**

- *One thought per note.* A note with three ideas can't be voted on or grouped.
- *Silence while collecting.* Otherwise the first loud opinion anchors everybody.
- *Max three actions.* Ten actions means zero actions. If it's not worth an owner and a column on the board, it's not an action.
- *Actions are issues.* Not a bullet in a doc. The same place feature work lives, in the Sprint column of the next sprint, so the daily standup trips over it.
- *Start with last time's actions.* The retro is only worth doing if the team can see that saying something changes something.
- *Rotate formats.* Start/Stop/Continue, 4 Ls, Sailboat. Same questions every two weeks produce the same answers.

**Grading note.** Retros are attributed in GitHub (every comment has an author). Participation is visible. That is deliberate.

---

## 2. Architecture

### 2.1 The one-sentence version

> Retro is a static React PWA on GitHub Pages that reads and writes GitHub Discussions, Issues and Projects with the *user's own* GitHub token; the only server is a 100-line Cloudflare Worker that finishes the OAuth sign-in.

### 2.2 The picture

```
┌──────────────────────────────────────────────┐
│  browser: React + TypeScript PWA (Vite)      │
│  mywebsiteparticipants.github.io/Retro/      │
│                                              │
│  features/   sessions · board · actions ·    │
│              history · settings · help       │
│  github/     client.ts  auth.ts  retros.ts   │
│              codec.ts (pure, unit-tested)    │
│  lib/kvStore IndexedDB  ← token lives here   │
└───────┬───────────────────────────┬──────────┘
        │ once, at sign-in          │ every read/write
        ▼                           ▼
┌─────────────────┐        ┌──────────────────────────────┐
│ relay (Worker)  │        │ api.github.com               │
│ /auth/start     │        │  GraphQL: discussions,       │
│ /auth/exchange  │        │  comments, reactions, issues,│
│ holds the OAuth │        │  ProjectV2                   │
│ client secret   │        │  REST: labels                │
└────────┬────────┘        └──────────────────────────────┘
         │ code → token
         ▼
   github.com/login/oauth
```

### 2.3 Decision 1 — where the data lives

The question every app has to answer first. We had two real options:

| | **GitHub Discussions as the store** (chosen) | Cloudflare D1 + Durable Object |
|---|---|---|
| Hosting | none | a Worker + a database we own |
| Where a retro ends up | in the repo being graded, readable on github.com forever | in our DB; we'd have to write a summary back |
| Live updates | polling every 5 s | real websockets |
| Anonymity | fake (comments have authors) | trivial |
| Auth | user's own GitHub token | we'd issue our own sessions |
| Lesson | "the app is a view over the system of record" | "build a backend" |

We picked Discussions because the artifact lands where the grading, the issues and the PRs already are, and because *the app can disappear and nothing is lost*. That property — the system of record is somewhere durable and standard; the app is replaceable — is worth more than real-time stickies.

**How it's encoded** (`src/github/codec.ts`): every Discussion body and every comment body starts with an HTML comment holding JSON:

```markdown
<!-- retro:{"v":1,"app":"retro","column":"start"} -->
Write tests before the PR, not after
```

GitHub renders the HTML comment as nothing, so on github.com a retro reads like a normal discussion. The app reads the header to know which column the note belongs in. `v:1` is there so a future version can change the shape and still read old retros. The whole codec is pure functions with unit tests, no `fetch` anywhere — that's the part of the app most worth testing.

| Scrum thing | GitHub thing | Why that one |
|---|---|---|
| A retro | Discussion in category *Retrospectives* | threaded, has a body for settings, has a URL |
| A sticky note | Discussion comment | editable/deletable by its author, has reactions |
| A vote | 👍 reaction | one per user per comment — GitHub enforces the rule for us |
| Phase / reveal / timer | fields in the Discussion's hidden header | every browser polls the same body, so everyone sees the same phase |
| Grouping duplicates | `mergedInto` in the child note's header | reversible, nothing deleted |
| An action item | Issue with label `retro-action` | it's work; work is issues |
| "Which sprint was this from?" | hidden header in the issue body | survives title edits |
| On the Scrum board | `addProjectV2ItemById` + Status = *Sprint* | lands in the next sprint's column automatically |

### 2.4 Decision 2 — how people sign in

GitHub Pages serves static files. GitHub's OAuth flow needs a **client secret** to turn the short-lived `code` into a token, and a secret in a static bundle is not a secret. So:

1. *Sign in* sends the browser to the relay's `/auth/start`, which redirects to `github.com/login/oauth/authorize` with our client id, the scopes and a random `state`.
2. GitHub sends the user back to **the app** (`…/Retro/?code=…&state=…`).
3. The app checks `state` matches what it put in `sessionStorage` (CSRF guard), POSTs the `code` to the relay's `/auth/exchange`.
4. The relay adds the secret, calls `github.com/login/oauth/access_token`, and returns the token. It stores nothing.
5. The app keeps the token in IndexedDB and uses it for every GitHub call directly. The relay is never involved again.

Compare Bullpen's relay, which proxies *every* Alpaca call because Alpaca sends no CORS headers. GitHub's API does, so Retro's relay is two routes and done. **A relay should be exactly as big as the thing the browser can't do, and no bigger.**

Why the user's own token and not a bot? Because every note, vote and issue is then attributed correctly, GitHub's permissions apply (a student who isn't on the repo can't post), and we never hold anything worth stealing. The price is the anonymity caveat (R7 on the roadmap fixes it with a GitHub App installation token).

Scopes: `repo` (Discussions and Issues on private repos ride on it), `read:org`, `project`. An org admin approves the OAuth App for the org once.

### 2.5 Decision 3 — polling, not sockets

The board re-fetches the Discussion every 5 seconds while the tab is visible (`hooks/usePolling.ts`). One GraphQL query returns the Discussion, all comments and their reaction groups. GitHub's GraphQL limit is 5,000 points/hour per user; one board read costs 1. Six people × 720 reads/hour = nothing.

The design consequence is bigger than the performance one: **there is no local state to reconcile.** A mutation fires, then `refresh()` — the UI never guesses what happened. If GitHub refused the write, the next poll shows the truth. This is the simplest correct architecture and you should reach for it before anything cleverer.

### 2.6 Reading the code

Start in this order; each file is short.

1. `src/github/codec.ts` + its test — the data model.
2. `src/github/retros.ts` — every GitHub call. Notice each function is one query or one mutation; `promoteToIssue` is the only one that chains several.
3. `src/features/board/Board.tsx` — `run()` wraps every mutation with busy/error/refresh. Phases gate what each role can do.
4. `src/app/routes.ts` — hash routing (`#/r/owner/repo/42`) so a board has a link that works on Pages with no server rewrites.
5. `relay/src/index.js` + `relay/test.mjs` — the Worker, and how to test a Worker with no network by stubbing `fetch`.

Fleet conventions you've seen in Bullpen and should expect everywhere: `MainMenu` (View/Tools/Status/Links accordion), `BuildStamp` in the footer, `tokens.css`, `kvStore.ts`, `tsc -b && vite build` as the gate, CI with `app` and `relay` jobs that are required checks on `dev` and `main`.

---

## 3. GraphQL vs REST — the part that overlaps the RESTful-services lecture

Retro uses both, and the choice is instructive:

- **GraphQL for reads** because one request fetches the Discussion → comments → reaction groups tree. With REST that's 1 + N + N calls.
- **GraphQL for writes** because mutations like `addProjectV2ItemById` only exist there (Projects v2 has no REST API).
- **REST for labels** because GraphQL's `createLabel` is still behind a preview header. Real APIs are uneven; a client lives with it.

Look at `loadRetro` in `retros.ts`: the query asks for exactly the fields the board renders (`viewerCanUpdate`, `viewerHasReacted`) — the server does the permission reasoning, the client just shows buttons. Compare that to a REST client that would fetch the comment, then the reactions, then work out whether *this* user may edit.

Exercise: rewrite `listActionIssues` with REST (`GET /repos/{o}/{r}/issues?labels=retro-action`). Count the round trips to also get assignees' avatars. Then count them in the GraphQL version.

---

## 4. Workflow: how Retro itself gets built

Same GitFlow as Bullpen, because the point is that nothing about the process is special:

```
fork → feature/R8-previous-actions → PR into upstream dev
  CI: app (typecheck · vitest · build) + relay (node test.mjs) must be green
  1 approval → squash-merge → dev
sprint end: release/sprint-N from dev → QA fixes → main (tag) → back-merge to dev
main → GitHub Actions → Pages
```

Definition of Done (the PR template): PR into `dev`, CI green, one approval, `CHANGES.md` entry, Help text updated if a screen changed.

Things that are *not* in the repo on purpose: the OAuth client secret (Worker secret), `VITE_API_BASE` (repo variable), `.dev.vars` (git-ignored).

---

## 5. Discussion questions

1. The app trusts the Discussion's `author` to be the facilitator. What breaks if the Product Owner opens the retro "for" the Scrum Master? How would you fix it without a database?
2. Votes are 👍 reactions, so one per person per note. How would you implement "everyone gets 3 dots" (R10) with only GitHub as storage? What can the server enforce and what has to be a UI convention?
3. `mergedInto` keeps grouped notes as separate comments. Why not delete the duplicates? (Think about votes, and about undo.)
4. The relay accepts a `redirect_uri` and checks only that its *origin* is on the allow-list. Is that enough? What would an attacker need?
5. Polling every 5 s with 6 users is fine. At what class size does it stop being fine, and what's the *cheapest* fix (hint: not websockets)?

---

## 6. Setup checklist (for the facilitator, once per repo)

- Discussions enabled; category **Retrospectives** (open-ended).
- The OAuth App approved for the org.
- `teams.ts` has the Project number and the Status option name.
- Optional: `for-team-repos/.github/*` merged, so tagging `v0.N` opens the "Retro — Sprint N" issue with the merged-PR list.
