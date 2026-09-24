import { getAllWeeklyEntries } from "@/lib/content";
import { rssResponse } from "@/lib/rss";

export const dynamic = "force-static";

export function GET() {
  return rssResponse({
    title: "Weekly devlog",
    description: "A running devlog of how this portfolio gets built.",
    path: "/weekly",
    feedPath: "/weekly/rss.xml",
    items: getAllWeeklyEntries().map((entry) => ({
      title: `#${String(entry.number).padStart(3, "0")} — ${entry.frontmatter.title}`,
      path: `/weekly/${entry.slug}`,
      date: entry.frontmatter.date,
      description: entry.frontmatter.summary,
    })),
  });
}
