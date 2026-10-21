/**
 * The teams this Retro instance knows about. Each is a GitHub repository whose
 * Discussions hold the retros and whose Project board receives action items.
 *
 * Adding a team is a one-line change here (or the user can type any
 * owner/repo in the Sessions screen; these are just the quick picks).
 */
export interface TeamPreset {
  /** owner/repo of the repository that stores the retros. */
  repo: string;
  /** Short display name. */
  name: string;
  /**
   * Project to put promoted action items on. `owner` is the org or user that
   * owns the Project, `number` is from its URL (…/projects/<number>).
   * Optional: without it, actions become plain issues.
   */
  project?: { owner: string; number: number };
  /** Status field value the action item should land in (e.g. "Sprint"). */
  projectStatus?: string;
}

export const TEAM_PRESETS: TeamPreset[] = [
  {
    repo: "MyWebSiteParticipants/Bullpen",
    name: "Bullpen",
    project: { owner: "MyWebSiteParticipants", number: 1 },
    projectStatus: "Sprint",
  },
  {
    repo: "MyWebSiteParticipants/WeShopAlot",
    name: "WeShopAlot",
    // Set the WeShopAlot board's project number once it exists in the org.
    projectStatus: "Sprint",
  },
];

/** Label applied to every issue promoted from a retro. Created on first use if missing. */
export const ACTION_LABEL = { name: "retro-action", color: "D4A017", description: "Action item agreed in a sprint retrospective" };

/** Discussions category that stores retros. Created by hand once per repo (GitHub API cannot create categories). */
export const DISCUSSION_CATEGORY = "Retrospectives";
