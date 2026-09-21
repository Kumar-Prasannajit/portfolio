import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import {
  getAllWeeklySlugs,
  getWeeklyEntryBySlug,
} from "@/lib/content";
import { formatContentDate } from "@/lib/format";
import { mdxComponents, mdxProseStyles } from "@/components/MdxProse";
import styles from "@/components/BlogPost.module.css";

export function generateStaticParams() {
  return getAllWeeklySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = getWeeklyEntryBySlug(slug);
  if (!entry) return {};
  return {
    title: `#${String(entry.number).padStart(3, "0")} — ${entry.frontmatter.title} | Kumar Prasannajit Sahu`,
    description: entry.frontmatter.summary,
  };
}

export default async function WeeklyEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getWeeklyEntryBySlug(slug);
  if (!entry) notFound();

  const number = `#${String(entry.number).padStart(3, "0")}`;

  return (
    <>
      <section className="section band">
        <div className="wrap">
          <Link href="/weekly" className={styles.back}>
            ← All entries
          </Link>
          <header className={styles.header}>
            <div className={styles.meta}>
              <span>{number}</span>
              <span>{formatContentDate(entry.frontmatter.date)}</span>
              <span>{entry.readTimeMinutes} min read</span>
            </div>
            <h1 className={styles.title}>{entry.frontmatter.title}</h1>
          </header>
          <div className={mdxProseStyles.prose}>
            <MDXRemote source={entry.content} components={mdxComponents()} />
          </div>
        </div>
      </section>
    </>
  );
}
