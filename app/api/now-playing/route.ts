import { NextResponse } from "next/server";

// Last.fm's user.getrecenttracks is used instead of the Spotify Web API's
// own "currently playing" endpoint on purpose: that one needs a per-user
// OAuth flow with a refreshable token, which has nowhere to live on a
// static portfolio without standing up token storage. Last.fm scrobbles
// from Spotify already, exposes the same "now playing" flag off a plain
// API key + username, and costs nothing.
//
// In-page playback resolves the track through Apple's iTunes Search API
// instead of Spotify's own Web API — Spotify now requires the developer
// app's OWNER to have an active Premium subscription before the Web API
// (even a keyless Client Credentials search) will respond at all. iTunes
// Search needs no key, no auth, and no subscription on either end, and
// returns a direct 30s preview audio file playable from a plain <audio>
// tag — no embed widget needed.

export type NowPlayingResponse =
  | { status: "unconfigured" }
  | { status: "no-scrobbles" }
  | { status: "error" }
  | {
      status: "playing" | "idle";
      title: string;
      artist: string;
      url: string;
      previewUrl: string | null;
      artwork: string | null;
    };

async function findApplePreview(
  title: string,
  artist: string
): Promise<{ previewUrl: string | null; artwork: string | null }> {
  try {
    const endpoint = new URL("https://itunes.apple.com/search");
    endpoint.searchParams.set("term", `${artist} ${title}`);
    endpoint.searchParams.set("entity", "song");
    endpoint.searchParams.set("limit", "1");

    const res = await fetch(endpoint, { next: { revalidate: 15 } });
    if (!res.ok) return { previewUrl: null, artwork: null };

    const data = await res.json();
    const track = data?.results?.[0];
    if (!track) return { previewUrl: null, artwork: null };

    return {
      previewUrl: track.previewUrl ?? null,
      // iTunes only serves small artwork by default; swapping the size
      // segment in the URL gets a much sharper image for the popover.
      artwork: track.artworkUrl100?.replace("100x100", "300x300") ?? null,
    };
  } catch {
    return { previewUrl: null, artwork: null };
  }
}

export async function GET() {
  const apiKey = process.env.LASTFM_API_KEY;
  const username = process.env.LASTFM_USERNAME;

  if (!apiKey || !username) {
    return NextResponse.json<NowPlayingResponse>({ status: "unconfigured" });
  }

  try {
    const endpoint = new URL("https://ws.audioscrobbler.com/2.0/");
    endpoint.searchParams.set("method", "user.getrecenttracks");
    endpoint.searchParams.set("user", username);
    endpoint.searchParams.set("api_key", apiKey);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("limit", "1");

    const res = await fetch(endpoint, { next: { revalidate: 15 } });
    if (!res.ok) {
      return NextResponse.json<NowPlayingResponse>({ status: "error" });
    }

    const data = await res.json();
    const tracks = data?.recenttracks?.track;
    if (!Array.isArray(tracks)) {
      return NextResponse.json<NowPlayingResponse>({ status: "error" });
    }
    // A valid, zero-scrobble account (Last.fm not yet linked to Spotify,
    // or never scrobbled anything) returns an empty array here — that's
    // a real, distinct state from a broken API call.
    const track = tracks[0];
    if (!track) {
      return NextResponse.json<NowPlayingResponse>({ status: "no-scrobbles" });
    }

    const title = track.name ?? "Unknown track";
    const artist = track.artist?.["#text"] ?? "Unknown artist";
    const isPlaying = track["@attr"]?.nowplaying === "true";
    const { previewUrl, artwork } = await findApplePreview(title, artist);

    return NextResponse.json<NowPlayingResponse>({
      status: isPlaying ? "playing" : "idle",
      title,
      artist,
      url: track.url ?? "",
      previewUrl,
      artwork,
    });
  } catch {
    return NextResponse.json<NowPlayingResponse>({ status: "error" });
  }
}
