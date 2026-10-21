import { useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { boardHash } from "../../app/routes";
import { FORMATS } from "../../config/formats";
import { beginOAuth } from "../../github/auth";
import { createRetro, listRetros } from "../../github/retros";
import { usePolling } from "../../hooks/usePolling";
import { fmtDate } from "../../lib/format";

interface Props {
  teamRepo: string;
}

const PHASE_LABEL: Record<string, string> = {
  collect: "Collecting notes",
  discuss: "Discussing",
  actions: "Choosing actions",
  closed: "Closed",
};

/** List of retros for the team, plus the "New retro" form. */
export function Sessions({ teamRepo }: Props) {
  const auth = useAuth();
  const signedIn = !!auth.viewer;
  const list = usePolling(() => (signedIn ? listRetros(teamRepo) : Promise.resolve([])), 30_000, [teamRepo, signedIn]);

  const [creating, setCreating] = useState(false);
  const [sprint, setSprint] = useState("");
  const [format, setFormat] = useState(FORMATS[0].key);
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    const f = FORMATS.find((x) => x.key === format)!;
    setBusy(true);
    setErr(null);
    try {
      const n = await createRetro(teamRepo, sprint.trim(), f, anonymous);
      location.hash = boardHash(teamRepo, n);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (auth.viewer === undefined) return <div className="empty">Checking sign-in…</div>;
  if (!signedIn)
    return (
      <div className="card">
        <h3 className="card__title">Sign in to see {teamRepo}'s retros</h3>
        <p className="sub">Retro stores every retrospective as a GitHub Discussion in the team repository, so it needs your GitHub account.</p>
        <button type="button" className="btn btn--primary" onClick={beginOAuth}>
          Sign in with GitHub
        </button>
        {auth.error && <div className="banner banner--error" style={{ marginTop: 12 }}>{auth.error}</div>}
      </div>
    );

  return (
    <div>
      <div className="card">
        <h3 className="card__title">
          <span>Retrospectives · {teamRepo}</span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              if (!creating && !sprint) setSprint(suggestSprint(list.data?.map((r) => r.sprint) ?? []));
              setCreating((c) => !c);
            }}
          >
            {creating ? "Cancel" : "+ New retro"}
          </button>
        </h3>

        {creating && (
          <div className="new-retro">
            <div className="field">
              <label htmlFor="sprint">Sprint</label>
              <input id="sprint" value={sprint} onChange={(e) => setSprint(e.target.value)} placeholder="Sprint 3" />
            </div>
            <div className="field">
              <label>Format</label>
              <div className="format-grid">
                {FORMATS.map((f) => (
                  <button key={f.key} type="button" className={`format-card${format === f.key ? " active" : ""}`} onClick={() => setFormat(f.key)}>
                    <strong>{f.name}</strong>
                    <span className="sub">{f.blurb}</span>
                    <span className="format-cols">
                      {f.columns.map((c) => (
                        <span key={c.key} className="dot" style={{ background: c.color }} title={c.title} />
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
              Hide authors on the board until the facilitator reveals
            </label>
            <p className="field-hint">
              Note: GitHub still shows who wrote each comment on github.com; "hide" only applies to this board. Honest attribution is a feature in
              a graded class.
            </p>
            <button type="button" className="btn btn--primary" disabled={busy || !sprint.trim()} onClick={() => void create()}>
              {busy ? "Creating…" : `Open ${sprint.trim() || "retro"} on GitHub`}
            </button>
            {err && <div className="banner banner--error">{err}</div>}
          </div>
        )}
      </div>

      {list.error && <div className="banner banner--error">{list.error}</div>}
      {list.loading && !list.data && <div className="empty">Loading retros…</div>}
      {list.data && list.data.length === 0 && !list.error && <div className="empty">No retros yet. The first one is one tap away.</div>}
      {list.data?.map((r) => (
        <a key={r.id} className="card row--tap session" href={boardHash(teamRepo, r.number)}>
          <div>
            <div className="sym">{r.sprint}</div>
            <div className="sub">
              {r.format} · {r.noteCount} notes · opened {fmtDate(r.createdAt)}
            </div>
          </div>
          <span className={`pill ${r.phase === "closed" ? "pill--muted" : "pill--ok"}`}>{PHASE_LABEL[r.phase] ?? r.phase}</span>
        </a>
      ))}
    </div>
  );
}

/** "Sprint 3" → "Sprint 4"; falls back to "Sprint 1". */
function suggestSprint(existing: string[]): string {
  let max = 0;
  for (const s of existing) {
    const m = /(\d+)/.exec(s);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Sprint ${max + 1}`;
}
