// Reusable terminal-window chrome — the same three-dot header used by
// About.tsx's whoami block, but for free-form output lines instead of a
// fixed k/v grid. Used by the empty states on /gallery, /specs and
// /places so "nothing here yet" reads as an intentional joke instead of
// a broken page.
export type TermLine = { text: string; tone?: "prompt" | "muted" };

export default function TermWindow({
  path,
  lines,
}: {
  path: string;
  lines: TermLine[];
}) {
  return (
    <div className="term-card">
      <div className="term-head">
        <span className="tdot"></span>
        <span className="tdot"></span>
        <span className="tdot"></span>
        <span className="path mono">{path}</span>
      </div>
      <div className="term-body">
        {lines.map((line, i) => (
          <div
            className={`term-line${line.tone === "prompt" ? " term-line-prompt" : ""}`}
            key={i}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
