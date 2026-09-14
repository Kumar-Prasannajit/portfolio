"use client";

// Actual react-pdf/pdfjs code — only ever loaded on the client via
// ResumeViewerLoader's next/dynamic(..., { ssr: false }), since pdfjs
// depends on browser-only APIs (canvas, DOMMatrix) that don't exist
// during server rendering.

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { SOCIAL_LINKS } from "@/lib/data";
import styles from "./ResumeViewer.module.css";

// Per react-pdf's own docs, this MUST be set in the same module that
// renders <Document>/<Page> — setting it elsewhere risks another
// module's import order silently overwriting it back to the default.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.15;
const DEFAULT_SCALE = 1.2;

export default function ResumeViewer() {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [failed, setFailed] = useState(false);

  function zoomIn() {
    setScale((s) => Math.min(MAX_SCALE, Math.round((s + SCALE_STEP) * 100) / 100));
  }
  function zoomOut() {
    setScale((s) => Math.max(MIN_SCALE, Math.round((s - SCALE_STEP) * 100) / 100));
  }
  function resetZoom() {
    setScale(DEFAULT_SCALE);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.zoomGroup}>
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <span className={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
        </div>
        <button type="button" className="btn btn-ghost" onClick={resetZoom}>
          Reset
        </button>
        <div className={styles.spacer} />
        <a
          className="btn btn-ghost"
          href={SOCIAL_LINKS.resume}
          target="_blank"
          rel="noopener"
        >
          Open in new tab
        </a>
        <a className="btn btn-primary" href={SOCIAL_LINKS.resume} download>
          Download
        </a>
      </div>

      <div className={styles.viewport}>
        {failed ? (
          <p className={`${styles.status} ${styles.errorStatus}`}>
            Couldn&apos;t load the PDF preview.{" "}
            <a href={SOCIAL_LINKS.resume} target="_blank" rel="noopener">
              Open it directly
            </a>{" "}
            instead.
          </p>
        ) : (
          <Document
            file={SOCIAL_LINKS.resume}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setFailed(true)}
            loading={<p className={styles.status}>Loading resume…</p>}
          >
            {Array.from({ length: numPages ?? 0 }, (_, index) => (
              <Page
                key={index}
                pageNumber={index + 1}
                scale={scale}
                className={styles.page}
              />
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
