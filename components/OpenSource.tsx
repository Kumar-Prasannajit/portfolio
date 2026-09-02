import { getOpenSourceActivity } from "@/lib/github";
import type { OpenSourceItem } from "@/lib/data";
import SectionHeading from "@/components/SectionHeading";

const STATE_STYLES: Record<OpenSourceItem["state"], string> = {
  merged: "border-mint/40 bg-mint/10 text-mint",
  open: "border-amber/40 bg-amber/10 text-amber",
  closed: "border-panel-line bg-panel-line/40 text-muted",
};

// Server Component: fetches server-side (cached/revalidated hourly in
// lib/github.ts) rather than calling GitHub's rate-limited search API from
// the client on every page load. Falls back to a static placeholder list
// (lib/data.ts → openSourceFallback) if the call fails or comes back empty,
// so this section never renders empty — same pattern as Now Playing.
export default async function OpenSource() {
  const { items, isFallback } = await getOpenSourceActivity();

  return (
    <section id="open-source" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHeading eyebrow="OPEN SOURCE" title="Recent activity" />

      <div className="mt-8 divide-y divide-panel-line rounded-xl border border-panel-line bg-panel">
        {items.map((item) => (
          <a
            key={item.url + item.title}
            href={item.url}
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-violet-deep/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-sm font-semibold text-paper">
                {item.title}
              </p>
              <p className="truncate font-body text-xs text-muted">{item.repo}</p>
            </div>
            {isFallback ? (
              <span className="font-pixel text-[8px] text-muted">SAMPLE</span>
            ) : (
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 font-pixel text-[8px] uppercase ${STATE_STYLES[item.state]}`}
              >
                {item.state}
              </span>
            )}
          </a>
        ))}
      </div>

      {isFallback && (
        <p className="mt-3 font-body text-xs text-muted">
          Showing placeholder activity — live GitHub data wasn&apos;t reachable just now.
        </p>
      )}
    </section>
  );
}
