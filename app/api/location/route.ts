import { NextResponse } from "next/server";

// Where the visitor roughly is, for the "watching from" line under the viewers
// counter (components/IdentityPanel.tsx).
//
// Vercel adds these headers to every request from the visitor's IP address, on
// every plan, so no lookup service is involved. They only exist when deployed:
// under `next dev` they are missing and the client falls back to the browser's
// time zone (lib/location.ts). City is approximate (IPs often map to the ISP's
// hub city) and a VPN shows the VPN's location, which is fine for a broad
// label. Nothing is stored or logged.
export const dynamic = "force-dynamic";

export type LocationResponse =
  | { status: "ok"; city: string | null; country: string | null }
  | { status: "unavailable" };

// Vercel percent-encodes the city ("S%C3%A3o%20Paulo").
function decode(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function GET(request: Request) {
  const city = decode(request.headers.get("x-vercel-ip-city"));
  const country = request.headers.get("x-vercel-ip-country");
  const body: LocationResponse =
    city || country ? { status: "ok", city, country } : { status: "unavailable" };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
