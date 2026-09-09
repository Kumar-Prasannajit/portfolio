import type { Metadata } from "next";
import { Archivo_Black, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Kumar Prasannajit",
  description:
    "Backend-leaning full-stack developer on the MERN stack — I ship REST APIs, booking platforms and the interfaces that sit on top of them, out of Odisha, India.",
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
      className={`${archivoBlack.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
