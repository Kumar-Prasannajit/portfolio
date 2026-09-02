import { getContributionCalendar, GITHUB_USERNAME, type ContributionDay } from "@/lib/github";
import SectionHeading from "@/components/SectionHeading";

// Recolored from GitHub's default green scale to the site's dusk palette:
// empty → a dim panel line, then climbing through violet, ember, to amber
// at the highest activity level.
const LEVEL_CLASS: Record<ContributionDay["level"], string> = {
  0: "bg-panel-line/30",
  1: "bg-violet-mid",
  2: "bg-ember/50",
  3: "bg-ember",
  4: "bg-amber",
};

function buildWeeks(days: ContributionDay[]): (ContributionDay | null)[][] {
  if (days.length === 0) return [];
  const weeks: (ContributionDay | null)[][] = [];
  let week: (ContributionDay | null)[] = [];

  const firstDay = new Date(`${days[0].date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  for (let i = 0; i < firstDay; i++) week.push(null);

  for (const day of days) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

// Deterministic, clearly-placeholder pattern used only if the live GitHub
// contributions API is unreachable — same "never render empty" idea as the
// Open Source fallback, just illustrative rather than real activity.
function buildFallbackDays(): ContributionDay[] {
  const days: ContributionDay[] = [];
  const today = new Date();
  const totalDays = 371;
  for (let i = totalDays - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    const wave = Math.sin(i * 0.35) + Math.sin(i * 0.09) * 1.5;
    const level = Math.min(4, Math.max(0, Math.round(wave + 1))) as 0 | 1 | 2 | 3 | 4;
    days.push({ date: date.toISOString().slice(0, 10), count: level, level });
  }
  return days;
}

export default async function GithubHeatmap() {
  const liveDays = await getContributionCalendar();
  const isFallback = liveDays === null;
  const days = liveDays ?? buildFallbackDays();
  const weeks = buildWeeks(days);
  const total = days.reduce((sum, d) => sum + d.count, 0);

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHeading eyebrow="ON GITHUB" title="Contribution activity" />

      <div className="mt-8 rounded-xl border border-panel-line bg-panel p-6">
        <div className="overflow-x-auto">
          <div
            role="img"
            aria-label={
              isFallback
                ? "GitHub contribution calendar placeholder"
                : `${total} contributions in the last year on GitHub for ${GITHUB_USERNAME}`
            }
            className="flex gap-1"
          >
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) =>
                  day ? (
                    <div
                      key={di}
                      title={`${day.date}: ${day.count} contribution${day.count === 1 ? "" : "s"}`}
                      className={`h-2.5 w-2.5 rounded-sm ${LEVEL_CLASS[day.level]}`}
                    />
                  ) : (
                    <div key={di} className="h-2.5 w-2.5" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 font-body text-xs text-muted">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span key={level} className={`h-2.5 w-2.5 rounded-sm ${LEVEL_CLASS[level]}`} />
          ))}
          <span>More</span>
        </div>

        {isFallback && (
          <p className="mt-3 font-body text-xs text-muted">
            Showing a placeholder pattern — live GitHub data wasn&apos;t reachable just now.
          </p>
        )}
      </div>
    </section>
  );
}
