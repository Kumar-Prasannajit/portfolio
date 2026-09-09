import { IconExternalLink } from "./icons";
import { GH_COUNTS, GH_START, SOCIAL_LINKS } from "@/lib/data";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function levelFor(count: number) {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

function heatVar(level: number) {
  return `var(--heat-${level})`;
}

type Cell = {
  key: string;
  background: string;
  title?: string;
  hidden: boolean;
};

type Week = {
  key: string;
  monthLabel: string;
  cells: Cell[];
};

function buildWeeks(): Week[] {
  const startDate = new Date(GH_START + "T00:00:00Z");
  const numWeeks = Math.ceil(GH_COUNTS.length / 7);
  let lastMonthLabeled = -1;
  const weeks: Week[] = [];

  for (let w = 0; w < numWeeks; w++) {
    const weekFirstDate = new Date(
      startDate.getTime() + w * 7 * 24 * 3600 * 1000
    );
    const m = weekFirstDate.getUTCMonth();
    let monthLabel = "";
    if (m !== lastMonthLabeled && weekFirstDate.getUTCDate() <= 7) {
      monthLabel = MONTH_NAMES[m];
      lastMonthLabeled = m;
    }

    const cells: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d;
      if (idx < GH_COUNTS.length) {
        const count = GH_COUNTS[idx];
        const lvl = levelFor(count);
        const cellDate = new Date(
          startDate.getTime() + idx * 24 * 3600 * 1000
        );
        cells.push({
          key: `${w}-${d}`,
          background: heatVar(lvl),
          title: `${cellDate.toISOString().slice(0, 10)} — ${count} contribution${count === 1 ? "" : "s"}`,
          hidden: false,
        });
      } else {
        cells.push({
          key: `${w}-${d}`,
          background: heatVar(0),
          hidden: true,
        });
      }
    }

    weeks.push({ key: `w${w}`, monthLabel, cells });
  }

  return weeks;
}

export default function GithubHeatmap() {
  const weeks = buildWeeks();
  const total = GH_COUNTS.reduce((a, b) => a + b, 0);

  return (
    <section className="section band" id="activity">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">05</span> Activity
        </div>
        <h2 className="h2">Shipping log</h2>
        <div style={{ height: 28 }}></div>
        <div className="gh-card">
          <div className="gh-top">
            <div className="gh-total">
              <span>{total.toLocaleString("en-US")}</span> contributions in
              the last year
            </div>
            <a
              className="gh-link"
              href={SOCIAL_LINKS.github}
              target="_blank"
              rel="noopener"
            >
              github.com/Kumar-Prasannajit
              <IconExternalLink />
            </a>
          </div>
          <div className="gh-scroll">
            <div className="gh-grid-wrap">
              <div className="gh-months mono">
                {weeks.map((week) => (
                  <span key={week.key}>{week.monthLabel}</span>
                ))}
              </div>
              <div className="gh-body">
                <div className="gh-daylabels mono">
                  <span></span>
                  <span>Mon</span>
                  <span></span>
                  <span>Wed</span>
                  <span></span>
                  <span>Fri</span>
                  <span></span>
                </div>
                <div className="gh-weeks">
                  {weeks.map((week) => (
                    <div className="gh-week" key={week.key}>
                      {week.cells.map((cell) => (
                        <div
                          className="gh-cell"
                          key={cell.key}
                          style={
                            cell.hidden
                              ? { visibility: "hidden" }
                              : { background: cell.background }
                          }
                          title={cell.title}
                        ></div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="gh-legend">
            Less
            <span className="gh-cell" style={{ background: "var(--heat-0)" }}></span>
            <span className="gh-cell" style={{ background: "var(--heat-1)" }}></span>
            <span className="gh-cell" style={{ background: "var(--heat-2)" }}></span>
            <span className="gh-cell" style={{ background: "var(--heat-3)" }}></span>
            <span className="gh-cell" style={{ background: "var(--heat-4)" }}></span>
            More
          </div>
        </div>
      </div>
    </section>
  );
}
