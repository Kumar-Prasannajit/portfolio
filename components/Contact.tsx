import { IconGithub, IconLinkedin } from "./icons";
import { SOCIAL_LINKS } from "@/lib/data";

export default function Contact() {
  return (
    <section className="section contact-band" id="contact">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">06</span> Contact
        </div>
        <h1 className="contact-h">
          LET&apos;S BUILD
          <br />
          SOMETHING
        </h1>
        <p className="contact-sub">
          Open to backend-leaning full-stack work and interesting problems —
          reach out about a role, a freelance build, or just to talk MERN and
          DSA.
        </p>
        <div className="cta-row">
          <a className="btn btn-primary" href={`mailto:${SOCIAL_LINKS.email}`}>
            Email me
          </a>
          <a
            className="btn btn-ghost"
            href="about:blank"
            target="_blank"
            rel="noopener"
            title="Resume — coming soon"
          >
            Resume
          </a>
          <a
            className="btn btn-icon"
            href={SOCIAL_LINKS.github}
            target="_blank"
            rel="noopener"
            aria-label="GitHub"
          >
            <IconGithub />
          </a>
          <a
            className="btn btn-icon"
            href={SOCIAL_LINKS.linkedin}
            target="_blank"
            rel="noopener"
            aria-label="LinkedIn"
          >
            <IconLinkedin />
          </a>
        </div>
        <div className="contact-email mono">{SOCIAL_LINKS.email}</div>
      </div>
    </section>
  );
}
