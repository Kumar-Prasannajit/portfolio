import type { Metadata } from "next";
import {
  Archivo_Black,
  Bytesized,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
} from "next/font/google";
import "./globals.css";
import { SOCIAL_LINKS } from "@/lib/data";

const SITE_URL = "https://kumarp.in";

const SITE_NAME = "Kumar Prasannajit Sahu";
const SITE_TITLE = "Kumar Prasannajit Sahu | Full-Stack Software Engineer";
const SITE_DESCRIPTION =
  "Portfolio of Kumar Prasannajit Sahu, a Full-Stack Software Engineer specializing in Python, Node.js, and Generative AI Applications (RAG Chatbots).";

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

const bytesized = Bytesized({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bytesized",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "Kumar Prasannajit Sahu",
    "Kumar Prasannajit",
    "Full Stack Developer Hyderabad",
    "AIdeas Tech Solutions",
    "RAG Chatbot developer",
    "Python Engineer",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
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
    "Python",
    "Node.js",
    "React",
    "Next.js",
    "Generative AI",
    "RAG Chatbots",
    "REST APIs",
  ],
  sameAs: [SOCIAL_LINKS.github, SOCIAL_LINKS.linkedin],
};

// Runs before paint to stamp the saved theme, avoiding a flash of the wrong palette.
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivoBlack.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} ${bytesized.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(PERSON_JSON_LD).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
