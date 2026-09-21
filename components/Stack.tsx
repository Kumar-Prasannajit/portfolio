import { RevealGroup, RevealItem } from "./Reveal";
import { STACK_GROUPS } from "@/lib/data";

export default function Stack() {
  return (
    <section className="section band alt" id="stack">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">001</span> Stack
        </div>
        <h2 className="h2">Tools I reach for</h2>
        <div style={{ height: 28 }}></div>

        <RevealGroup stagger={0.12}>
        {STACK_GROUPS.map((group) => (
          <RevealItem className="stack-group" key={group.label}>
            <div className="stack-label">{group.label}</div>
            <div className="pill-row">
              {group.items.map((item) => (
                <span className="pill" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </RevealItem>
        ))}
        </RevealGroup>
      </div>
    </section>
  );
}
