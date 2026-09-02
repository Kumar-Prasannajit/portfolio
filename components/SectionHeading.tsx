export default function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="font-pixel text-[10px] tracking-widest text-amber">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-extrabold text-paper sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}
