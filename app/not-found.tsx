import type { Metadata } from "next";
import Link from "next/link";

// Site-styled 404. Next's built-in one picks its colours from the system
// theme and ignores the saved site theme, so a light-theme visitor on a dark
// system got white text on a light page (contrast 1.1:1) and no landmarks.

export const metadata: Metadata = {
  title: "Page not found | Kumar Prasannajit Sahu",
};

export default function NotFound() {
  return (
    <>
      <section className="section band">
        <div className="wrap">
          <div className="eyebrow">404</div>
          <h1 className="h2">Page not found</h1>
          <div style={{ height: 20 }} />
          <p style={{ maxWidth: "52ch", color: "var(--ink-dim)", lineHeight: 1.7 }}>
            There&apos;s nothing at this address. It may have moved, or the link
            may have a typo.
          </p>
          <div style={{ height: 28 }} />
          <div className="cta-row">
            <Link className="btn btn-primary" href="/">
              Back home
            </Link>
            <Link className="btn btn-ghost" href="/#work">
              See the work
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
