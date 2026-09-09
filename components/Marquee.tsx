import { MARQUEE_ITEMS } from "@/lib/data";

export default function Marquee() {
  // Duplicated once so the CSS animation (translateX(-50%)) loops seamlessly.
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="marquee-band" aria-hidden="true">
      <div className="marquee-clip">
        <div className="marquee-track mono">
          {items.map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
