import type { Metadata } from "next";
import { blogPostingJsonLd, pageMetadata } from "@/lib/site";
import JsonLd from "@/components/JsonLd";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllBlogSlugs, getBlogPostBySlug } from "@/lib/content";
import { formatContentDate } from "@/lib/format";
import { mdxComponents, mdxProseStyles } from "@/components/MdxProse";
import styles from "@/components/BlogPost.module.css";

export function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return {};
  return pageMetadata({
    title: `${post.frontmatter.title} | Kumar Prasannajit Sahu`,
    description: post.frontmatter.excerpt,
    path: `/blog/${slug}`,
    article: {
      publishedTime: post.frontmatter.date,
      modifiedTime: post.frontmatter.updated,
    },
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  return (
    <>
      <JsonLd
        data={blogPostingJsonLd({
          headline: post.frontmatter.title,
          description: post.frontmatter.excerpt,
          path: `/blog/${slug}`,
          datePublished: post.frontmatter.date,
          dateModified: post.frontmatter.updated,
        })}
      />
      <section className="section band">
        <div className="wrap">
          <Link href="/blog" className={styles.back}>
            ← All posts
          </Link>
          <header className={styles.header}>
            <h1 className={styles.title}>{post.frontmatter.title}</h1>
            <div className={styles.meta}>
              <span>{formatContentDate(post.frontmatter.date)}</span>
              <span>{post.readTimeMinutes} min read</span>
              <span>{post.wordCount.toLocaleString("en-US")} words</span>
            </div>
            <div className={styles.tags}>
              {(post.frontmatter.tags ?? []).map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </header>
          <div className={mdxProseStyles.prose}>
            <MDXRemote source={post.content} components={mdxComponents()} />
          </div>
        </div>
      </section>
    </>
  );
}
