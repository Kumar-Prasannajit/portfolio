"use client";

import { useMemo, useState } from "react";
import type { BlogPostSummary } from "@/lib/content";
import BlogCard from "./BlogCard";
import styles from "./BlogIndex.module.css";
import gridStyles from "./ContentGrid.module.css";

const PAGE_SIZE_OPTIONS = [3, 6, 9, 12] as const;
const DEFAULT_PAGE_SIZE = 6;

export default function BlogIndex({
  posts,
  tags,
}: {
  posts: BlogPostSummary[];
  tags: string[];
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesTag = tag === "all" || post.frontmatter.tags?.includes(tag);
      const matchesQuery = q === "" || post.searchText.includes(q);
      return matchesTag && matchesQuery;
    });
  }, [posts, query, tag]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  // Filtering/resizing can leave `page` pointing past the new last page
  // (e.g. narrowing a search while on page 3 of what's now 1 page) —
  // clamp at render time instead of chasing it with an effect.
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }
  function updateTag(value: string) {
    setTag(value);
    setPage(1);
  }
  function updatePageSize(value: number) {
    setPageSize(value);
    setPage(1);
  }

  return (
    <div>
      <div className={styles.controls}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search posts…"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          aria-label="Search blog posts"
        />
        <select
          className={styles.select}
          value={tag}
          onChange={(event) => updateTag(event.target.value)}
          aria-label="Filter by tag"
        >
          <option value="all">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={pageSize}
          onChange={(event) => updatePageSize(Number(event.target.value))}
          aria-label="Posts per page"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>

      {paged.length === 0 ? (
        <p className={gridStyles.empty}>
          No posts match{query ? ` “${query}”` : ""}
          {tag !== "all" ? ` in #${tag}` : ""}.
        </p>
      ) : (
        <div className={gridStyles.grid}>
          {paged.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span className={styles.pageInfo}>
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
