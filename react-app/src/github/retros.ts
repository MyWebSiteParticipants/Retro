/**
 * The retro store, implemented on GitHub Discussions.
 *
 * Read side: one GraphQL query fetches the Discussion plus all its comments
 * and reaction groups, and `decode()` turns comments back into notes. The
 * board polls this every few seconds — GitHub is the only source of truth,
 * there is no local state to get out of sync.
 *
 * Write side: one mutation per user action (add/edit/delete note, vote,
 * change phase). Each returns nothing useful; the next poll shows the result.
 */
import { ACTION_LABEL, DISCUSSION_CATEGORY, type TeamPreset } from "../config/teams";
import { ACTIONS_COLUMN, type RetroFormat } from "../config/formats";
import { graphql, rest, splitRepo } from "./client";
import { decode, encode, parseTitle, retroBodyText, retroTitle, type NoteMeta, type Phase, type RetroMeta } from "./codec";

export interface RetroSummary {
  id: string;
  number: number;
  title: string;
  sprint: string;
  url: string;
  createdAt: string;
  phase: Phase;
  format: string;
  noteCount: number;
}

export interface Note {
  id: string;
  url: string;
  column: string;
  text: string;
  author: { login: string; avatarUrl: string } | null;
  createdAt: string;
  votes: number;
  viewerVoted: boolean;
  issue?: { number: number; url: string };
  mergedInto?: string;
  viewerCanUpdate: boolean;
  viewerCanDelete: boolean;
}

export interface Retro {
  id: string;
  number: number;
  url: string;
  meta: RetroMeta;
  author: string | null;
  notes: Note[];
}

interface RepoIds {
  repoId: string;
  categoryId: string;
}

const repoIdCache = new Map<string, RepoIds>();

/** Find the repository and its "Retrospectives" category. Throws a helpful error if the category is missing. */
export async function repoIds(full: string): Promise<RepoIds> {
  const hit = repoIdCache.get(full);
  if (hit) return hit;
  const { owner, name } = splitRepo(full);
  const data = await graphql<{
    repository: {
      id: string;
      hasDiscussionsEnabled: boolean;
      discussionCategories: { nodes: { id: string; name: string }[] };
    } | null;
  }>(
    `query($owner:String!,$name:String!){
      repository(owner:$owner,name:$name){
        id hasDiscussionsEnabled
        discussionCategories(first:25){ nodes{ id name } }
      }
    }`,
    { owner, name },
  );
  if (!data.repository) throw new Error(`Repository ${full} not found, or your token cannot see it.`);
  if (!data.repository.hasDiscussionsEnabled)
    throw new Error(`${full} has Discussions turned off. Settings → General → Features → Discussions.`);
  const cat = data.repository.discussionCategories.nodes.find((c) => c.name === DISCUSSION_CATEGORY);
  if (!cat)
    throw new Error(
      `${full} has no "${DISCUSSION_CATEGORY}" discussion category. Create it once (Discussions → Categories → New, format "Open-ended discussion").`,
    );
  const ids = { repoId: data.repository.id, categoryId: cat.id };
  repoIdCache.set(full, ids);
  return ids;
}

/** All retros in a repo, newest first. Only Discussions carrying our header count. */
export async function listRetros(full: string): Promise<RetroSummary[]> {
  const { owner, name } = splitRepo(full);
  const { categoryId } = await repoIds(full);
  const data = await graphql<{
    repository: {
      discussions: {
        nodes: {
          id: string;
          number: number;
          title: string;
          body: string;
          url: string;
          createdAt: string;
          comments: { totalCount: number };
        }[];
      };
    };
  }>(
    `query($owner:String!,$name:String!,$cat:ID!){
      repository(owner:$owner,name:$name){
        discussions(first:50, categoryId:$cat, orderBy:{field:CREATED_AT,direction:DESC}){
          nodes{ id number title body url createdAt comments{ totalCount } }
        }
      }
    }`,
    { owner, name, cat: categoryId },
  );
  const out: RetroSummary[] = [];
  for (const d of data.repository.discussions.nodes) {
    const parsed = decode<RetroMeta>(d.body);
    if (!parsed) continue;
    out.push({
      id: d.id,
      number: d.number,
      title: d.title,
      sprint: parsed.meta.sprint || parseTitle(d.title) || d.title,
      url: d.url,
      createdAt: d.createdAt,
      phase: parsed.meta.phase,
      format: parsed.meta.format,
      noteCount: d.comments.totalCount,
    });
  }
  return out;
}

