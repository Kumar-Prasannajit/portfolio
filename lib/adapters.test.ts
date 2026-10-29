import test from "node:test";
import assert from "node:assert/strict";
import { telegramApi } from "./telegramApi.ts";
import { REPO, githubRepo } from "./githubWrite.ts";

const TG_TOKEN = "123456:DUMMY-TELEGRAM-TOKEN";
const GH_TOKEN = "ghp_dummyGithubToken";

type Call = { method: string; url: string; headers: Record<string, string>; body: unknown };
type Reply = { status?: number; json?: unknown; text?: string; bytes?: Uint8Array };

/** A recording fake fetch: `respond` maps each call to a reply (default 200 {}). */
function fakeFetch(respond: (call: Call) => Reply = () => ({})) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const raw = typeof init?.body === "string" ? init.body : undefined;
    const call: Call = {
      method: init?.method ?? "GET",
      url: String(input),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: raw === undefined ? undefined : JSON.parse(raw),
    };
    calls.push(call);
    const r = respond(call);
    const body = r.bytes ?? r.text ?? JSON.stringify(r.json ?? {});
    return new Response(r.status === 204 ? null : (body as BodyInit), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { calls, impl };
}

const tgOk = () => ({ json: { ok: true, result: true } }); // what Telegram answers on success

// ── Telegram ──────────────────────────────────────────────────────────────
test("downloadFile failing with 500 leaks neither the token nor the file URL", async () => {
  const { impl } = fakeFetch((c) =>
    c.url.includes("/getFile")
      ? { json: { ok: true, result: { file_path: "photos/file_1.jpg" } } }
      : { status: 500, text: "boom" });
  await assert.rejects(telegramApi(TG_TOKEN, impl).downloadFile("fid"), (err: Error) => {
    assert.ok(!err.message.includes(TG_TOKEN), err.message);
    assert.ok(!err.message.includes("/file/bot"), err.message);
    return true;
  });
});

test("downloadFile returns the bytes and the file path", async () => {
  const { impl, calls } = fakeFetch((c) =>
    c.url.includes("/getFile")
      ? { json: { ok: true, result: { file_path: "photos/file_1.jpg" } } }
      : { bytes: new Uint8Array([1, 2, 3]) });
  const out = await telegramApi(TG_TOKEN, impl).downloadFile("fid");
  assert.deepEqual([...out.bytes], [1, 2, 3]);
  assert.equal(out.filePath, "photos/file_1.jpg");
  assert.deepEqual(calls[0].body, { file_id: "fid" });
});

test("sendMessage posts HTML with link previews off and the keyboard", async () => {
  const { impl, calls } = fakeFetch(tgOk);
  const keyboard = { inline_keyboard: [[{ text: "Publish", callback_data: "pub:21" }]] };
  await telegramApi(TG_TOKEN, impl).sendMessage("4242", "<b>hi</b>", { keyboard });
  assert.equal(calls[0].url, `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`);
  assert.deepEqual(calls[0].body, {
    chat_id: "4242", text: "<b>hi</b>", parse_mode: "HTML",
    link_preview_options: { is_disabled: true }, reply_markup: keyboard,
  });
});

test("sendMessage with forceReply asks Telegram for a forced reply", async () => {
  const { impl, calls } = fakeFetch(tgOk);
  await telegramApi(TG_TOKEN, impl).sendMessage("4242", "What should change in PR #21?", { forceReply: true });
  assert.deepEqual((calls[0].body as { reply_markup: unknown }).reply_markup, { force_reply: true });
});

test("sendMessage without options sends no reply_markup", async () => {
  const { impl, calls } = fakeFetch(tgOk);
  await telegramApi(TG_TOKEN, impl).sendMessage("4242", "hi");
  assert.ok(!("reply_markup" in (calls[0].body as object)));
});

test("answerCallback answers the callback query", async () => {
  const { impl, calls } = fakeFetch(tgOk);
  await telegramApi(TG_TOKEN, impl).answerCallback("cb-1");
  assert.ok(calls[0].url.endsWith("/answerCallbackQuery"));
  assert.deepEqual(calls[0].body, { callback_query_id: "cb-1" });
});

