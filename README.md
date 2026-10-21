# Retro

Sprint retrospectives for GitHub teams. A sticky-note board whose storage **is
GitHub**: each retro is a Discussion in the team repo, each note a comment,
each vote a 👍, and each action item an issue on the team's Project board.
Delete the app and every retro is still readable on github.com.

Built for the CSCI 5802 Scrum teams on [Bullpen](https://github.com/MyWebSiteParticipants/Bullpen)
and [WeShopAlot](https://github.com/MyWebSiteParticipants/WeShopAlot); works
for any repo with a "Retrospectives" Discussions category.

Live: https://mywebsiteparticipants.github.io/Retro/

## How it works

```
 browser (React PWA on GitHub Pages)
   │  GraphQL + REST, user's own token
   ▼
 api.github.com ─── Discussion "Retro — Sprint N"   (settings in a hidden <!-- retro:{…} --> header)
                 ├── comment  = sticky note          (column in its hidden header)
                 ├── 👍       = vote
                 └── issue    = action item          (label retro-action → Project "Sprint" column)

 relay (Cloudflare Worker) ── only the OAuth code → token exchange; stores nothing
```

* **Sessions** — the team's retros, newest first; *New retro* picks a sprint and a format (Start/Stop/Continue, 4 Ls, Sailboat).
* **Board** — columns of notes; phases *Collect → Discuss → Actions → Closed* driven by the facilitator (whoever opened the retro); hide-authors-until-reveal; 5-minute timer; group duplicates; vote.
* **Promote** — turns a note into an issue with a verb-first title and one owner, adds it to the team Project in the configured Status column, and links it back from the note.
* **History** — every `retro-action` issue grouped by sprint with open/closed state. First agenda item of the next retro.

See [SETUP.md](SETUP.md) for the one-time setup, [docs/lecture-notes.md](docs/lecture-notes.md)
for the architecture/workflow lecture, [ROADMAP.md](ROADMAP.md) for what's next,
and `for-team-repos/` for the fallback issue-form procedure.

## Layout

```
react-app/   Vite + React 18 + TypeScript PWA (fleet conventions: hamburger menu, build stamp)
  src/github/   codec.ts (how a retro is encoded), client.ts, auth.ts, retros.ts (all GitHub calls)
  src/features/ sessions · board · actions · history · settings · help
  src/config/   teams.ts (repos + Project ids), formats.ts (column sets)
relay/       Cloudflare Worker: GitHub OAuth exchange (and nothing else)
for-team-repos/  retro issue form + "open retro on tag" workflow for Bullpen/WeShopAlot
docs/        lecture notes
```

Build gate: `cd react-app && npm run build` (`tsc -b && vite build`). Tests: `npm test` (Vitest) and `cd relay && node test.mjs`.

© 2026 Costarella Innovations, LLC. All rights reserved.
