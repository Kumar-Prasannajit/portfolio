import { tracks } from "@/lib/data";
import SectionHeading from "@/components/SectionHeading";

// TODO(kumar): `tracks` in lib/data.ts is a static placeholder list. Two real
// integration paths, from simplest to most flexible:
//   a) Spotify's official playlist embed (`<iframe src="https://open.spotify
//      .com/embed/playlist/<id>">`) — zero backend, keeps Spotify's own UI.
//      Swap the list below for the iframe directly.
//   b) A small serverless route (app/api/now-playing/route.ts) calling
//      Spotify's currently-playing / top-tracks Web API endpoints, with the
//      OAuth token refreshed server-side. Cache the response client-side for
//      1-2 minutes and fall back to the static `tracks` list if the call fails.
export default function NowPlaying() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHeading eyebrow="NOW PLAYING" title="On repeat" />

      <div className="mt-8 divide-y divide-panel-line rounded-xl border border-panel-line bg-panel">
        {tracks.map((track, i) => (
          <div key={track.title} className="flex items-center gap-4 px-5 py-4">
            <div
              className={`h-12 w-12 shrink-0 rounded-md bg-gradient-to-br ${track.swatch}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-sm font-semibold text-paper">
                {track.title}
              </p>
              <p className="truncate font-body text-xs text-muted">{track.artist}</p>
            </div>
            {i === 0 ? (
              <Equalizer />
            ) : (
              <span className="font-pixel text-[8px] text-muted">SAMPLE</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Equalizer() {
  return (
    <div
      className="flex h-5 shrink-0 items-end gap-[3px]"
      role="img"
      aria-label="Now playing"
    >
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="w-1 origin-bottom rounded-sm bg-mint motion-safe:animate-[eq-bar_1s_ease-in-out_infinite]"
          style={{ height: "100%", animationDelay: `${bar * 0.15}s` }}
        />
      ))}
    </div>
  );
}
