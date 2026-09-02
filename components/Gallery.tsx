import { gallery } from "@/lib/data";
import SectionHeading from "@/components/SectionHeading";

// TODO(kumar): these tiles render CSS-gradient placeholders. See the
// documented swap-in pattern for real photos at the top of lib/data.ts
// (gallery items) — drop files into /public/gallery and replace the
// gradient <div> below with a next/image <Image fill> per tile.
export default function Gallery() {
  return (
    <section id="gallery" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHeading eyebrow="SNAPSHOTS" title="Gallery" />

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {gallery.map((item) => (
          <figure
            key={item.title}
            className="overflow-hidden rounded-xl border border-panel-line bg-panel"
          >
            <div
              className={`relative aspect-square w-full bg-gradient-to-br ${item.gradient}`}
              role="img"
              aria-label={`${item.title}, ${item.date} — placeholder gradient tile`}
            />
            <figcaption className="p-3">
              <p className="font-body text-sm font-semibold text-paper">
                {item.title}
              </p>
              <p className="font-body text-xs text-muted">{item.date}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
