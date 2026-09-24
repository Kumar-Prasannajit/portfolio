import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import ResumeViewerLoader from "@/components/ResumeViewerLoader";

export const metadata: Metadata = pageMetadata({
  title: "Resume | Kumar Prasannajit Sahu",
  description: "Kumar Prasannajit Sahu's resume, viewable inline or as a download.",
  path: "/resume",
});

export default function ResumePage() {
  return (
    <>
      <section className="section band">
        <div className="wrap">
          <div className="eyebrow">
            <span className="idx">—</span> Resume
          </div>
          <h1 className="h2">Resume</h1>
          <div style={{ height: 28 }} />
          <ResumeViewerLoader />
        </div>
      </section>
    </>
  );
}
