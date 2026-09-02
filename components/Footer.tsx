import { profile, social } from "@/lib/data";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className="border-t border-panel-line bg-violet-deep/40">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-xl font-bold text-paper">
              {profile.name}
            </p>
            <p className="mt-2 max-w-xs font-body text-sm text-muted">
              {profile.tagline}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex items-center gap-4">
              {/* TODO(kumar): swap these placeholder hrefs for your real profiles. */}
              <a
                href={social.github}
                aria-label="GitHub"
                className="rounded-md p-2 text-muted transition-colors hover:text-ember"
              >
                <GithubIcon />
              </a>
              <a
                href={social.linkedin}
                aria-label="LinkedIn"
                className="rounded-md p-2 text-muted transition-colors hover:text-ember"
              >
                <LinkedinIcon />
              </a>
              <a
                href={social.resume}
                aria-label="Download resume PDF"
                className="rounded-md p-2 text-muted transition-colors hover:text-ember"
              >
                <ResumeIcon />
              </a>
            </div>
            <a
              href="mailto:hello@example.com"
              className="font-body text-sm text-muted underline decoration-panel-line underline-offset-4 transition-colors hover:text-paper"
            >
              {/* TODO(kumar): replace with your real contact email. */}
              hello@example.com
            </a>
          </div>
        </div>

        <p className="mt-10 border-t border-panel-line pt-6 font-body text-xs text-muted">
          © {year} {profile.fullName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.77.12 3.06.74.8 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.27 5.67.42.36.78 1.06.78 2.15 0 1.55-.02 2.8-.02 3.18 0 .32.21.67.8.56A10.52 10.52 0 0 0 23.5 12c0-6.27-5.23-11.5-11.5-11.5Z" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S.02 4.88.02 3.5 1.13 1 2.5 1s2.48 1.12 2.48 2.5ZM.5 8.5h4V23h-4V8.5Zm7.5 0h3.83v1.98h.05c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.14V23h-4v-6.5c0-1.55-.03-3.55-2.16-3.55-2.17 0-2.5 1.69-2.5 3.44V23h-4V8.5Z" />
    </svg>
  );
}

function ResumeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M9 15h6M9 11h3" />
    </svg>
  );
}
