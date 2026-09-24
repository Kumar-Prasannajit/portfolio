import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { PROJECTS } from "@/lib/data";
import { getAllBlogPosts, getAllWeeklyEntries } from "@/lib/content";

// lastModified comes from content dates only (never the build date). Pages with
// no real date (work case studies, resume, gallery, specs, places) omit it.
// Blog/weekly posts prefer the optional `updated` frontmatter over `date`.
export default function sitemap(): MetadataRoute.Sitemap {
  const blogPosts = getAllBlogPosts();
  const weeklyList = getAllWeeklyEntries();
  const newest = (dates: string[]) =>
    dates.length ? new Date(Math.max(...dates.map((d) => +new Date(d)))) : undefined;
  const blogNewest = newest(blogPosts.map((p) => p.frontmatter.updated ?? p.frontmatter.date));
  const weeklyNewest = newest(weeklyList.map((e) => e.frontmatter.updated ?? e.frontmatter.date));
  const siteNewest = newest([blogNewest, weeklyNewest].filter(Boolean).map((d) => d!.toISOString()));

  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.frontmatter.updated ?? post.frontmatter.date,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const weeklyEntries: MetadataRoute.Sitemap = weeklyList.map(
    (entry) => ({
      url: `${SITE_URL}/weekly/${entry.slug}`,
      lastModified: entry.frontmatter.updated ?? entry.frontmatter.date,
      changeFrequency: "monthly",
      priority: 0.5,
    })
  );

  const workEntries: MetadataRoute.Sitemap = PROJECTS.map((project) => ({
    url: `${SITE_URL}/work/${project.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: siteNewest,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: blogNewest,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/weekly`,
      lastModified: weeklyNewest,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/resume`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/gallery`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/specs`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/places`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...workEntries,
    ...blogEntries,
    ...weeklyEntries,
  ];
}
