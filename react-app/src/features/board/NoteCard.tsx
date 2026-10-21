import { useState } from "react";
import type { RetroColumn } from "../../config/formats";
import type { Note } from "../../github/retros";
import { fmtAgo } from "../../lib/format";

interface Props {
  note: Note;
  /** Notes the facilitator grouped under this one. */
  merged: Note[];
  color: string;
  hideAuthor: boolean;
  canVote: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canMerge: boolean;
  canPromote: boolean;
  mergeTargets: Note[];
  columns: RetroColumn[];
  busy: boolean;
  onVote: (on: boolean) => void;
  onEdit: (text: string) => void;
  onMove: (column: string) => void;
  onMerge: (intoId: string) => void;
  onUnmerge: (child: Note) => void;
  onDelete: () => void;
  onPromote: () => void;
}

export function NoteCard(p: Props) {
  const { note } = p;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const votes = note.votes + p.merged.reduce((s, m) => s + m.votes, 0);

  return (
    <article className={`note${note.issue ? " note--promoted" : ""}`} style={{ borderLeftColor: p.color }}>
      {editing ? (
        <form
          className="note__edit"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && text.trim() !== note.text) p.onEdit(text);
            setEditing(false);
          }}
        >
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          <div className="note__edit-btns">
            <button type="submit" className="btn btn--ghost" disabled={p.busy}>
              Save
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="note__text">{note.text}</div>
      )}

      {p.merged.length > 0 && (
        <ul className="note__merged">
          {p.merged.map((m) => (
            <li key={m.id}>
              <span>{m.text}</span>
              {p.canMerge && (
                <button type="button" className="link-btn" onClick={() => p.onUnmerge(m)} title="Split this note back out">
                  split
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {note.issue && (
        <a className="note__issue" href={note.issue.url} target="_blank" rel="noreferrer">
          → issue #{note.issue.number} ↗
        </a>
      )}

      <footer className="note__foot">
        <span className="note__who sub">
          {p.hideAuthor ? "hidden" : note.author?.login ?? "ghost"} · {fmtAgo(note.createdAt)}
        </span>
        <span className="note__btns">
          <button
            type="button"
            className={`vote${note.viewerVoted ? " vote--on" : ""}`}
            disabled={!p.canVote || p.busy}
            title={p.canVote ? (note.viewerVoted ? "Remove your vote" : "Vote (👍 reaction on GitHub)") : "Voting opens in the Discuss phase"}
            onClick={() => p.onVote(!note.viewerVoted)}
          >
            👍 {votes}
          </button>
          {p.canPromote && (
            <button type="button" className="btn btn--promote" disabled={p.busy} onClick={p.onPromote} title="Create an issue and put it on the board">
              Promote
            </button>
          )}
          {(p.canEdit || p.canDelete || p.canMerge) && (
            <button type="button" className="kebab" aria-label="More" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              ⋯
            </button>
          )}
        </span>
      </footer>

      {menu && (
        <div className="note__menu" onMouseLeave={() => setMenu(false)}>
          {p.canEdit && (
            <button
              type="button"
              onClick={() => {
                setText(note.text);
                setEditing(true);
                setMenu(false);
              }}
            >
              Edit
            </button>
          )}
          {p.canEdit && (
            <label>
              Move to…
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) p.onMove(e.target.value);
                  setMenu(false);
                }}
              >
                <option value="">column</option>
                {p.columns
                  .filter((c) => c.key !== note.column)
                  .map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.title}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {p.canMerge && p.mergeTargets.length > 0 && (
            <label>
              Group under…
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) p.onMerge(e.target.value);
                  setMenu(false);
                }}
              >
                <option value="">note</option>
                {p.mergeTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.text.slice(0, 40)}
                    {t.text.length > 40 ? "…" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {p.canDelete && (
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (confirmDel) {
                  p.onDelete();
                  setMenu(false);
                  setConfirmDel(false);
                } else setConfirmDel(true);
              }}
            >
              {confirmDel ? "Tap again to delete" : "Delete"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