export async function createRetro(full: string, sprint: string, format: RetroFormat, anonymous: boolean): Promise<number> {
  const { repoId, categoryId } = await repoIds(full);
  const meta: RetroMeta = {
    v: 1,
    app: "retro",
    format: format.name,
    sprint,
    columns: format.columns,
    phase: "collect",
    anonymousUntilReveal: anonymous,
    revealed: !anonymous,
  };
  const data = await graphql<{ createDiscussion: { discussion: { number: number } } }>(
    `mutation($repo:ID!,$cat:ID!,$title:String!,$body:String!){
      createDiscussion(input:{repositoryId:$repo,categoryId:$cat,title:$title,body:$body}){
        discussion{ number }
      }
    }`,
    { repo: repoId, cat: categoryId, title: retroTitle(sprint), body: encode(meta, retroBodyText(meta)) },
  );
  return data.createDiscussion.discussion.number;
}

/** Load one retro with all notes. */
export async function loadRetro(full: string, number: number): Promise<Retro> {
  const { owner, name } = splitRepo(full);
  const data = await graphql<{
    repository: {
      discussion: {
        id: string;
        number: number;
        url: string;
        body: string;
        author: { login: string } | null;
        comments: {
          nodes: {
            id: string;
            url: string;
            body: string;
            createdAt: string;
            viewerCanUpdate: boolean;
            viewerCanDelete: boolean;
            author: { login: string; avatarUrl: string } | null;
            reactionGroups: { content: string; viewerHasReacted: boolean; reactors: { totalCount: number } }[];
          }[];
        };
      } | null;
    } | null;
  }>(
    `query($owner:String!,$name:String!,$number:Int!){
      repository(owner:$owner,name:$name){
        discussion(number:$number){
          id number url body author{ login }
          comments(first:100){
            nodes{
              id url body createdAt viewerCanUpdate viewerCanDelete
              author{ login avatarUrl }
              reactionGroups{ content viewerHasReacted reactors{ totalCount } }
            }
          }
        }
      }
    }`,
    { owner, name, number },
  );
  const d = data.repository?.discussion;
  if (!d) throw new Error(`Discussion #${number} not found in ${full}, or your token cannot see it.`);
  const parsed = decode<RetroMeta>(d.body);
  if (!parsed) throw new Error(`Discussion #${number} is not a retro created by this app.`);
  const notes: Note[] = [];
  for (const c of d.comments.nodes) {
    const n = decode<NoteMeta>(c.body);
    if (!n) continue; // a plain human comment on the discussion; leave it to GitHub
    const up = c.reactionGroups.find((g) => g.content === "THUMBS_UP");
    notes.push({
      id: c.id,
      url: c.url,
      column: n.meta.column,
      text: n.text,
      author: c.author,
      createdAt: c.createdAt,
      votes: up?.reactors.totalCount ?? 0,
      viewerVoted: up?.viewerHasReacted ?? false,
      issue: n.meta.issue,
      mergedInto: n.meta.mergedInto,
      viewerCanUpdate: c.viewerCanUpdate,
      viewerCanDelete: c.viewerCanDelete,
    });
  }
  return { id: d.id, number: d.number, url: d.url, meta: parsed.meta, author: d.author?.login ?? null, notes };
}

export async function updateRetroMeta(retro: Retro, patch: Partial<RetroMeta>): Promise<void> {
  const meta: RetroMeta = { ...retro.meta, ...patch };
  await graphql(
    `mutation($id:ID!,$body:String!){ updateDiscussion(input:{discussionId:$id,body:$body}){ discussion{ id } } }`,
    { id: retro.id, body: encode(meta, retroBodyText(meta)) },
  );
}

