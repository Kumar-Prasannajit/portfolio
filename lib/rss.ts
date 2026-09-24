// Minimal RSS 2.0 builder for the blog and weekly feeds. Items are expected
// newest-first (getAll* already sorts that way).

import { SITE_NAME, SITE_URL } from "@/lib/site";

export type RssItem = {
  title: string;
  path: string; // "/blog/slug"; made absolute against SITE_URL
  date: string; // ISO yyyy-mm-dd
  description: string;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function rssResponse({
  title,
  description,
  path,
  feedPath,
  items,
}: {
  title: string;
  description: string;
  path: string;
  feedPath: string;
  items: RssItem[];
}) {
  const itemXml = items
    .map((item) => {
      const link = `${SITE_URL}${item.path}`;
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(item.date).toUTCString()}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`;
    })
    .join("\n");

  const lastBuildDate = items[0] ? new Date(items[0].date).toUTCString() : "";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${SITE_NAME} — ${title}`)}</title>
    <link>${SITE_URL}${path}</link>
    <description>${escapeXml(description)}</description>
    <language>en</language>
${lastBuildDate ? `    <lastBuildDate>${lastBuildDate}</lastBuildDate>\n` : ""}    <atom:link href="${SITE_URL}${feedPath}" rel="self" type="application/rss+xml" />
${itemXml}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
