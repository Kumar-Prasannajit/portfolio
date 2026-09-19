import type { Metadata } from "next";
import { SPECS_GROUPS } from "@/lib/data";
import TermWindow from "@/components/TermWindow";

export const metadata: Metadata = {
  title: "Specs | Kumar Prasannajit Sahu",
  description: "The hardware and software keeping the bugs alive.",
};

export default function SpecsPage() {
  return (
    <main>
      <section className="section band">
        <div className="wrap">
          <div className="eyebrow">
            <span className="idx">—</span> Specs
          </div>
          <h1 className="h2">The rig</h1>
          <p className="page-intro">
            What&apos;s actually running when the terminal says
            &ldquo;command not found&rdquo;.
          </p>

          {SPECS_GROUPS.length === 0 ? (
            <TermWindow
              path="~/kumar/specs.sh"
              lines={[
                { text: "$ cat specs.md", tone: "prompt" },
                { text: "cat: specs.md: No such file or directory" },
                { text: "(still deciding between two monitors and vibes.)" },
              ]}
            />
          ) : (
            SPECS_GROUPS.map((group) => (
              <div className="stack-group" key={group.label}>
                <div className="stack-label">{group.label}</div>
                <div className="pill-row">
                  {group.items.map((item) => (
                    <span className="pill" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
