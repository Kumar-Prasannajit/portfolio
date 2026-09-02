import { experience } from "@/lib/data";
import SectionHeading from "@/components/SectionHeading";

export default function Experience() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHeading eyebrow="THE PATH SO FAR" title="Experience" />

      <ol className="mt-8 space-y-6 border-l border-panel-line pl-6 sm:pl-8">
        {experience.map((role) => (
          <li key={role.role + role.company} className="relative">
            <span
              className="absolute -left-[1.85rem] top-1.5 h-2.5 w-2.5 rounded-full bg-ember sm:-left-[2.35rem]"
              aria-hidden="true"
            />
            <p className="font-pixel text-[9px] tracking-widest text-amber">
              {role.period}
            </p>
            <h3 className="mt-2 font-display text-lg font-bold text-paper">
              {role.role}
            </h3>
            <p className="mt-0.5 font-body text-sm text-muted">
              {role.company} · {role.location}
            </p>
            <ul className="mt-3 space-y-1.5">
              {role.highlights.map((h) => (
                <li
                  key={h}
                  className="font-body text-sm leading-relaxed text-muted before:mr-2 before:text-mint before:content-['▹']"
                >
                  {h}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