export async function addNote(retro: Retro, column: string, text: string): Promise<void> {
  const meta: NoteMeta = { v: 1, app: "retro", column };
  await graphql(
    `mutation($id:ID!,$body:String!){ addDiscussionComment(input:{discussionId:$id,body:$body}){ comment{ id } } }`,
    { id: retro.id, body: encode(meta, text.trim()) },
  );
}

export async function updateNote(note: Note, patch: { text?: string; column?: string; issue?: NoteMeta["issue"]; mergedInto?: string | null }): Promise<void> {
  const meta: NoteMeta = { v: 1, app: "retro", column: patch.column ?? note.column };
  const issue = patch.issue ?? note.issue;
  if (issue) meta.issue = issue;
  const merged = patch.mergedInto === undefined ? note.mergedInto : patch.mergedInto ?? undefined;
  if (merged) meta.mergedInto = merged;
  await graphql(
    `mutation($id:ID!,$body:String!){ updateDiscussionComment(input:{commentId:$id,body:$body}){ comment{ id } } }`,
    { id: note.id, body: encode(meta, (patch.text ?? note.text).trim()) },
  );
}

export async function deleteNote(note: Note): Promise<void> {
  await graphql(`mutation($id:ID!){ deleteDiscussionComment(input:{id:$id}){ clientMutationId } }`, { id: note.id });
}

export async function setVote(note: Note, on: boolean): Promise<void> {
  const m = on
    ? `mutation($id:ID!){ addReaction(input:{subjectId:$id,content:THUMBS_UP}){ clientMutationId } }`
    : `mutation($id:ID!){ removeReaction(input:{subjectId:$id,content:THUMBS_UP}){ clientMutationId } }`;
  await graphql(m, { id: note.id });
}

/* ───────────────────────── Action items → issues → Project ───────────────────────── */

export interface Assignee {
  id: string;
  login: string;
  avatarUrl: string;
}

export async function assignableUsers(full: string): Promise<Assignee[]> {
  const { owner, name } = splitRepo(full);
  const data = await graphql<{ repository: { assignableUsers: { nodes: Assignee[] } } }>(
    `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ assignableUsers(first:50){ nodes{ id login avatarUrl } } } }`,
    { owner, name },
  );
  return data.repository.assignableUsers.nodes;
}

/** Make sure the retro-action label exists (REST; GraphQL createLabel is still preview-gated). */
async function ensureLabel(full: string): Promise<string> {
  const { owner, name } = splitRepo(full);
  try {
    const label = await rest<{ node_id: string }>("GET", `/repos/${owner}/${name}/labels/${encodeURIComponent(ACTION_LABEL.name)}`);
    return label.node_id;
  } catch {
    const label = await rest<{ node_id: string }>("POST", `/repos/${owner}/${name}/labels`, ACTION_LABEL);
    return label.node_id;
  }
}

interface ProjectInfo {
  id: string;
  statusFieldId?: string;
  statusOptionId?: string;
}

async function projectInfo(team: TeamPreset): Promise<ProjectInfo | undefined> {
  if (!team.project) return undefined;
  const q = (kind: "organization" | "user") => `query($login:String!,$n:Int!){
    ${kind}(login:$login){ projectV2(number:$n){ id fields(first:40){ nodes{ ... on ProjectV2SingleSelectField { id name options{ id name } } } } } }
  }`;
  type Field = { id: string; name: string; options: { id: string; name: string }[] };
  type Project = { id: string; fields: { nodes: (Field | Record<string, never>)[] } };
  type R = { organization?: { projectV2: Project | null } | null; user?: { projectV2: Project | null } | null };
  let proj: Project | null = null;
  try {
    const d = await graphql<R>(q("organization"), { login: team.project.owner, n: team.project.number });
    proj = d.organization?.projectV2 ?? null;
  } catch {
    const d = await graphql<R>(q("user"), { login: team.project.owner, n: team.project.number });
    proj = d.user?.projectV2 ?? null;
  }
  if (!proj) return undefined;
  const status = proj.fields.nodes.find((f): f is Field => "name" in f && f.name === "Status");
  const opt = status?.options.find((o) => o.name.toLowerCase() === (team.projectStatus ?? "").toLowerCase());
  return { id: proj.id, statusFieldId: status?.id, statusOptionId: opt?.id };
}

