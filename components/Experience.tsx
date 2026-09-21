import { RevealGroup, RevealItem } from "./Reveal";
import { EXPERIENCE } from "@/lib/data";

export default function Experience() {
  return (
    <section className="section band" id="experience">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">010</span> Experience
        </div>
        <h2 className="h2">Where I&apos;ve worked</h2>
        <div style={{ height: 28 }}></div>
        <RevealGroup className="tl" stagger={0.14}>
          {EXPERIENCE.map((item) => (
            <RevealItem className="tl-item" key={item.role}>
              <div className="tl-top">
                <span className="tl-role">{item.role}</span>
                <span className="tl-date mono">{item.date}</span>
              </div>
              <div className="tl-org">
                {item.org} <span>· {item.location}</span>
              </div>
              <ul className="tl-bullets">
                {item.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
