# Retro — setup

Three one-time steps: the repo, the OAuth app + relay, and one category in
each team repo. Then every retro is "open the site, sign in, New retro".

## 1. The Retro repo (GitHub Pages)

1. Create `MyWebSiteParticipants/Retro` (public — Pages for private repos needs a paid plan).
2. Push this folder. Create a `dev` branch and make it the default; `main` deploys.
3. Settings → Pages → Source: **GitHub Actions**.
4. Settings → Rules → add the same two rulesets as Bullpen (`rulesets/` in that repo): PR + 1 approval + required checks `CI / app` and `CI / relay`.
5. First push to `main` publishes https://mywebsiteparticipants.github.io/Retro/ — the Sign in button won't work until step 2 is done, but pasting a PAT in Settings will.

## 2. GitHub OAuth App + the relay Worker

The app signs students in with their own GitHub accounts. GitHub's OAuth needs a
client secret, which cannot live in a static site, so a tiny Cloudflare Worker
does the code-for-token exchange (same Cloudflare account as `bullpen-relay`).

**OAuth App** (org-owned so it survives you): github.com → the MyWebSiteParticipants org → Settings → Developer settings → OAuth Apps → New OAuth App

| Field | Value |
|---|---|
| Application name | Retro |
| Homepage URL | `https://mywebsiteparticipants.github.io/Retro/` |
| Authorization callback URL | `https://mywebsiteparticipants.github.io/Retro/` |
| Enable Device Flow | off |

Copy the **Client ID**; generate and copy one **Client secret**.

Scopes requested at sign-in (`relay/src/index.js`): `repo` (Discussions + issues on the private team repos), `read:org`, `project` (add issues to the org Project).
An org admin must **approve the OAuth App for the org** the first time someone signs in (Organization settings → Third-party access), or Discussions in private repos will come back "not found".

**Worker** — PowerShell, from the relay folder:

```powershell
cd C:\projects\Retro\relay
npm install
npx wrangler login
npx wrangler deploy
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

`wrangler deploy` prints the URL, e.g. `https://retro-relay.<account>.workers.dev`.
Put it in the Retro repo: Settings → Secrets and variables → Actions → **Variables** → `VITE_API_BASE` = that URL. Re-run the Pages deploy (Actions → Deploy to GitHub Pages → Run workflow).

Check: open `<worker-url>/health` — `configured: true`.

## 3. Each team repo (Bullpen, WeShopAlot)

GitHub's API cannot create Discussion categories, so once per repo:

1. Settings → General → Features → tick **Discussions**.
2. Discussions tab → the pencil next to Categories → **New category**: name `Retrospectives`, format **Open-ended discussion**. Save.
3. (Optional, recommended) copy `for-team-repos/.github/*` into the repo via a PR into `dev` — the fallback retro issue form and the "open retro on tag" workflow.

That's all the app needs. The `retro-action` label is created automatically the first time an action is promoted.

**Project board:** `react-app/src/config/teams.ts` points each team at its Project (`owner` + `number` from the Project URL) and the Status option promoted issues should land in (`Sprint`). Bullpen is `MyWebSiteParticipants` / `1`. Fill in WeShopAlot's number when its board exists.

## Local development

Two terminals (PowerShell or cmd, either is fine):

```powershell
cd C:\projects\Retro\react-app
npm install
npm run dev
```

```powershell
cd C:\projects\Retro\relay
copy .dev.vars.example .dev.vars    # then paste a DEV OAuth App's id/secret into it
npm run dev
```

Vite proxies `/auth/*` to the Worker on port 8787. The dev OAuth App's callback URL is `http://localhost:5173/Retro/`. Or skip the relay entirely and paste a fine-grained PAT in the app's Settings.

Build gate before every commit (PowerShell or cmd):

```powershell
cd C:\projects\Retro\react-app
npm run build
```
