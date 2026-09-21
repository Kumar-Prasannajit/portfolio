import type { Metadata } from "next";
import Image from "next/image";
import { getGalleryImages } from "@/lib/gallery";
import TermWindow from "@/components/TermWindow";

export const metadata: Metadata = {
  title: "Gallery | Kumar Prasannajit Sahu",
  description: "A gallery of stuff that isn't a terminal window, allegedly.",
};

export default function GalleryPage() {
  const images = getGalleryImages();

  return (
    <main id="main" tabIndex={-1}>
      <section className="section band">
        <div className="wrap">
          <div className="eyebrow">
            <span className="idx">—</span> Gallery
          </div>
          <h1 className="h2">Proof I touch grass sometimes</h1>
          <p className="page-intro">
            No stock photos, no LinkedIn-core headshots — just whatever
            made the camera roll cut.
          </p>

          {images.length === 0 ? (
            <TermWindow
              path="~/kumar/gallery"
              lines={[
                { text: "$ ls gallery/", tone: "prompt" },
                { text: "ls: gallery/: empty — camera roll's all memes, none postable yet." },
                { text: "check back later, or drop files in /public/gallery." },
              ]}
            />
          ) : (
            <div className="gallery-grid">
              {images.map((image) => (
                <div className="gallery-item" key={image.src}>
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 520px) 100vw, (max-width: 820px) 50vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
