# Files to drop into each TEAM repo (Bullpen, WeShopAlot)

The Retro app needs nothing installed in a team repo — only a "Retrospectives"
Discussions category, created by hand once (see ../SETUP.md). The files here
are the *procedure* side, optional but recommended:

| File | Purpose |
|---|---|
| `.github/ISSUE_TEMPLATE/retrospective.yml` | Fallback "Retro — Sprint N" issue form for a sprint when the app is not used (Sprints 1–2), with the same four sections and the same `retro-action` convention. |
| `.github/workflows/retro-reminder.yml` | On every `v*` tag (the sprint release) opens the retro issue from that form automatically, with the sprint's merged-PR list pasted in as data for the discussion. |

Copy them into the team repo on a branch and PR into `dev` like any other change.
