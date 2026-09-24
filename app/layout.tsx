import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Archivo_Black, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { SOCIAL_LINKS } from "@/lib/data";
import {
  FEED_ALTERNATES,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import CustomCursor from "@/components/CustomCursor";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import HomeShell from "@/components/HomeShell";
import IdentityPanel from "@/components/IdentityPanel";
import Projects from "@/components/Projects";
import CommandPalette from "@/components/CommandPalette";
import { CommandPaletteProvider } from "@/components/CommandPaletteContext";
import MotionProvider from "@/components/MotionProvider";
import ViewCounter from "@/components/ViewCounter";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo-black",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

// Browser chrome colour: white in the light theme, the page red otherwise
// (dark is the default, matching globals.css).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { color: "#ff5757" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  alternates: { types: FEED_ALTERNATES },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

// Person schema: ties this domain to Kumar's real identity, job title and
// location so Google can surface a rich result for searches on his name.
const PERSON_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE_NAME,
  url: SITE_URL,
  jobTitle: "Junior Software Engineer",
  description: SITE_DESCRIPTION,
  worksFor: {
    "@type": "Organization",
    name: "Aideas Tech Solutions Pvt. Ltd.",
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Hyderabad",
    addressRegion: "Telangana",
    addressCountry: "IN",
  },
  alumniOf: {
    "@type": "CollegeOrUniversity",
    name: "GIET University",
  },
  knowsAbout: [
    "React",
    "Next.js",
    "Node.js",
    "Express",
    "MongoDB",
    "PostgreSQL",
    "Redis",
    "REST APIs",
    "RAG",
    "LLM integration",
    "Generative AI",
    "AI agents",
  ],
  sameAs: [SOCIAL_LINKS.github, SOCIAL_LINKS.linkedin],
};

// Runs before paint to stamp the saved theme, avoiding a flash of the wrong
// palette. The server can't know localStorage, so <html> below carries
// suppressHydrationWarning: this attribute is the one intended difference
// between server and client HTML (the same approach next-themes takes).
const THEME_INIT_SCRIPT = `
(function(){
  try{
    var saved = localStorage.getItem('kps-theme');
    if(saved === 'light' || saved === 'dark'){
      document.documentElement.setAttribute('data-theme', saved);
    }
  }catch(e){}
})();
`;

// Decides, before first paint, whether the boot overlay (components/Boot.tsx)
// should be skipped: on repeat visits in this tab's session, when the visitor
// asked for reduced motion, or when they landed somewhere other than the home
// page (the boot leads into the hero, so it only makes sense there — landing
// elsewhere counts as having seen it). data-boot="done" hides the overlay in
// CSS, so it never renders at all rather than flashing and disappearing.
const BOOT_INIT_SCRIPT = `
(function(){
  try{
    var d = document.documentElement;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){ d.setAttribute('data-boot','done'); return; }
    if(sessionStorage.getItem('kps-booted')){ d.setAttribute('data-boot','done'); return; }
    if(location.pathname !== '/'){ sessionStorage.setItem('kps-booted','1'); d.setAttribute('data-boot','done'); }
  }catch(e){}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivoBlack.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: BOOT_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(PERSON_JSON_LD).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <a className="skip-link" href="#main" data-skip-link="">
          Skip to content
        </a>
        <MotionProvider>
        <CommandPaletteProvider>
          <div className="site-frame" id="top">
            <Nav />
            {/* The side panels live here, not in the pages, so they stay
                mounted (clock, viewers, the drifting project rail) while only
                the middle column changes between routes. */}
            <HomeShell
              left={<IdentityPanel />}
              right={<Projects />}
              rightClone={<Projects decorative />}
            >
              {children}
            </HomeShell>
            <Footer />
          </div>
          <CommandPalette />
        </CommandPaletteProvider>
        </MotionProvider>
        <CustomCursor />
        <ViewCounter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
