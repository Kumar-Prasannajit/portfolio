import { TERM_ROWS } from "@/lib/data";

export default function About() {
  return (
    <section className="section band" id="about">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">01</span> About
        </div>
        <div className="about-grid">
          <div className="about-copy">
            <p>
              I&apos;m a <strong>Full Stack Developer</strong> with a backend
              focus, specializing in the MERN stack — currently a{" "}
              <strong>Junior Software Engineer at Aideas Tech Solutions</strong>{" "}
              in Hyderabad, where I build reusable React components and
              integrate the REST APIs that keep pages fast.
            </p>
            <p>
              Before that I interned at <strong>Navgyan Innovations</strong>{" "}
              in Gunupur, shipping three production web apps and cleaning up a
              five-person team&apos;s Git workflow along the way. I hold a
              <strong> B.Tech in Electronics &amp; Communication Engineering</strong>{" "}
              from GIET University, Odisha.
            </p>
            <p>
              Off the clock, I&apos;m usually working DSA problems in
              JavaScript, tuning a Next.js layout until it feels right, or
              turning coffee into commits.
            </p>
          </div>
          <div className="term-card">
            <div className="term-head">
              <span className="tdot"></span>
              <span className="tdot"></span>
              <span className="tdot"></span>
              <span className="path mono">~/kumar/whoami.sh</span>
            </div>
            <div className="term-body">
              {TERM_ROWS.map((row) => (
                <div className="term-row" key={row.k}>
                  <span className="k">{row.k}</span>
                  <span className="v">{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
