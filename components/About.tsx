import { profile } from "@/lib/data";
import SectionHeading from "@/components/SectionHeading";

export default function About() {
  return (
    <section id="about" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHeading eyebrow="A BIT MORE" title="About" />

      <div className="mt-8 max-w-[42rem] rounded-xl border border-panel-line bg-panel p-6 sm:p-8">
        <p className="font-body text-base leading-relaxed text-muted sm:text-lg">
          {profile.aboutBio}
        </p>
      </div>
    </section>
  );
}
