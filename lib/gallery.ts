// Filesystem-backed lister for /public/gallery, same spirit as
// lib/content.ts's blog/weekly readers: drop image files in the folder
// and they show up, no data file to hand-maintain. Server-only (uses
// `fs`) — never import this from a "use client" component.

import fs from "node:fs";
import path from "node:path";

const GALLERY_DIR = path.join(process.cwd(), "public", "gallery");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

export type GalleryImage = { src: string; alt: string };

export function getGalleryImages(): GalleryImage[] {
  if (!fs.existsSync(GALLERY_DIR)) return [];
  return fs
    .readdirSync(GALLERY_DIR)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort()
    .map((name) => ({
      src: `/gallery/${name}`,
      alt: path.parse(name).name.replace(/[-_]/g, " "),
    }));
}
