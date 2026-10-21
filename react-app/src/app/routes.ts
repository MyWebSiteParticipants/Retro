/**
 * Hash routing, so a retro has a shareable link that works on GitHub Pages
 * (no server-side rewrites). Shapes:
 *
 *   #/                                 sessions list for the chosen team
 *   #/history                          action items across sprints
 *   #/r/<owner>/<repo>/<discussionNo>  one retro board
 */
export type View = "sessions" | "board" | "history";

export interface Route {
  view: View;
  repo?: string;
  number?: number;
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, "");
  const m = /^\/r\/([^/]+)\/([^/]+)\/(\d+)$/.exec(h);
  if (m) return { view: "board", repo: `${m[1]}/${m[2]}`, number: Number(m[3]) };
  if (h === "/history") return { view: "history" };
  return { view: "sessions" };
}

export function boardHash(repo: string, number: number): string {
  return `#/r/${repo}/${number}`;
}
