"use client";

// Phase 7 (docs/redesign-spec.md section 9): the Work feed. Three columns,
// mixed card sizes and frame treatments (fill / outline / invert — one hue),
// screenshots duotoned into the accent, and a tag filter row with counts. The
// filter is the same store the Stack section writes to
// (lib/useStackFilter.ts), so picking a tool there or a tag here is one state.
// Items are a discriminated union (lib/feed.ts) so blog/weekly/gallery can join.

import Link from "next/link";
import Image from "next/image";
import { frameAt, sizeAt, tagCounts, type FeedItem } from "@/lib/feed";
import { setStackFilter, useStackFilter } from "@/lib/useStackFilter";

const KIND_LABEL: Record<FeedItem["kind"], string> = {
  project: "Project",
  blog: "Blog",
  weekly: "Weekly",
  gallery: "Gallery",
};

const formatDate = (iso: string) =>
  new Date(iso)
    .toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    .toUpperCase();

export default function WorkGrid({ items }: { items: readonly FeedItem[] }) {
  const filter = useStackFilter();
  const tags = tagCounts(items);
  const shown = filter ? items.filter((i) => i.tags.includes(filter)) : items;

  return (
    <>
      <div className="feed-filters" role="group" aria-label="Filter work by tag">
        <button
          type="button"
          className="feed-chip"
          aria-pressed={!filter}
          onClick={() => setStackFilter(null)}
        >
          All <span className="feed-chip-n">{items.length}</span>
        </button>
        {tags.map(([tag, n]) => (
          <button
            type="button"
            className="feed-chip"
            key={tag}
            aria-pressed={tag === filter}
            onClick={() => setStackFilter(tag === filter ? null : tag)}
          >
            {tag} <span className="feed-chip-n">{n}</span>
          </button>
        ))}
      </div>

      <p className="stack-filter-note mono" aria-live="polite">
        {filter ? (
          <>
            Showing {shown.length} of {items.length} using {filter} ·{" "}
            <button type="button" onClick={() => setStackFilter(null)}>
              show all
            </button>
          </>
        ) : null}
      </p>

      <div className="feed-grid">
        {shown.map((item, i) => (
          <article
            className="feed-card"
            key={item.id}
            data-size={sizeAt(i)}
            data-frame={frameAt(i)}
          >
            {item.image ? (
              <div className="feed-shot">
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  sizes="(max-width: 1023px) 100vw, 40vw"
                />
              </div>
            ) : null}
            <div className="feed-body">
              <div className="feed-meta">
                <span className="feed-chip-static">{KIND_LABEL[item.kind]}</span>
                {item.date ? (
                  <span className="feed-chip-static">{formatDate(item.date)}</span>
                ) : null}
                {item.kind === "project" ? (
                  <span className="feed-chip-static">{item.badge}</span>
                ) : null}
              </div>
              <h3 className="feed-title">{item.title}</h3>
              <p className="feed-summary">{item.summary}</p>
              <div className="feed-tags">
                {item.tags.map((tag) => (
                  <span className="feed-chip-static" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                href={item.href}
                className="feed-link"
                data-cursor="View"
                aria-label={`${item.title}: view ${KIND_LABEL[item.kind].toLowerCase()}`}
              >
                View {KIND_LABEL[item.kind].toLowerCase()} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
