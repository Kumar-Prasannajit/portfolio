// GitHub REST calls for the one repo, with the token injected, and no decisions
// (those live in lib/telegramBot.ts and lib/telegramNotify.ts). Errors carry the
// method, path and status only, never the token or a response body.

import { isDraftPr, type PrInfo } from "./draftPost.ts";

export const REPO = "Kumar-Prasannajit/portfolio";

export type GitHubRepo = {
  getPr(n: number): Promise<PrInfo>;
  prFiles(n: number): Promise<{ filename: string; status: string }[]>;
  fileAt(path: string, ref: string): Promise<string>;
  commitMessage(sha: string): Promise<string>;
  checks(sha: string): Promise<{
    runs: { name: string; conclusion: string | null }[];
    statuses: { context: string; state: string }[];
  }>;
  commitFiles(
    branch: string,
    files: { path: string; content: Uint8Array | string }[],
    message: string,
  ): Promise<string | null>; // new sha, or null when the tree is unchanged
  merge(n: number): Promise<void>; // merge_method "merge"
  close(n: number): Promise<void>;
  deleteBranch(branch: string): Promise<void>; // 404/422 (already gone) counts as success
  comment(n: number, body: string): Promise<void>;
  listOpenDrafts(): Promise<PrInfo[]>; // open PRs passing isDraftPr
  prsForSha(sha: string): Promise<number[]>;
  previewUrl(sha: string): Promise<string | null>; // newest Preview deployment's environment_url
  issue(n: number): Promise<{ title: string; body: string }>;
  closeIssue(n: number): Promise<void>;
};

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function toPr(j: Json): PrInfo {
  const merged = j.merged === true || (j.merged === undefined && j.merged_at != null);
  return {
    number: j.number,
    state: j.state === "open" ? "open" : "closed",
    merged,
    labels: (j.labels ?? []).map((l: Json) => l.name),
    head: j.head.ref,
    headSha: j.head.sha,
    body: j.body ?? "",
    createdAt: j.created_at,
    // On an open PR GitHub's merge_commit_sha is a throwaway test merge.
    mergeSha: merged ? (j.merge_commit_sha ?? null) : null,
  };
}

export function githubRepo(token: string, fetchImpl: typeof fetch = fetch): GitHubRepo {
  const base = `https://api.github.com/repos/${REPO}`;

  async function send(method: string, path: string, body?: unknown, accept = "application/vnd.github+json") {
    return fetchImpl(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept,
        "x-github-api-version": "2022-11-28",
        "user-agent": "portfolio-telegram-bot",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  const fail = (method: string, path: string, res: Response) =>
    new Error(`GitHub ${method} ${path} → ${res.status}`);

  async function api(method: string, path: string, body?: unknown): Promise<Json> {
    const res = await send(method, path, body);
    if (!res.ok) throw fail(method, path, res);
    return res.status === 204 ? {} : ((await res.json()) as Json);
  }

  const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");
  const b64 = (c: Uint8Array | string) => Buffer.from(c).toString("base64");

  return {
    async getPr(n) {
      return toPr(await api("GET", `/pulls/${n}`));
    },

    async prFiles(n) {
      const files = (await api("GET", `/pulls/${n}/files?per_page=100`)) as unknown as Json[];
      return files.map((f) => ({ filename: f.filename, status: f.status }));
    },

    async fileAt(path, ref) {
      const url = `/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
      const res = await send("GET", url, undefined, "application/vnd.github.raw+json");
      if (!res.ok) throw fail("GET", url, res);
      return res.text();
    },

    async commitMessage(sha) {
      return (await api("GET", `/git/commits/${sha}`)).message;
    },

    async checks(sha) {
      const runs = await api("GET", `/commits/${sha}/check-runs?per_page=100`);
      const status = await api("GET", `/commits/${sha}/status`);
      return {
        runs: (runs.check_runs ?? []).map((r: Json) => ({ name: r.name, conclusion: r.conclusion ?? null })),
        statuses: (status.statuses ?? []).map((s: Json) => ({ context: s.context, state: s.state })),
      };
    },

    async commitFiles(branch, files, message) {
      const head: string = (await api("GET", `/git/ref/heads/${branch}`)).object.sha;
      const baseTree: string = (await api("GET", `/git/commits/${head}`)).tree.sha;
      const entries = [];
      for (const file of files) {
        const blob = await api("POST", "/git/blobs", { content: b64(file.content), encoding: "base64" });
        entries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
      }
      const tree: string = (await api("POST", "/git/trees", { base_tree: baseTree, tree: entries })).sha;
      if (tree === baseTree) return null; // nothing changed: Telegram redelivered the same photo
      const commit: string = (await api("POST", "/git/commits", { message, tree, parents: [head] })).sha;
      await api("PATCH", `/git/refs/heads/${branch}`, { sha: commit, force: false });
      return commit;
    },

    async merge(n) {
      await api("PUT", `/pulls/${n}/merge`, { merge_method: "merge" });
    },

    async close(n) {
      await api("PATCH", `/pulls/${n}`, { state: "closed" });
    },

    async deleteBranch(branch) {
      const path = `/git/refs/heads/${branch}`;
      const res = await send("DELETE", path);
      if (!res.ok && res.status !== 404 && res.status !== 422) throw fail("DELETE", path, res);
    },

    async comment(n, body) {
      await api("POST", `/issues/${n}/comments`, { body });
    },

    async listOpenDrafts() {
      const pulls = (await api("GET", "/pulls?state=open&per_page=100")) as unknown as Json[];
      return pulls.map(toPr).filter(isDraftPr);
    },

    async prsForSha(sha) {
      const pulls = (await api("GET", `/commits/${sha}/pulls`)) as unknown as Json[];
      return pulls.map((p) => p.number);
    },

    async previewUrl(sha) {
      const deployments = (await api("GET", `/deployments?sha=${sha}&per_page=20`)) as unknown as Json[];
      // Newest first. Vercel names the environment "Preview" (older setups "Preview – <project>").
      const preview = deployments.find((d) => String(d.environment).startsWith("Preview"));
      if (!preview) return null;
      const statuses = (await api("GET", `/deployments/${preview.id}/statuses?per_page=1`)) as unknown as Json[];
      return statuses[0]?.environment_url || null;
    },

    async issue(n) {
      const issue = await api("GET", `/issues/${n}`);
      return { title: issue.title, body: issue.body ?? "" };
    },

    async closeIssue(n) {
      await api("PATCH", `/issues/${n}`, { state: "closed" });
    },
  };
}
