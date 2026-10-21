/**
 * Retrospective formats. A format is just a named list of columns; the board
 * renders whatever columns the retro's Discussion header says it has, so old
 * retros keep rendering even if a format changes here later.
 */
export interface RetroColumn {
  /** Stable key stored on every note (never shown). */
  key: string;
  /** Column heading. */
  title: string;
  /** One-line prompt under the heading. */
  prompt: string;
  /** Accent colour for the column's notes. */
  color: string;
}

export interface RetroFormat {
  key: string;
  name: string;
  blurb: string;
  columns: RetroColumn[];
}

export const FORMATS: RetroFormat[] = [
  {
    key: "ssc",
    name: "Start / Stop / Continue",
    blurb: "The classic. Fast, concrete, and it produces actions almost by itself.",
    columns: [
      { key: "start", title: "Start", prompt: "What should we begin doing?", color: "#22c55e" },
      { key: "stop", title: "Stop", prompt: "What should we quit doing?", color: "#ef4444" },
      { key: "continue", title: "Continue", prompt: "What is working and must stay?", color: "#38bdf8" },
    ],
  },
  {
    key: "4ls",
    name: "4 Ls",
    blurb: "Liked / Learned / Lacked / Longed for. Good when the sprint had a lot of new ground.",
    columns: [
      { key: "liked", title: "Liked", prompt: "What went well?", color: "#22c55e" },
      { key: "learned", title: "Learned", prompt: "What did we find out?", color: "#38bdf8" },
      { key: "lacked", title: "Lacked", prompt: "What was missing?", color: "#f59e0b" },
      { key: "longed", title: "Longed for", prompt: "What do we wish we had?", color: "#a78bfa" },
    ],
  },
  {
    key: "sailboat",
    name: "Sailboat",
    blurb: "Wind pushes us on, anchors hold us back, rocks are risks ahead, the island is the goal.",
    columns: [
      { key: "wind", title: "Wind", prompt: "What pushed us forward?", color: "#22c55e" },
      { key: "anchor", title: "Anchors", prompt: "What slowed us down?", color: "#ef4444" },
      { key: "rocks", title: "Rocks", prompt: "What risks are ahead?", color: "#f59e0b" },
      { key: "island", title: "Island", prompt: "Where are we trying to get to?", color: "#38bdf8" },
    ],
  },
];

export const ACTIONS_COLUMN: RetroColumn = {
  key: "action",
  title: "Action items",
  prompt: "Few, owned, and on the next sprint's board.",
  color: "#d4a017",
};

export function formatByKey(key: string): RetroFormat | undefined {
  return FORMATS.find((f) => f.key === key);
}
