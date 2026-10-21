import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { ACTIONS_COLUMN, type RetroColumn } from "../../config/formats";
import { TEAM_PRESETS, type TeamPreset } from "../../config/teams";
import type { Phase } from "../../github/codec";
import { addNote, deleteNote, loadRetro, setVote, updateNote, updateRetroMeta, type Note, type Retro } from "../../github/retros";
import { usePolling } from "../../hooks/usePolling";
import { fmtCountdown } from "../../lib/format";
import { PromoteDialog } from "../actions/PromoteDialog";
import { NoteCard } from "./NoteCard";

interface Props {
  repo: string;
  number: number;
}

const PHASES: { key: Phase; label: string; hint: string }[] = [
  { key: "collect", label: "1 · Collect", hint: "Everyone adds notes. Keep it quiet; no discussion yet." },
  { key: "discuss", label: "2 · Discuss", hint: "Reveal, group duplicates, vote with 👍, talk through the top ones." },
  { key: "actions", label: "3 · Actions", hint: "Pick 2–3. Promote each to an issue with an owner. It lands in next sprint's column." },
  { key: "closed", label: "4 · Closed", hint: "Read-only. Open next retro with these actions at the top." },
];

/** One retro: the sticky-note columns, facilitator bar and promote flow. */
export function Board({ repo, number }: Props) {
  const auth = useAuth();
  const team: TeamPreset = useMemo(() => TEAM_PRESETS.find((t) => t.repo === repo) ?? { repo, name: repo.split("/")[1] }, [repo]);
  const poll = usePolling(() => loadRetro(repo, number), 5_000, [repo, number]);
  const retro = poll.data;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [promote, setPromote] = useState<Note | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      await poll.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (poll.error && !retro) return <div className="banner banner--error">{poll.error}</div>;
  if (!retro) return <div className="empty">Loading retro…</div>;

  const me = auth.viewer?.login ?? "";
  const isFacilitator = retro.author === me; // whoever opened the retro
  const phase = retro.meta.phase;
  const readOnly = phase === "closed";
  const hidden = retro.meta.anonymousUntilReveal && !retro.meta.revealed;
  const columns: RetroColumn[] = [...retro.meta.columns, ACTIONS_COLUMN];
  const timerLeft = retro.meta.timerEndsAt ? new Date(retro.meta.timerEndsAt).getTime() - now : null;

  const notesIn = (col: string) =>
    retro.notes
      .filter((n) => n.column === col && !n.mergedInto)
      .sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));
  const mergedUnder = (id: string) => retro.notes.filter((n) => n.mergedInto === id);

  const submit = (col: string) => {
    const text = (drafts[col] ?? "").trim();
    if (!text) return;
    void run(`add-${col}`, async () => {
      await addNote(retro, col, text);
      setDrafts((d) => ({ ...d, [col]: "" }));
    });
  };

  return (
    <div className="board">
      <div className="board__bar">
        <div>
          <div className="sym">{retro.meta.sprint}</div>
          <div className="sub">
            {retro.meta.format} · {retro.notes.length} notes ·{" "}
            <a href={retro.url} target="_blank" rel="noreferrer">
              Discussion #{retro.number} ↗
            </a>
          </div>
        </div>
        <div className="board__phase">
          {PHASES.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`phase${phase === p.key ? " active" : ""}`}
              disabled={!isFacilitator || busy !== null}
              title={isFacilitator ? p.hint : "Only the person who opened the retro changes phases"}
              onClick={() => void run("phase", () => updateRetroMeta(retro, { phase: p.key, revealed: p.key !== "collect" ? true : retro.meta.revealed }))}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="banner banner--info board__hint">
        {PHASES.find((p) => p.key === phase)?.hint}
        {hidden && " Authors are hidden until reveal."}
        {isFacilitator && (
          <span className="board__tools">
            {hidden && (
              <button type="button" className="btn btn--ghost" onClick={() => void run("reveal", () => updateRetroMeta(retro, { revealed: true }))}>
                Reveal authors
              </button>
            )}
            {timerLeft === null || timerLeft <= 0 ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void run("timer", () => updateRetroMeta(retro, { timerEndsAt: new Date(Date.now() + 5 * 60_000).toISOString() }))}
              >
                Start 5-min timer
              </button>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => void run("timer", () => updateRetroMeta(retro, { timerEndsAt: undefined }))}>
                Stop timer
              </button>
            )}
          </span>
        )}
        {timerLeft !== null && timerLeft > 0 && <span className="timer num">{fmtCountdown(timerLeft)}</span>}
        {timerLeft !== null && timerLeft <= 0 && timerLeft > -60_000 && <span className="timer num timer--done">Time!</span>}
      </div>

      {(err || poll.error) && <div className="banner banner--error">{err ?? poll.error}</div>}

      <div className="columns" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))` }}>
        {columns.map((col) => {
          const isActions = col.key === ACTIONS_COLUMN.key;
          const notes = notesIn(col.key);
          return (
            <section key={col.key} className="column" style={{ borderTopColor: col.color }}>
              <header className="column__head">
                <h2>{col.title}</h2>
                <p className="sub">{col.prompt}</p>
              </header>

              {!readOnly && (!isActions || phase === "actions") && (
                <form
                  className="note-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(col.key);
                  }}
                >
                  <textarea
                    rows={2}
                    value={drafts[col.key] ?? ""}
                    placeholder={isActions ? "An action nobody has written a note for yet…" : "Add a note… (Enter to post, Shift+Enter for a new line)"}
                    onChange={(e) => setDrafts((d) => ({ ...d, [col.key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submit(col.key);
                      }
                    }}
                  />
                  <button type="submit" className="btn btn--ghost" disabled={busy !== null || !(drafts[col.key] ?? "").trim()}>
                    {busy === `add-${col.key}` ? "…" : "Post"}
                  </button>
                </form>
              )}

              <div className="notes">
                {notes.length === 0 && <div className="empty empty--sm">{isActions ? "Promote notes here in phase 3." : "Nothing yet."}</div>}
                {notes.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    merged={mergedUnder(n.id)}
                    color={col.color}
                    hideAuthor={hidden && n.author?.login !== me}
                    canVote={phase === "discuss" || phase === "actions"}
                    canEdit={!readOnly && n.viewerCanUpdate}
                    canDelete={!readOnly && n.viewerCanDelete}
                    canMerge={!readOnly && phase !== "collect" && isFacilitator}
                    canPromote={phase === "actions" && !isActions && !n.issue}
                    mergeTargets={notes.filter((m) => m.id !== n.id)}
                    busy={busy !== null}
                    onVote={(on) => void run(`vote-${n.id}`, () => setVote(n, on))}
                    onEdit={(text) => void run(`edit-${n.id}`, () => updateNote(n, { text }))}
                    onMove={(to) => void run(`move-${n.id}`, () => updateNote(n, { column: to }))}
                    onMerge={(into) => void run(`merge-${n.id}`, () => updateNote(n, { mergedInto: into }))}
                    onUnmerge={(child) => void run(`unmerge-${child.id}`, () => updateNote(child, { mergedInto: null }))}
                    onDelete={() => void run(`del-${n.id}`, () => deleteNote(n))}
                    onPromote={() => setPromote(n)}
                    columns={retro.meta.columns}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {promote && (
        <PromoteDialog
          team={team}
          retro={retro as Retro}
          note={promote}
          onClose={() => setPromote(null)}
          onDone={() => {
            setPromote(null);
            void poll.refresh();
          }}
        />
      )}
    </div>
  );
}
