// Single source of truth for the site's identity and metadata. The domain
// lives here and nowhere else: layout.tsx, robots.ts and sitemap.ts import it.

import type { Metadata } from "next";

export const SITE_URL = "https://www.kumarp.in";
export const SITE_NAME = "Kumar Prasannajit Sahu";
export const SITE_TITLE =
  "Kumar Prasannajit Sahu | Full-Stack Developer";
export const SITE_DESCRIPTION =
  "Full-stack developer building web applications and AI-powered products. Based in Hyderabad, India.";
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

// Per-page metadata. The canonical and the Open Graph / Twitter fields are
// replaced wholesale (not merged) by whatever a page sets, so each page has to
// supply its own full set: otherwise it would inherit the homepage's canonical
// and og:url. `path` is the route ("/blog", "/work/slug"), resolved against
// metadataBase in the root layout.
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
