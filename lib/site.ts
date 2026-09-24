// Single source of truth for the site's identity and metadata. The domain
// lives here and nowhere else: layout.tsx, robots.ts and sitemap.ts import it.

import type { Metadata } from "next";

export const SITE_URL = "https://www.kumarp.in";
export const SITE_NAME = "Kumar Prasannajit Sahu";
export const SITE_TITLE =
  "Kumar Prasannajit Sahu | Full-Stack Developer";
export const SITE_DESCRIPTION =
  "Full-stack developer building web applications and AI-powered products with React, Next.js and Node.js. Based in Hyderabad, India.";
export const SITE_KEYWORDS = [
  "Kumar Prasannajit Sahu",
  "full-stack developer",
  "MERN developer",
  "Next.js developer",
  "RAG developer",
  "AI engineer",
  "LLM integration",
  "agentic AI",
  "Node.js developer",
  "full-stack developer Hyderabad",
];

// RSS feed routes, advertised as <link rel="alternate"> in the root metadata
// and in pageMetadata (alternates are replaced wholesale, not merged).
export const FEED_ALTERNATES = {
  "application/rss+xml": [
    { url: "/blog/rss.xml", title: `${SITE_NAME} — Blog` },
    { url: "/weekly/rss.xml", title: `${SITE_NAME} — Weekly devlog` },
  ],
};

// Per-page metadata. The canonical and the Open Graph / Twitter fields are
// replaced wholesale (not merged) by whatever a page sets, so each page has to
// supply its own full set: otherwise it would inherit the homepage's canonical
// and og:url. `path` is the route ("/blog", "/work/slug"), resolved against
// metadataBase in the root layout.
export function pageMetadata({
  title,
  description,
  path,
  article,
}: {
  title: string;
  description: string;
  path: string;
  // Set on blog/weekly posts: switches og:type to "article" and adds the
  // article:* tags. Everything else stays "website".
  article?: { publishedTime: string; modifiedTime?: string };
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path, types: FEED_ALTERNATES },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "en_US",
      ...(article
        ? {
            type: "article" as const,
            publishedTime: article.publishedTime,
            modifiedTime: article.modifiedTime ?? article.publishedTime,
            authors: [SITE_URL],
          }
        : { type: "website" as const }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// BlogPosting structured data for a post. `path` is the post's route; the image
// is the post's generated opengraph-image (same URL Next emits for og:image).
export function blogPostingJsonLd({
  headline,
  description,
  path,
  datePublished,
  dateModified,
}: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
}) {
  const url = `${SITE_URL}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    description,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: { "@type": "Person", name: SITE_NAME, url: SITE_URL },
    image: `${url}/opengraph-image`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}
