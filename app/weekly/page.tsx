import type { Metadata } from "next";
import { getAllWeeklyEntries } from "@/lib/content";
import WeeklyCard from "@/components/WeeklyCard";
import styles from "@/components/ContentGrid.module.css";

export const metadata: Metadata = {
  title: "Weekly | Kumar Prasannajit Sahu",
  description:
    "A numbered, dated build-in-public log of what actually shipped on this site and elsewhere, week to week.",
};

export default function WeeklyIndexPage() {
  const entries = getAllWeeklyEntries();

  return (
    <main>
      <section className="section band">
        <div className="wrap">
          <div className="eyebrow">
            Weekly
          </div>
          <h1 className="h2">Build log</h1>
          <div style={{ height: 28 }} />
          {entries.length === 0 ? (
            <p className={styles.empty}>Nothing logged yet.</p>
          ) : (
            <div className={styles.grid}>
              {entries.map((entry) => (
                <WeeklyCard key={entry.slug} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