test("a Telegram error names the method and status, not the token", async () => {
  const { impl } = fakeFetch(() => ({ status: 400, json: { ok: false, error_code: 400, description: "Bad Request: nope" } }));
  await assert.rejects(telegramApi(TG_TOKEN, impl).sendMessage("4242", "x"), (err: Error) => {
    assert.match(err.message, /^Telegram sendMessage → 400/);
    assert.ok(!err.message.includes(TG_TOKEN));
    return true;
  });
});

// ── GitHub ────────────────────────────────────────────────────────────────
const BASE = `https://api.github.com/repos/${REPO}`;

test("REPO is the portfolio repo", () => {
  assert.equal(REPO, "Kumar-Prasannajit/portfolio");
});

test("every GitHub request carries the bearer token and targets the one repo", async () => {
  const pull = { number: 21, state: "open", merged: false, labels: [], head: { ref: "draft/x", sha: "s" }, body: "", created_at: "t" };
  const { impl, calls } = fakeFetch((c) => {
    if (c.url.includes("/pulls?")) return { json: [] };
    if (c.url.includes("/pulls/") && !c.url.includes("/files")) return { json: pull };
    if (c.url.includes("/files")) return { json: [] };
    if (c.url.includes("/commits/") && c.url.includes("/pulls")) return { json: [] };
    return { json: {} };
  });
  const gh = githubRepo(GH_TOKEN, impl);
  await gh.getPr(21);
  await gh.prFiles(21);
  await gh.merge(21);
  await gh.close(21);
  await gh.comment(21, "hi");
  await gh.listOpenDrafts();
  await gh.prsForSha("abc");
  await gh.closeIssue(31);
  assert.ok(calls.length >= 8);
  for (const c of calls) {
    assert.equal(c.headers.authorization, `Bearer ${GH_TOKEN}`, c.url);
    assert.ok(c.url.startsWith(`${BASE}/`), c.url);
  }
});

test("getPr maps the PR and only reports a merge commit once merged", async () => {
  const json = (merged: boolean) => ({
    number: 21, state: merged ? "closed" : "open", merged, labels: [{ name: "draft-post" }],
    head: { ref: "draft/weekly-009", sha: "headsha" }, body: null, created_at: "2026-10-27T00:00:00Z",
    merge_commit_sha: "mergesha",
  });
  const open = await githubRepo(GH_TOKEN, fakeFetch(() => ({ json: json(false) })).impl).getPr(21);
  assert.deepEqual(open, {
    number: 21, state: "open", merged: false, labels: ["draft-post"], head: "draft/weekly-009",
    headSha: "headsha", body: "", createdAt: "2026-10-27T00:00:00Z", mergeSha: null,
  });
  const merged = await githubRepo(GH_TOKEN, fakeFetch(() => ({ json: json(true) })).impl).getPr(21);
  assert.equal(merged.mergeSha, "mergesha");
  assert.equal(merged.merged, true);
});

test("a non-2xx GitHub response throws the method, path and status", async () => {
  const gh = githubRepo(GH_TOKEN, fakeFetch(() => ({ status: 409, json: { message: "nope" } })).impl);
  await assert.rejects(gh.merge(21), { message: "GitHub PUT /pulls/21/merge → 409" });
});

test("merge uses a merge commit", async () => {
  const { impl, calls } = fakeFetch();
  await githubRepo(GH_TOKEN, impl).merge(21);
  assert.equal(calls[0].method, "PUT");
  assert.deepEqual(calls[0].body, { merge_method: "merge" });
});

test("deleteBranch treats a branch that is already gone as done", async () => {
  for (const status of [404, 422]) {
    const gh = githubRepo(GH_TOKEN, fakeFetch(() => ({ status, json: { message: "gone" } })).impl);
    await gh.deleteBranch("draft/weekly-009");
  }
  const failing = githubRepo(GH_TOKEN, fakeFetch(() => ({ status: 500 })).impl);
  await assert.rejects(failing.deleteBranch("draft/weekly-009"), { message: "GitHub DELETE /git/refs/heads/draft/weekly-009 → 500" });
});

