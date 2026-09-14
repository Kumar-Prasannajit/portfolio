"use client";

// `ssr: false` is only valid inside a Client Component (Next.js errors
// if a Server Component tries it) — this tiny wrapper exists purely so
// app/resume/page.tsx can stay a Server Component (it needs to export
// `metadata`) while still keeping all of react-pdf/pdfjs out of the
// server render and the initial client bundle.
import dynamic from "next/dynamic";

const ResumeViewer = dynamic(() => import("./ResumeViewer"), {
  ssr: false,
  loading: () => (
    <p style={{ fontFamily: "var(--font-mono)", color: "var(--ink-faint)" }}>
      Loading resume viewer…
    </p>
  ),
});

export default function ResumeViewerLoader() {
  return <ResumeViewer />;
}