export interface PromoteResult {
  number: number;
  url: string;
  onProject: boolean;
}

/**
 * Turn a note into an action-item issue: create the issue (label + assignee),
 * add it to the team's Project in the configured Status column, then write
 * the issue link back into the note's header so the board shows it.
 */
export async function promoteToIssue(team: TeamPreset, retro: Retro, note: Note, title: string, assigneeIds: string[]): Promise<PromoteResult> {
  const { repoId } = await repoIds(team.repo);
  const labelId = await ensureLabel(team.repo);
  const body = [
    `<!-- retro:${JSON.stringify({ v: 1, app: "retro", sprint: retro.meta.sprint, discussion: retro.number, note: note.id })} -->`,
    `**Action item from the ${retro.meta.sprint} retrospective.**`,
    "",
    note.text,
    "",
    `Source: ${note.url}`,
  ].join("\n");
  const created = await graphql<{ createIssue: { issue: { id: string; number: number; url: string } } }>(
    `mutation($repo:ID!,$title:String!,$body:String!,$labels:[ID!],$assignees:[ID!]){
      createIssue(input:{repositoryId:$repo,title:$title,body:$body,labelIds:$labels,assigneeIds:$assignees}){ issue{ id number url } }
    }`,
    { repo: repoId, title, body, labels: [labelId], assignees: assigneeIds },
  );
  const issue = created.createIssue.issue;

  let onProject = false;
  const proj = await projectInfo(team).catch(() => undefined);
  if (proj) {
    const added = await graphql<{ addProjectV2ItemById: { item: { id: string } } }>(
      `mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item{ id } } }`,
      { p: proj.id, c: issue.id },
    );
    onProject = true;
    if (proj.statusFieldId && proj.statusOptionId) {
      await graphql(
        `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){
          updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ projectV2Item{ id } }
        }`,
        { p: proj.id, i: added.addProjectV2ItemById.item.id, f: proj.statusFieldId, o: proj.statusOptionId },
      ).catch(() => undefined);
    }
  }

  await updateNote(note, { column: ACTIONS_COLUMN.key, issue: { number: issue.number, url: issue.url } });
  return { number: issue.number, url: issue.url, onProject };
}

export interface ActionIssue {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED";
  closedAt: string | null;
  createdAt: string;
  sprint?: string;
  assignees: { login: string; avatarUrl: string }[];
}

/** Every retro-action issue in the repo, newest first, with the sprint it came from. */
export async function listActionIssues(full: string): Promise<ActionIssue[]> {
  const { owner, name } = splitRepo(full);
  const data = await graphql<{
    repository: {
      issues: {
        nodes: {
          number: number;
          title: string;
          url: string;
          body: string;
          state: "OPEN" | "CLOSED";
          closedAt: string | null;
          createdAt: string;
          assignees: { nodes: { login: string; avatarUrl: string }[] };
        }[];
      };
    };
  }>(
    `query($owner:String!,$name:String!,$label:[String!]){
      repository(owner:$owner,name:$name){
        issues(first:100, labels:$label, orderBy:{field:CREATED_AT,direction:DESC}){
          nodes{ number title url body state closedAt createdAt assignees(first:5){ nodes{ login avatarUrl } } }
        }
      }
    }`,
    { owner, name, label: [ACTION_LABEL.name] },
  );
  return data.repository.issues.nodes.map((i) => {
    const m = /^<!-- retro:(\{.*?\}) -->/.exec(i.body);
    let sprint: string | undefined;
    if (m) {
      try {
        sprint = (JSON.parse(m[1]) as { sprint?: string }).sprint;
      } catch {
        /* not ours */
      }
    }
    return { ...i, sprint, assignees: i.assignees.nodes };
  });
}
