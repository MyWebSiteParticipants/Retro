# Retro — roadmap

Stories are sized for one developer, one sprint, through a PR into `dev`.
Epic labels: `area:board`, `area:auth`, `area:actions`, `area:process`.

## Shipped (v0.1 — scaffold, Oct 2026)

- R1 Repo from the fleet template; hamburger menu, build stamp, Statehouse entry; Pages deploy via Actions
- R2 OAuth relay Worker (`relay/`) + sign-in flow; token in IndexedDB; PAT fallback in Settings
- R3 Pick team/sprint; create retro Discussion from a format template (SSC / 4 Ls / Sailboat)
- R4 Board: columns, add/edit/move/delete notes, 👍 as votes, polling refresh, phases, hide-until-reveal, timer, group duplicates
- R5 Promote note → issue with `retro-action` label + owner; add to Project via `addProjectV2ItemById`; set Status
- R6 History: `retro-action` issues grouped by sprint with state

## Backlog

- R7 **Real anonymity.** Post notes through a GitHub App installation token held by the relay; author kept encrypted in the note header; facilitator "Reveal" decrypts. (`area:auth`)
- R8 **Previous-actions panel on the board.** Show last sprint's open `retro-action` issues at the top of a new retro in Collect phase, with one-tap "carry over". (`area:actions`)
- R9 **Drag and drop** between columns (currently ⋯ → Move to). (`area:board`)
- R10 **Dot-vote budget.** Facilitator sets N votes per person; the board counts the viewer's 👍 and greys the button at the limit. (`area:board`)
- R11 **Export.** "Copy summary as Markdown" for pasting into the Sprint N release notes / Lab D maintenance packet. (`area:process`)
- R12 **Sprint data on the board.** Pull merged PRs, cycle time and open bugs for the sprint window as a read-only card, so the discussion starts from facts. (`area:process`)
- R13 **Multiple Projects per team** (Sprint Team A / B on WeShopAlot). (`area:actions`)
- R14 **Notification.** Post a comment on the sprint's `Retro — Sprint N` issue (from `for-team-repos`) linking the Discussion when a retro is opened. (`area:process`)
- R15 **Live updates** via a Durable Object instead of polling — only if a class ever hits rate limits. (`area:board`)
