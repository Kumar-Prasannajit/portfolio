import Link from "next/link";
import type { BlogPostSummary } from "@/lib/content";
import { formatContentDate } from "@/lib/format";
import styles from "./BlogCard.module.css";

export default function BlogCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link href={`/blog/${post.slug}`} className={styles.card}>
      <div className={styles.meta}>
        <span>{formatContentDate(post.frontmatter.date)}</span>
        <span>{post.readTimeMinutes} min read</span>
      </div>
      <h2 className={styles.title}>{post.frontmatter.title}</h2>
      <p className={styles.excerpt}>{post.frontmatter.excerpt}</p>
      <div className={styles.tags}>
        {(post.frontmatter.tags ?? []).map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <span className={styles.readMore}>Read post →</span>
    </Link>
  );
}
