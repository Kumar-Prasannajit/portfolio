import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PROJECTS } from "@/lib/data";
import { IconExternalLink, IconGithub } from "@/components/icons";
import styles from "@/components/BlogPost.module.css";

// Placeholder case study: title, screenshot, description, tags and links.
// Phase 6 fills this route out (problem, role, screenshots, outcome).

function getProject(slug: string) {
  return PROJECTS.find((project) => project.slug === slug);
}

export function generateStaticParams() {
  return PROJECTS.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: `${project.title} | Kumar Prasannajit Sahu`,
    description: project.summary,
  };
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <main>
      <section className="section band">
        <div className="wrap">
          <Link href="/#work" className={styles.back}>
            ← All work
          </Link>
          <header className={styles.header}>
            <h1 className={styles.title}>{project.title}</h1>
            <div className={styles.tags}>
              {project.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </header>
          <Image
            src={project.image}
            alt={`${project.title} landing page`}
            width={1200}
            height={900}
            sizes="(min-width: 1024px) 960px, 100vw"
            style={{ width: "100%", height: "auto", marginBottom: 28 }}
            priority
          />
          <p style={{ maxWidth: "68ch", lineHeight: 1.7, color: "var(--ink-dim)" }}>
            {project.description}
          </p>
          <div className="card-links" style={{ marginTop: 20 }}>
            {project.links.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noopener">
                {link.label.startsWith("Source") ? <IconGithub /> : <IconExternalLink />}
                {link.label}
              </a>
            ))}
            {"sourceNote" in project && (
              <span className="card-source-note">{project.sourceNote}</span>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
