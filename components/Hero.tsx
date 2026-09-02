import { profile, social } from "@/lib/data";
import RidgeRunner from "@/components/RidgeRunnerLoader";

export default function Hero() {
  return (
    <section id="top" className="mx-auto max-w-6xl px-5 pt-14 pb-8 sm:px-8 sm:pt-20">
      <p className="font-pixel text-[10px] tracking-widest text-amber">NOW ENTERING</p>
      <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] text-paper sm:text-6xl">
        {profile.name}
      </h1>
      <p className="mt-3 font-display text-lg font-medium text-ember sm:text-xl">
        {profile.role}
      </p>
      <p className="mt-5 max-w-[38rem] font-body text-base leading-relaxed text-muted sm:text-lg">
        {profile.bio}
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <a
          href="#contact"
          className="rounded-lg bg-ember px-5 py-2.5 font-body text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
        >
          Get in touch
        </a>
        <a
          href={social.resume}
          className="rounded-lg border border-panel-line bg-panel px-5 py-2.5 font-body text-sm font-semibold text-paper transition-transform hover:-translate-y-0.5"
        >
          Resume
        </a>
      </div>

      <div className="mt-10">
        <RidgeRunner />
        <p className="mt-3 font-body text-xs text-muted">
          Walk the ridge — arrow keys, WASD, or space to jump. Collect the stack along the way.
        </p>
      </div>
    </section>
  );
}
