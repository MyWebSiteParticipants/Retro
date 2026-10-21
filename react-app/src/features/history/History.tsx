import { useAuth } from "../../app/AuthContext";
import { beginOAuth } from "../../github/auth";
import { listActionIssues, type ActionIssue } from "../../github/retros";
import { usePolling } from "../../hooks/usePolling";
import { fmtDate } from "../../lib/format";

interface Props {
  teamRepo: string;
  /** When set, only this sprint's predecessors are emphasised (used at the top of a board). */
  compact?: boolean;
}

/**
 * Every retro-action issue in the team repo, grouped by the sprint whose
 * retro created it. The first agenda item of a retro is this list: did we do
 * what we said last time?
 */
export function History({ teamRepo, compact }: Props) {
  const auth = useAuth();
  const signedIn = !!auth.viewer;
  const poll = usePolling(() => (signedIn ? listActionIssues(teamRepo) : Promise.resolve([])), 30_000, [teamRepo, signedIn]);

  if (!signedIn)
    return (
      <div className="card">
        <p className="sub">Sign in to see action items.</p>
        <button type="button" className="btn btn--primary" onClick={beginOAuth}>
          Sign in with GitHub
        </button>
      </div>
    );
  if (poll.error) return <div className="banner banner--error">{poll.error}</div>;
  if (!poll.data) return <div className="empty">Loading action items…</div>;

  const groups = new Map<string, ActionIssue[]>();
  for (const i of poll.data) {
    const k = i.sprint ?? "Unlabelled";
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  const open = poll.data.filter((i) => i.state === "OPEN").length;
  const done = poll.data.length - open;

  return (
    <div className={compact ? "history history--compact" : "history"}>
      {!compact && (
        <div className="card">
          <h3 className="card__title">Action items · {teamRepo}</h3>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat__label">Open</div>
              <div className="stat__value">{open}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Done</div>
              <div className="stat__value">{done}</div>
            </div>
          </div>
          <p className="sub" style={{ marginTop: 8 }}>
            Issues labelled <code>retro-action</code>. Closing the issue is how an action gets marked done — there is no second checklist.
          </p>
        </div>
      )}
      {groups.size === 0 && <div className="empty">No action items yet.</div>}
      {[...groups.entries()].map(([sprint, issues]) => (
        <div key={sprint} className="card">
          <h3 className="card__title">
            <span>{sprint}</span>
            <span className="sub">
              {issues.filter((i) => i.state === "CLOSED").length}/{issues.length} done
            </span>
          </h3>
          {issues.map((i) => (
            <a key={i.number} className="row row--tap" href={i.url} target="_blank" rel="noreferrer">
              <span className={`state state--${i.state.toLowerCase()}`} aria-label={i.state} />
              <span className="row__main">
                <span>{i.title}</span>
                <span className="sub">
                  #{i.number} · {i.assignees.map((a) => a.login).join(", ") || "unassigned"} ·{" "}
                  {i.state === "CLOSED" && i.closedAt ? `closed ${fmtDate(i.closedAt)}` : `opened ${fmtDate(i.createdAt)}`}
                </span>
              </span>
            </a>
          ))}
        </div>
      ))}
    </div>
  );
}
