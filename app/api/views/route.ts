import { NextResponse } from "next/server";
import { getViews } from "@/lib/viewCount";

// GET  -> the current count.
// POST -> count this browser once, then return the new count. The browser only
//         POSTs when it has not been counted before (lib/views.ts).
//
// Crawlers, link-preview fetchers and headless test runners are never counted,
// and neither is a POST that did not come from this site. It is a counter, not
// analytics: anyone determined could still POST to it directly.

const NOT_A_VIEWER =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|curl|wget|python|node-fetch|axios|postman/i;

export const dynamic = "force-dynamic";

function json(body: unknown) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return json(await getViews(false));
}

export async function POST(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const sameSite = !origin || (host !== null && new URL(origin).host === host);
  const countable = sameSite && ua !== "" && !NOT_A_VIEWER.test(ua);
  const result = await getViews(countable);
  // `counted` lets the browser remember it has been counted only when it
  // really was, so a declined request is retried on the next visit.
  return json({ ...result, counted: countable && result.status === "ok" });
}
