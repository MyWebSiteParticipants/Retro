import { useEffect, useState } from "react";
import type { TeamPreset } from "../../config/teams";
import { assignableUsers, promoteToIssue, type Assignee, type Note, type PromoteResult, type Retro } from "../../github/retros";

interface Props {
  team: TeamPreset;
  retro: Retro;
  note: Note;
  onClose: () => void;
  onDone: (r: PromoteResult) => void;
}

/**
 * "Promote to issue": title + owner, then one click creates the issue, labels
 * it retro-action, adds it to the team Project in the configured Status
 * column and links it from the note.
 */
export function PromoteDialog({ team, retro, note, onClose, onDone }: Props) {
  const [title, setTitle] = useState(firstLine(note.text));
  const [people, setPeople] = useState<Assignee[]>([]);
  const [owner, setOwner] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<PromoteResult | null>(null);

  useEffect(() => {
    assignableUsers(team.repo)
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [team.repo]);

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await promoteToIssue(team, retro, note, title.trim(), owner ? [owner] : []);
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="promote-title" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        {result ? (
          <>
            <h3 id="promote-title">Action item created</h3>
            <p>
              <a href={result.url} target="_blank" rel="noreferrer">
                Issue #{result.number} ↗
              </a>{" "}
              {result.onProject ? `is on the ${team.name} board in "${team.projectStatus ?? "the first"}" column.` : "was created (no Project configured for this team)."}
            </p>
            <button type="button" className="btn btn--primary" onClick={() => onDone(result)}>
              Done
            </button>
          </>
        ) : (
          <>
            <h3 id="promote-title">Promote to action item</h3>
            <blockquote className="sub">{note.text}</blockquote>
            <div className="field">
              <label htmlFor="issue-title">Issue title</label>
              <input id="issue-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <span className="field-hint">Start with a verb. "Add a PR checklist to the template", not "PR reviews".</span>
            </div>
            <div className="field">
              <label htmlFor="issue-owner">Owner</label>
              <select id="issue-owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">— unassigned (please don't) —</option>
                {people.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.login}
                  </option>
                ))}
              </select>
            </div>
            <p className="field-hint">
              Creates an issue in <code>{team.repo}</code> labelled <code>retro-action</code>
              {team.project ? `, adds it to Project #${team.project.number} in "${team.projectStatus}"` : ""}, and links it from this note.
            </p>
            {err && <div className="banner banner--error">{err}</div>}
            <div className="modal__btns">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={() => void go()} disabled={busy || !title.trim()}>
                {busy ? "Creating…" : "Create issue"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function firstLine(s: string): string {
  const line = s.split("\n").find((l) => l.trim()) ?? "";
  return line.replace(/^[-*]\s*/, "").slice(0, 80);
}
