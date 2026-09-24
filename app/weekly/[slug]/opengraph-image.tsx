import { getAllWeeklySlugs, getWeeklyEntryBySlug } from "@/lib/content";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";

export const alt = "Kumar Prasannajit Sahu, weekly build log";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return getAllWeeklySlugs().map((slug) => ({ slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getWeeklyEntryBySlug(slug);
  return ogImage({
    label: "Weekly",
    title: entry?.frontmatter.title ?? "Build log",
    footer: "Kumar Prasannajit Sahu · kumarp.in",
  });
}
