import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PROJECTS } from "@/lib/data";
import { IconExternalLink, IconGithub } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import blogStyles from "@/components/BlogPost.module.css";
import styles from "@/components/CaseStudy.module.css";

// Case study for one project: what it is, my role, what I built, the stack,
// screenshots of the live site and links. All copy lives in PROJECTS
// (lib/data.ts); sections with no data (e.g. `outcome`) are simply not shown.

export function generateStaticParams() {
  return PROJECTS.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = PROJECTS.find((p) => p.slug === slug);
  if (!project) return {};
  return pageMetadata({
    title: `${project.title} | Kumar Prasannajit Sahu`,
    description: project.summary,
    path: `/work/${slug}`,
  });
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Reveal className={styles.section}>
      <div className="eyebrow">{label}</div>
      {children}
    </Reveal>
  );
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const index = PROJECTS.findIndex((p) => p.slug === slug);
  if (index === -1) notFound();
  const project = PROJECTS[index];
  const next = PROJECTS[(index + 1) % PROJECTS.length];
  const sourceLink = project.links.find((link) => link.label === "Source");
  const status =
    project.badge.charAt(0).toUpperCase() + project.badge.slice(1).toLowerCase();

  return (
    <>
      <section className="section band">
        <div className="wrap">
          <Link href="/#work" className={blogStyles.back}>
            ← All work
          </Link>

          <header className={blogStyles.header}>
            <h1 className={blogStyles.title}>{project.title}</h1>
            <p className={styles.lead}>{project.summary}</p>
          </header>

          <dl className={styles.meta}>
            <div>
              <dt>Role</dt>
              <dd>{project.role}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{status}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                {sourceLink ? (
                  <a href={sourceLink.href} target="_blank" rel="noopener">
                    Public on GitHub
                  </a>
                ) : (
                  (project.sourceNote ?? "Not public")
                )}
              </dd>
            </div>
          </dl>

          <figure className={styles.frame}>
            <Image
              src={project.image}
              alt={`${project.title} landing page`}
              width={1200}
              height={900}
              sizes="(min-width: 1024px) 960px, 100vw"
              // The LCP image. `priority` is deprecated in Next 16; this is the
              // documented replacement for an image already in the initial HTML.
              loading="eager"
              fetchPriority="high"
            />
          </figure>

          <div className={styles.body}>
            <Section label="Context">
              <p className={styles.prose}>{project.context}</p>
            </Section>

            <Section label="What I built">
              <ul className={styles.built}>
                {project.built.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Section>

            <Section label="Stack">
              <div className={blogStyles.tags}>
                {project.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </Section>

            {project.screenshots.length > 0 && (
              <Section label="Screens">
                <div className={styles.shots}>
                  {project.screenshots.map((shot) => (
                    <figure key={shot.src} className={styles.shot}>
                      <div className={styles.frame}>
                        <Image
                          src={shot.src}
                          alt={shot.alt}
                          width={1440}
                          height={900}
                          sizes="(min-width: 1024px) 470px, 100vw"
                        />
                      </div>
                      <figcaption>{shot.caption}</figcaption>
                    </figure>
                  ))}
                </div>
              </Section>
            )}

            {project.outcome && (
              <Section label="Outcome">
                <p className={styles.prose}>{project.outcome}</p>
              </Section>
            )}

            {project.related && (
              <Section label="Related">
                <Link href={project.related.href} className={styles.related}>
                  {project.related.label} <span aria-hidden="true">→</span>
                </Link>
              </Section>
            )}

            <Reveal className={styles.links}>
              {project.links.map((link, i) => (
                <a
                  key={link.href}
                  className={`btn ${i === 0 ? "btn-primary" : "btn-ghost"}`}
                  href={link.href}
                  target="_blank"
                  rel="noopener"
                >
                  {link.label === "Source" ? <IconGithub /> : <IconExternalLink />}
                  {link.label}
                </a>
              ))}
            </Reveal>
          </div>

          <Link href={`/work/${next.slug}`} className={styles.next}>
            <span className={styles.nextLabel}>Next project</span>
            <span className={styles.nextTitle}>
              {next.title} <span aria-hidden="true">→</span>
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}
