import Link from "next/link";
import type { WeeklyEntrySummary } from "@/lib/content";
import { formatContentDate } from "@/lib/format";
import styles from "./WeeklyCard.module.css";

function entryNumber(n: number) {
  return `#${String(n).padStart(3, "0")}`;
}

export default function WeeklyCard({ entry }: { entry: WeeklyEntrySummary }) {
  return (
    <Link href={`/weekly/${entry.slug}`} className={styles.card}>
      <div className={styles.cover} aria-hidden="true">
        <span className={styles.number}>{entryNumber(entry.number)}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span>{entryNumber(entry.number)}</span>
          <span>{formatContentDate(entry.frontmatter.date)}</span>
          <span>{entry.readTimeMinutes} min read</span>
        </div>
        <h2 className={styles.title}>{entry.frontmatter.title}</h2>
        <p className={styles.summary}>{entry.frontmatter.summary}</p>
      </div>
    </Link>
  );
}
