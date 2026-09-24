import { getAllBlogSlugs, getBlogPostBySlug } from "@/lib/content";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";

export const alt = "Kumar Prasannajit Sahu, blog post";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  return ogImage({
    title: post?.frontmatter.title ?? "Blog",
    footer: "Kumar Prasannajit Sahu · kumarp.in",
  });
}
