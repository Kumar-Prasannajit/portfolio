import { getAllBlogPosts } from "@/lib/content";
import { rssResponse } from "@/lib/rss";

// GET handlers are dynamic by default; the feed only depends on content files,
// so render it once at build time.
export const dynamic = "force-static";

export function GET() {
  return rssResponse({
    title: "Blog",
    description: "Notes on building and shipping full-stack products.",
    path: "/blog",
    feedPath: "/blog/rss.xml",
    items: getAllBlogPosts().map((post) => ({
      title: post.frontmatter.title,
      path: `/blog/${post.slug}`,
      date: post.frontmatter.date,
      description: post.frontmatter.excerpt,
    })),
  });
}