test("commitFiles returns null and makes no commit or ref call when the tree is unchanged", async () => {
  const { impl, calls } = fakeFetch((c) => {
    if (c.url.endsWith("/git/ref/heads/draft/weekly-009")) return { json: { object: { sha: "head1" } } };
    if (c.url.endsWith("/git/commits/head1")) return { json: { tree: { sha: "tree1" } } };
    if (c.url.endsWith("/git/blobs")) return { json: { sha: "blob1" } };
    if (c.url.endsWith("/git/trees")) return { json: { sha: "tree1" } }; // same as the base tree
    return { json: {} };
  });
  const sha = await githubRepo(GH_TOKEN, impl).commitFiles(
    "draft/weekly-009", [{ path: "public/covers/a.jpg", content: new Uint8Array([1]) }], "Cover for #21");
  assert.equal(sha, null);
  assert.ok(!calls.some((c) => c.method === "POST" && c.url.endsWith("/git/commits")));
  assert.ok(!calls.some((c) => c.method === "PATCH"));
});

test("commitFiles commits the changed tree on top of the head and moves the ref without force", async () => {
  const { impl, calls } = fakeFetch((c) => {
    if (c.url.endsWith("/git/ref/heads/draft/weekly-009")) return { json: { object: { sha: "head1" } } };
    if (c.url.endsWith("/git/commits/head1")) return { json: { tree: { sha: "tree1" } } };
    if (c.url.endsWith("/git/blobs")) return { json: { sha: `blob${calls.length}` } };
    if (c.url.endsWith("/git/trees")) return { json: { sha: "tree2" } };
    if (c.method === "POST" && c.url.endsWith("/git/commits")) return { json: { sha: "commit2" } };
    return { json: {} };
  });
  const sha = await githubRepo(GH_TOKEN, impl).commitFiles("draft/weekly-009", [
    { path: "public/covers/a.jpg", content: new Uint8Array([104, 105]) },
    { path: "content/weekly/009-x.mdx", content: "hello" },
  ], "Cover for #21");
  assert.equal(sha, "commit2");
  const blobs = calls.filter((c) => c.url.endsWith("/git/blobs")).map((c) => c.body);
  assert.deepEqual(blobs, [
    { content: Buffer.from("hi").toString("base64"), encoding: "base64" },
    { content: Buffer.from("hello").toString("base64"), encoding: "base64" },
  ]);
  const tree = calls.find((c) => c.url.endsWith("/git/trees"))!.body as { base_tree: string; tree: { path: string }[] };
  assert.equal(tree.base_tree, "tree1");
  assert.deepEqual(tree.tree.map((t) => t.path), ["public/covers/a.jpg", "content/weekly/009-x.mdx"]);
  const commit = calls.find((c) => c.method === "POST" && c.url.endsWith("/git/commits"))!.body;
  assert.deepEqual(commit, { message: "Cover for #21", tree: "tree2", parents: ["head1"] });
  const ref = calls.find((c) => c.method === "PATCH")!;
  assert.ok(ref.url.endsWith("/git/refs/heads/draft/weekly-009"));
  assert.deepEqual(ref.body, { sha: "commit2", force: false });
});

test("listOpenDrafts keeps only draft-post PRs from draft/ branches", async () => {
  const pull = (n: number, head: string, labels: string[]) => ({
    number: n, state: "open", labels: labels.map((name) => ({ name })), head: { ref: head, sha: `s${n}` },
    body: "b", created_at: "t", merged_at: null,
  });
  const gh = githubRepo(GH_TOKEN, fakeFetch(() => ({ json: [
    pull(21, "draft/weekly-009", ["draft-post"]), pull(7, "feat/x", ["draft-post"]), pull(8, "draft/y", []),
  ] })).impl);
  assert.deepEqual((await gh.listOpenDrafts()).map((p) => p.number), [21]);
});

test("previewUrl is the newest Preview deployment's environment URL", async () => {
  const { impl } = fakeFetch((c) => {
    if (c.url.includes("/deployments?")) return { json: [{ id: 9, environment: "Production" }, { id: 8, environment: "Preview" }, { id: 7, environment: "Preview" }] };
    if (c.url.includes("/deployments/8/statuses")) return { json: [{ environment_url: "https://p-8.vercel.app" }] };
    return { json: [] };
  });
  assert.equal(await githubRepo(GH_TOKEN, impl).previewUrl("abc"), "https://p-8.vercel.app");
});

test("previewUrl is null when there is no Preview deployment", async () => {
  const gh = githubRepo(GH_TOKEN, fakeFetch(() => ({ json: [] })).impl);
  assert.equal(await gh.previewUrl("abc"), null);
});
