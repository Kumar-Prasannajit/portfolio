// Filesystem-backed lister for /public/gallery, same spirit as
// lib/content.ts's blog/weekly readers: drop image files in the folder
// and they show up, no data file to hand-maintain. Server-only (uses
// `fs`) — never import this from a "use client" component.

import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";

const GALLERY_DIR = path.join(process.cwd(), "public", "gallery");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

// width/height are the intrinsic pixel size, read from the file header so
// the page can show each photo uncropped without layout shift.
export type GalleryImage = { src: string; alt: string; width: number; height: number };

export function getGalleryImages(): GalleryImage[] {
  if (!fs.existsSync(GALLERY_DIR)) return [];
  return fs
    .readdirSync(GALLERY_DIR)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort()
    .map((name) => {
      const size = imageSize(fs.readFileSync(path.join(GALLERY_DIR, name)));
      // EXIF orientations 5-8 are rotated 90°, so the displayed size is swapped.
      const rotated = (size.orientation ?? 1) >= 5;
      return {
        src: `/gallery/${name}`,
        alt: path.parse(name).name.replace(/[-_]/g, " "),
        width: rotated ? size.height : size.width,
        height: rotated ? size.width : size.height,
      };
    });
}
