import { IconGithub, IconLinkedin } from "./icons";
import { HERO_BINARY, SOCIAL_LINKS } from "@/lib/data";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-lines" aria-hidden="true">
        <svg
          viewBox="0 0 1200 500"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g fill="none" stroke="var(--red)" strokeWidth="1">
            <path
              d="M-50,60 C 200,20 300,140 500,90 S 900,40 1250,110"
              opacity="0.35"
            />
            <path
              d="M-50,120 C 220,70 320,200 520,150 S 920,90 1250,170"
              opacity="0.28"
            />
            <path
              d="M-50,180 C 240,120 340,260 540,210 S 940,140 1250,230"
              opacity="0.22"
            />
            <path
              d="M-50,240 C 260,170 360,320 560,270 S 960,190 1250,290"
              opacity="0.16"
            />
            <path
              d="M-50,300 C 280,220 380,380 580,330 S 980,240 1250,350"
              opacity="0.12"
            />
            <path
              d="M-50,360 C 300,270 400,440 600,390 S 1000,290 1250,410"
              opacity="0.08"
            />
          </g>
        </svg>
      </div>
      <div className="hero-bin mono" aria-hidden="true">
        {HERO_BINARY}
      </div>
      <div className="wrap hero-inner">
        <div className="status-line">
          <span>process --status</span>
          <span className="cursor"></span>
          <span style={{ color: "var(--ink-faint)" }}>
            · returns: building
          </span>
        </div>
        <h1>
          KUMAR
          <br />
          <span className="l2">PRASANNAJIT</span>
        </h1>
        <p className="hero-sub">
          Backend-leaning <strong>full-stack developer</strong> on the MERN
          stack — I ship REST APIs, booking platforms and the interfaces that
          sit on top of them, out of Odisha, India.
        </p>
        <div className="meta-row">
          <span className="meta-chip">[ ODISHA, IN ]</span>
          <span className="meta-chip">[ AIDEAS TECH SOLUTIONS ]</span>
          <span className="meta-chip">[ B.TECH ECE — GIET UNIVERSITY ]</span>
        </div>
        <div className="cta-row">
          <a className="btn btn-primary" href={`mailto:${SOCIAL_LINKS.email}`}>
            Get in touch
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
      </div>
    </section>
  );
}
