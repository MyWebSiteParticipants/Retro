/**
 * How a retro is stored in GitHub.
 *
 *   One retro            = one Discussion in the "Retrospectives" category.
 *   The retro's settings = a JSON block in an HTML comment at the top of the
 *                          Discussion body (format, sprint, columns, phase).
 *   One sticky note      = one Discussion comment whose body starts with a
 *                          JSON block in an HTML comment (column, promoted
 *                          issue, …) followed by the note text in Markdown.
 *   One vote             = one 👍 reaction on that comment.
 *
 * The HTML comment is invisible on github.com, so a retro is perfectly
 * readable there with no app at all — the app is only a nicer view of it.
 *
 * Everything in this file is pure (no fetch) so it can be unit-tested.
 */

export type Phase = "collect" | "discuss" | "actions" | "closed";

export interface RetroMeta {
  v: 1;
  app: "retro";
  format: string;
  sprint: string;
  columns: { key: string; title: string; prompt: string; color: string }[];
  phase: Phase;
  /** When notes are hidden from others until the facilitator reveals. */
  anonymousUntilReveal: boolean;
  revealed: boolean;
  /** ISO timestamp the facilitator started the timer, if running. */
  timerEndsAt?: string;
}

export interface NoteMeta {
  v: 1;
  app: "retro";
  column: string;
  /** Set once the note is promoted to an action-item issue. */
  issue?: { number: number; url: string };
  /** Which note (comment id) this one was merged into, if any. */
  mergedInto?: string;
}

const OPEN = "<!-- retro:";
const CLOSE = "-->";

/** Serialise a header + Markdown body into one Discussion body/comment body. */
export function encode<T extends object>(meta: T, text: string): string {
  return `${OPEN}${JSON.stringify(meta)} ${CLOSE}\n${text}`;
}

/** Split a body into its header and the remaining text; undefined if it isn't ours. */
export function decode<T extends object>(body: string): { meta: T; text: string } | undefined {
  if (!body.startsWith(OPEN)) return undefined;
  const end = body.indexOf(CLOSE);
  if (end < 0) return undefined;
  const raw = body.slice(OPEN.length, end).trim();
  try {
    const meta = JSON.parse(raw) as T & { app?: string };
    if (meta.app !== "retro") return undefined;
    return { meta, text: body.slice(end + CLOSE.length).replace(/^\n/, "") };
  } catch {
    return undefined;
  }
}

/** Title of the Discussion that holds a retro. Parsed back by `parseTitle`. */
export function retroTitle(sprint: string): string {
  return `Retro — ${sprint}`;
}

export function parseTitle(title: string): string | undefined {
  const m = /^Retro — (.+)$/.exec(title.trim());
  return m?.[1];
}

/** Human-readable Markdown written under the header so the Discussion reads well on GitHub. */
export function retroBodyText(meta: RetroMeta): string {
  const cols = meta.columns.map((c) => `- **${c.title}** — ${c.prompt}`).join("\n");
  return [
    `# Sprint retrospective — ${meta.sprint}`,
    "",
    `Format: **${meta.format}**. Each comment below is one sticky note; 👍 reactions are votes.`,
    "Action items are promoted to issues labelled `retro-action` and linked from their note.",
    "",
    cols,
    "",
    "_Opened with the [Retro](https://mywebsiteparticipants.github.io/Retro/) app._",
  ].join("\n");
}
