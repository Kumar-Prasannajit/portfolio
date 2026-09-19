import type { MetadataRoute } from "next";
import { getAllBlogPosts, getAllWeeklyEntries } from "@/lib/content";

const SITE_URL = "https://kumarp.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const blogEntries: MetadataRoute.Sitemap = getAllBlogPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.frontmatter.date,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const weeklyEntries: MetadataRoute.Sitemap = getAllWeeklyEntries().map(
    (entry) => ({
      url: `${SITE_URL}/weekly/${entry.slug}`,
      lastModified: entry.frontmatter.date,
      changeFrequency: "monthly",
      priority: 0.5,
    })
  );

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/weekly`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/resume`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/gallery`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/specs`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/places`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...blogEntries,
    ...weeklyEntries,
  ];
}
