import { stack } from "@/lib/data";
import SectionHeading from "@/components/SectionHeading";

export default function TechStack() {
  return (
    <section id="stack" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHeading eyebrow="TOOLBOX" title="Tech Stack" />

      <ul className="mt-8 flex flex-wrap gap-2.5">
        {stack.map((tech) => (
          <li
            key={tech}
            className="rounded-full border border-panel-line bg-violet-deep/60 px-3.5 py-1.5 font-body text-sm text-paper"
          >
            {tech}
          </li>
        ))}
      </ul>
    </section>
  );
}
