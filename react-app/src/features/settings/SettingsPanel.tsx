import { useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { TEAM_PRESETS } from "../../config/teams";
import { beginOAuth, signInWithPat } from "../../github/auth";

interface Props {
  teamRepo: string;
  onTeamChange: (repo: string) => void;
  onBack: () => void;
}

export function SettingsPanel({ teamRepo, onTeamChange, onBack }: Props) {
  const auth = useAuth();
  const [custom, setCustom] = useState(TEAM_PRESETS.some((t) => t.repo === teamRepo) ? "" : teamRepo);
  const [pat, setPat] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const usePat = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await signInWithPat(pat);
      await auth.refresh();
      setPat("");
      setMsg("Signed in with your token.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="detail-bar">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          ‹ Back
        </button>
        <strong>Settings</strong>
        <span />
      </div>

      <div className="card">
        <h3 className="card__title">Team</h3>
        <p className="sub">Which repository holds the retros (its Discussions) and receives action items (its issues and Project).</p>
        <div className="seg">
          {TEAM_PRESETS.map((t) => (
            <button key={t.repo} type="button" className={teamRepo === t.repo ? "active" : ""} onClick={() => onTeamChange(t.repo)}>
              {t.name}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="custom-repo">Or any repository (owner/name)</label>
          <div className="inline-form inline-form--plain">
            <input id="custom-repo" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="MyWebSiteParticipants/SomeApp" />
            <button type="button" className="btn btn--ghost" disabled={!/^[^/\s]+\/[^/\s]+$/.test(custom)} onClick={() => onTeamChange(custom.trim())}>
              Use
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card__title">GitHub sign-in</h3>
        {auth.viewer ? (
          <p>
            Signed in as <strong>{auth.viewer.login}</strong>.{" "}
            <button type="button" className="btn btn--danger" onClick={() => void auth.signOut()}>
              Sign out
            </button>
          </p>
        ) : (
          <>
            <p className="sub">
              Retro reads and writes <em>your</em> GitHub account: notes are posted as you, votes are your 👍, issues are opened by you. The
              token stays in this browser.
            </p>
            <button type="button" className="btn btn--primary" onClick={beginOAuth}>
              Sign in with GitHub
            </button>
            <details className="help">
              <summary className="help__title">Use a personal access token instead</summary>
              <p className="sub">
                Fine-grained token with <code>Discussions: read/write</code>, <code>Issues: read/write</code> and <code>Metadata</code> on the
                team repositories, plus <code>Projects: read/write</code> on the organization. For dev when the relay isn't running.
              </p>
              <div className="inline-form inline-form--plain">
                <input type="password" value={pat} onChange={(e) => setPat(e.target.value)} placeholder="github_pat_…" autoComplete="off" />
                <button type="button" className="btn btn--ghost" disabled={busy || pat.length < 20} onClick={() => void usePat()}>
                  Use token
                </button>
              </div>
            </details>
          </>
        )}
        {msg && <div className="banner banner--info">{msg}</div>}
        {auth.error && <div className="banner banner--error">{auth.error}</div>}
      </div>
    </div>
  );
}
