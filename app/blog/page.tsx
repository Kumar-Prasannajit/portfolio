import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { getAllBlogPosts, getAllBlogTags } from "@/lib/content";
import BlogIndex from "@/components/BlogIndex";

export const metadata: Metadata = pageMetadata({
  title: "Blog | Kumar Prasannajit Sahu",
  description:
    "Backend-leaning notes on MERN, payments, and whatever else took longer to understand than to fix.",
  path: "/blog",
});

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();
  const tags = getAllBlogTags();

  return (
    <>
      <section className="section band">
        <div className="wrap">
          <div className="eyebrow">
            Blogs
          </div>
          <h1 className="h2">Field notes</h1>
          <div style={{ height: 28 }} />
          <BlogIndex posts={posts} tags={tags} />
        </div>
      </section>
    </>
  );
}
