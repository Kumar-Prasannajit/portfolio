// Rail 3's structural placeholder (docs/redesign-spec.md phase 2 — "layout
// shell... no new content yet"). Fixed top-to-bottom order, per phase 3:
// ASCII block (largest) -> Stats -> theme accordion -> BRUTAL button. Every
// block here is static chrome, sized to prove out the non-scrolling fit at
// a 768px-tall viewport; phase 3 replaces each one's insides with the real
// ambient animation, live data (AniList / GitHub) and an interactive,
// keyboard-operable accordion. Marked aria-hidden as a whole: none of this
// is real content yet, so there's nothing here worth a screen reader's time
// until phase 3 lands.
const STAT_ROWS = [
  { label: "WATCHING" },
  { label: "LAST COMMIT" },
  { label: "UPTIME" },
];

const THEME_NAMES = ["shanks", "zoro", "luffy", "news"];

export default function RailThree() {
  return (
    <div className="rail3" aria-hidden="true">
      <div className="rail3-ascii">
        <span className="rail3-ascii-label mono">ASCII</span>
      </div>

      <div className="rail3-stats">
        {STAT_ROWS.map((row) => (
          <div className="rail3-stat" key={row.label}>
            <span className="rail3-stat-label mono">{row.label}</span>
            <span className="rail3-stat-value mono">—</span>
          </div>
        ))}
      </div>

      <div className="rail3-accordion">
        {THEME_NAMES.map((name) => (
          <div className="rail3-accordion-panel" key={name}>
            <span className="rail3-accordion-label mono">{name}</span>
          </div>
        ))}
      </div>

      <button type="button" className="rail3-brutal" disabled>
        BRUTAL
      </button>
    </div>
  );
}
