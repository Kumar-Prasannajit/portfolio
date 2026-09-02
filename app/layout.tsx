import type { Metadata } from "next";
import { Unbounded, Manrope, Press_Start_2P } from "next/font/google";
import "./globals.css";

const unbounded = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: "400",
});

// TODO(kumar): swap this for your real deployed domain once it's live.
const siteUrl = "https://kumarsahu.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Kumar Sahu — Full Stack Developer",
  description:
    "Portfolio of Kumar Prasannajit Sahu, a Full Stack Developer building products from idea to deployment — frontend experiences, scalable backend systems, and AI-powered software.",
  openGraph: {
    title: "Kumar Sahu — Full Stack Developer",
    description:
      "Portfolio of Kumar Prasannajit Sahu, a Full Stack Developer building products from idea to deployment — frontend experiences, scalable backend systems, and AI-powered software.",
    url: siteUrl,
    siteName: "Kumar Sahu",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kumar Sahu — Full Stack Developer",
    description:
      "Portfolio of Kumar Prasannajit Sahu, a Full Stack Developer building products from idea to deployment.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${unbounded.variable} ${manrope.variable} ${pressStart2P.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-paper font-body">
        {children}
      </body>
    </html>
  );
}
