interface Props {
  onClose: () => void;
}

/** Side drawer: how a retro runs, and how the app stores things. */
export function HelpPanel({ onClose }: Props) {
  return (
    <aside className="help-panel" aria-label="Help">
      <div className="detail-bar">
        <strong>Help</strong>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <details className="help" open>
        <summary className="help__title">How a retro runs (30–45 min)</summary>
        <ol>
          <li>
            <strong>Previous actions (5 min).</strong> Open <em>History</em>. For each of last sprint's items: done, dropped, or carried?
          </li>
          <li>
            <strong>Collect (8 min, timer).</strong> Everyone writes notes in silence. One thought per note. Authors hidden if the facilitator
            chose that.
          </li>
          <li>
            <strong>Discuss (15 min).</strong> Facilitator reveals, groups duplicates (⋯ → Group under), everyone votes 👍. Talk through the top
            three.
          </li>
          <li>
            <strong>Actions (10 min).</strong> Pick 2–3 notes. <em>Promote</em> each: verb-first title, one owner. It becomes an issue on the
            team board in the next sprint's column.
          </li>
          <li>
            <strong>Close.</strong> Phase 4 locks the board. The Discussion stays on GitHub forever.
          </li>
        </ol>
      </details>

      <details className="help">
        <summary className="help__title">Roles</summary>
        <p>
          The person who opens the retro is its <strong>facilitator</strong> (usually the Scrum Master). Only they change phases, reveal
          authors, run the timer and group notes. Everyone adds notes, votes, edits and deletes their own.
        </p>
      </details>

      <details className="help">
        <summary className="help__title">Where is the data?</summary>
        <p>
          On GitHub, and nowhere else. A retro is a <strong>Discussion</strong> in the team repo's "Retrospectives" category; each note is a
          comment; each vote is a 👍 reaction; each action item is an <strong>issue</strong> labelled <code>retro-action</code>. This app is a
          view over that. If the app vanished tomorrow, every retro would still be readable on github.com.
        </p>
      </details>

      <details className="help">
        <summary className="help__title">First-time setup for a team repo</summary>
        <ol>
          <li>Settings → General → Features → turn on Discussions.</li>
          <li>Discussions → Categories → New: name "Retrospectives", format "Open-ended discussion".</li>
          <li>(Optional) in <code>src/config/teams.ts</code> point the team at its Project number and Status column.</li>
        </ol>
      </details>

      <details className="help">
        <summary className="help__title">Why does GitHub show who wrote my "anonymous" note?</summary>
        <p>
          Because comments on GitHub always have an author. "Hide authors" only hides them on this board until reveal, which is enough to
          keep the collecting phase quiet. True anonymity would need the app to post through its own bot account — see the roadmap.
        </p>
      </details>
    </aside>
  );
}
