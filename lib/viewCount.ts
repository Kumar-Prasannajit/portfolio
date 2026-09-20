// Server-side storage for the "viewers" number in the home page's left panel
// (see app/api/views/route.ts and components/IdentityPanel.tsx).
//
// It is a plain counter: no IP addresses, no user agent, nothing about the
// visitor is stored. The browser tells the server "I haven't been counted"
// once (lib/views.ts), and the server adds one.
//
// Where the number lives:
//   - Upstash Redis over its REST API when UPSTASH_REDIS_REST_URL and
//     UPSTASH_REDIS_REST_TOKEN are set (Vercel's Upstash integration sets
//     KV_REST_API_URL / KV_REST_API_TOKEN instead; both spellings work).
//     This is what a deployed (serverless) site needs.
//   - A JSON file under .data/ in development only, so the panel works
//     locally without any setup.
//   - Otherwise "unconfigured": the panel says so rather than showing a
//     made-up number.

import { promises as fs } from "node:fs";
import path from "node:path";

export type ViewsResult =
  | { status: "ok"; count: number }
  | { status: "unconfigured" }
  | { status: "error" };

const KEY = "kps:views";
const DEV_FILE = path.join(process.cwd(), ".data", "views.json");

function upstash() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redis(conn: { url: string; token: string }, command: (string | number)[]) {
  const res = await fetch(conn.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

// One writer at a time for the dev file, so two quick requests can't lose a
// count.
let fileLock: Promise<unknown> = Promise.resolve();

async function devFile(increment: boolean): Promise<number> {
  const run = async () => {
    let count = 0;
    try {
      count = Number(JSON.parse(await fs.readFile(DEV_FILE, "utf8")).count) || 0;
    } catch {}
    if (increment) {
      count += 1;
      await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
      await fs.writeFile(DEV_FILE, JSON.stringify({ count }));
    }
    return count;
  };
  const next = fileLock.then(run, run);
  fileLock = next.catch(() => {});
  return next;
}

export async function getViews(increment: boolean): Promise<ViewsResult> {
  try {
    const conn = upstash();
    if (conn) {
      const result = increment ? await redis(conn, ["INCR", KEY]) : await redis(conn, ["GET", KEY]);
      return { status: "ok", count: Number(result) || 0 };
    }
    if (process.env.NODE_ENV !== "production") {
      return { status: "ok", count: await devFile(increment) };
    }
    return { status: "unconfigured" };
  } catch {
    return { status: "error" };
  }
}
