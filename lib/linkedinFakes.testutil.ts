// Fakes shared by the LinkedIn tests: an in-memory store, a recording LinkedIn API,
// a recording Telegram and a GitHub that serves a few PRs and files. Test code only;
// the name keeps it out of the `lib/*.test.ts` glob.

import type { PrInfo } from "./draftPost.ts";
import type { GitHubRepo } from "./githubWrite.ts";
import type { LinkedInApi } from "./linkedinApi.ts";
import type { LinkedInStore, PostedRecord, TokenRecord } from "./linkedinStore.ts";
import type { TelegramApi } from "./telegramApi.ts";

export const NOW = new Date("2026-10-30T10:00:00Z");
export const TOKEN_RECORD: TokenRecord = {
  accessToken: "at-secret", expiresAt: "2026-12-28T10:00:00.000Z", personUrn: "urn:li:person:abc",
};

const unexpected = async (): Promise<never> => { throw new Error("unexpected"); };

export function memoryStore(token: TokenRecord | null = TOKEN_RECORD) {
  const state = { token, posted: new Map<string, PostedRecord>(), states: new Set<string>(), made: 0 };
  const store: LinkedInStore = {
    getToken: async () => state.token,
    setToken: async (t) => { state.token = t; },
    getPosted: async (key) => state.posted.get(key) ?? null,
    setPosted: async (key, r) => { state.posted.set(key, r); },
    createState: async () => {
      state.made += 1;
      const s = String(state.made).padStart(32, "0");
      state.states.add(s);
      return s;
    },
    hasState: async (s) => state.states.has(s),
    burnState: async (s) => state.states.delete(s),
  };
  return { store, state };
}

export type FakeApiOptions = {
  sub?: string;
  expiresIn?: number;
  exchangeFails?: Error;
  createFails?: Record<number, Error>; // by 1-based createPost call
};

export function fakeApi(opts: FakeApiOptions = {}) {
  const calls: { name: string; arg?: unknown }[] = [];
  let created = 0;
  const api: LinkedInApi = {
    authorizeUrl: (state) => `https://www.linkedin.com/oauth/v2/authorization?state=${state}`,
    exchangeCode: async (code) => {
      calls.push({ name: "exchangeCode", arg: code });
      if (opts.exchangeFails) throw opts.exchangeFails;
      return { accessToken: "new-token", expiresIn: opts.expiresIn ?? 5_184_000 };
    },
    memberId: async () => opts.sub ?? "abc",
    uploadImage: async (arg) => { calls.push({ name: "uploadImage", arg }); return "urn:li:image:I1"; },
    createPost: async (arg) => {
      created += 1;
      calls.push({ name: "createPost", arg });
      const fail = opts.createFails?.[created];
      if (fail) throw fail;
      return `urn:li:share:${created}`;
    },
  };
  return { api, calls, created: () => created };
}

export function fakeTelegram() {
  const sent: { text: string; opts?: Parameters<TelegramApi["sendMessage"]>[2] }[] = [];
  const tg: TelegramApi = {
    sendMessage: async (_chat, text, opts) => { sent.push({ text, opts }); },
    answerCallback: async () => {},
    downloadFile: unexpected,
  };
  return { tg, sent };
}

export const mergedPr = (over: Partial<PrInfo> = {}): PrInfo => ({
  number: 21, state: "closed", merged: true, labels: ["draft-post"], head: "draft/weekly-009",
  headSha: "head21", body: "", createdAt: "2026-10-29T06:08:04Z", mergeSha: "abc1234", ...over,
});

/** A weekly post's source; `linkedin` is the caption (empty string for none). */
export const postSource = (n: string, opts: { linkedin?: string; coverImage?: string } = {}) =>
  `---\ntitle: "Post ${n}"\ndate: "2026-10-25"\nsummary: "Summary ${n}."\n` +
  `linkedin: ${JSON.stringify(opts.linkedin ?? `Caption ${n}.`)}\n` +
  (opts.coverImage ? `coverImage: ${JSON.stringify(opts.coverImage)}\n` : "") +
  `---\n\nBody.\n`;

export const PATH_9 = "content/weekly/009-salonjaa-nap.mdx";
export const PATH_10 = "content/weekly/010-brand-name.mdx";

/** A GitHub that knows `prs` and `files`; `reads` records `path@ref` for every file read. */
export function fakeGitHub(world: { prs?: PrInfo[]; files?: Record<string, string>; failGetPr?: boolean } = {}) {
  const prs = world.prs ?? [mergedPr()];
  const files = world.files ?? { [PATH_9]: postSource("009") };
  const reads: string[] = [];
  const gh: GitHubRepo = {
    getPr: async (n) => {
      if (world.failGetPr) throw new Error("GitHub GET /pulls → 500");
      const found = prs.find((p) => p.number === n);
      if (!found) throw new Error(`GitHub GET /pulls/${n} → 404`);
      return found;
    },
    prFiles: async () => Object.keys(files).map((filename) => ({ filename, status: "added" })),
    fileAt: async (path, ref) => { reads.push(`${path}@${ref}`); return files[path]; },
    commitMessage: unexpected, checks: unexpected, commitFiles: unexpected, merge: unexpected, close: unexpected,
    deleteBranch: unexpected, comment: unexpected, listOpenDrafts: unexpected, prsForSha: unexpected,
    previewUrl: unexpected, issue: unexpected, closeIssue: unexpected,
  };
  return { gh, reads };
}
