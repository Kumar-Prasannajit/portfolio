import type { Metadata } from "next";
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
  return {
    title: `${post.frontmatter.title} | Kumar Prasannajit Sahu`,
    description: post.frontmatter.excerpt,
  };
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
    <main id="main" tabIndex={-1}>
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
    </main>
  );
}
