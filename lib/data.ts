// Central content store. Real facts about Kumar live here — components just render it.

export const profile = {
  name: "Kumar Sahu",
  fullName: "Kumar Prasannajit Sahu",
  role: "Full Stack Developer",
  bio: "Full Stack Developer who enjoys building products from idea to deployment. I love creating beautiful user experiences on the frontend, designing scalable backend systems, and exploring how AI can make software smarter. Currently focused on Backend Development, Generative AI, and DevOps.",
  // Longer, standalone bio for the About section — Kumar's own words, kept verbatim.
  aboutBio:
    "I'm a Full Stack Developer who enjoys building products from idea to deployment. I love creating beautiful user experiences on the frontend, designing scalable backend systems, and exploring how AI can make software smarter. My current focus is on Backend Development, Generative AI, and DevOps, with a goal of building reliable, production-ready applications that solve real-world problems. When I'm not coding, I'm usually learning something new, optimizing something that didn't need optimization, or turning coffee into commits.",
  tagline: "Turning coffee into commits.",
};

export const stack = [
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Node.js",
  "Express",
  "Python",
  "Django",
  "PostgreSQL",
  "Redis",
  "Docker",
  "Tailwind CSS",
  "Linux",
] as const;

// The 6 collectibles placed along the RidgeRunner hero game's ridge.
export const gameStack = ["TypeScript", "React", "Next", "Node", "Postgres", "Docker"] as const;

export type Experience = {
  role: string;
  company: string;
  location: string;
  period: string;
  highlights: string[];
};

export const experience: Experience[] = [
  {
    role: "Junior Software Engineer",
    company: "Aideas Tech Solutions Pvt. Ltd.",
    location: "Hyderabad",
    period: "Sep 2025 – Present",
    highlights: [
      "Built 10+ reusable React components, cutting UI development time by 30%.",
      "Integrated 5+ REST APIs, lowering page-load latency by 40%.",
    ],
  },
  {
    role: "Full Stack Developer Intern",
    company: "Navgyan Innovations Pvt. Ltd.",
    location: "Gunupur",
    period: "Mar 2025 – Aug 2025",
    highlights: [
      "Built 3 responsive web apps serving 200+ users.",
      "Introduced Git workflows for a 5-person team, cutting merge conflicts by 60%.",
    ],
  },
];

export type Project = {
  title: string;
  description: string;
  stackTags: string[];
  links: { label: string; href: string }[];
};

export const projects: Project[] = [
  {
    title: "Manima Online",
    description:
      "Multi-role spiritual-services marketplace (admins, clients, agents) managing the full booking lifecycle, with Razorpay/UPI payments backed by server-side validation and idempotent payment handling.",
    stackTags: ["React", "Node.js", "Express", "MongoDB", "JWT", "Razorpay"],
    // TODO(kumar): replace with the live URL.
    links: [{ label: "Live platform", href: "#manima-online" }],
  },
  {
    title: "NIPL Website",
    description:
      "Official site for Navgyan Innovations — interactive particle backgrounds, smooth scrolling, and responsive sliders/carousels.",
    stackTags: ["HTML", "CSS", "JavaScript", "Particle.js", "Lenis", "Swiper.js"],
    // TODO(kumar): replace with the live URL.
    links: [{ label: "Live site", href: "#nipl-website" }],
  },
  {
    title: "GIET E-YUVA Center",
    description:
      "Official site for the BIRAC E-YUVA Center at GIET University — programmes, projects, events, and publications.",
    stackTags: ["Next.js", "React", "TypeScript"],
    // TODO(kumar): replace with the live URL.
    links: [{ label: "Live site", href: "#giet-eyuva" }],
  },
  {
    title: "Node.js RAG Chatbot",
    description:
      "Document-grounded chatbot that ingests PDFs, retrieves passages via vector search, and answers with cited context.",
    stackTags: ["Node.js", "Express", "PostgreSQL", "pgvector", "Gemini Embeddings", "Groq", "Docker"],
    // TODO(kumar): replace with the repo URL.
    links: [{ label: "Source", href: "#rag-chatbot" }],
  },
  {
    title: "Employee Management Dashboard",
    description:
      "Dashboard for employee metrics, CRUD records, and hiring stats.",
    stackTags: ["React", "Vite", "Redux Toolkit", "Tailwind CSS", "React Router", "MockAPI"],
    // TODO(kumar): replace with the live URL and repo URL.
    links: [
      { label: "Live site", href: "#employee-dashboard" },
      { label: "Source", href: "#employee-dashboard-source" },
    ],
  },
];

// TODO(kumar): fill in your real LinkedIn URL and drop your resume PDF into
// /public/resume.pdf (the filename the "Resume" links below already point at).
export const social = {
  github: "https://github.com/Kumar-Prasannajit",
  linkedin: "#linkedin",
  resume: "/resume.pdf",
};

export type GalleryItem = {
  title: string;
  date: string;
  gradient: string;
};

// TODO(kumar): these are CSS-gradient placeholder tiles. To swap in real photos:
//   1. Drop image files into /public/gallery (e.g. /public/gallery/hackathon.jpg).
//   2. In components/Gallery.tsx, replace the gradient <div> for that tile with
//      <Image src="/gallery/hackathon.jpg" alt="…" fill className="object-cover" />
//      (import Image from "next/image"; the tile wrapper already has `relative`).
//   3. Update the title/date strings below to match.
export const gallery: GalleryItem[] = [
  { title: "Hackathon Weekend", date: "2025", gradient: "from-[var(--ember)] via-[var(--violet-mid)] to-[var(--ink)]" },
  { title: "Campus Tech Fest", date: "2025", gradient: "from-[var(--amber)] via-[var(--violet-deep)] to-[var(--ink)]" },
  { title: "Team Offsite", date: "2025", gradient: "from-[var(--mint)] via-[var(--violet-mid)] to-[var(--ink)]" },
  { title: "Late-Night Deploy", date: "2025", gradient: "from-[var(--violet-mid)] via-[var(--ember)] to-[var(--ink)]" },
  { title: "Conference Talk", date: "2024", gradient: "from-[var(--panel)] via-[var(--amber)] to-[var(--violet-deep)]" },
  { title: "Whiteboard Session", date: "2024", gradient: "from-[var(--violet-deep)] via-[var(--mint)] to-[var(--ink)]" },
  { title: "Demo Day", date: "2024", gradient: "from-[var(--ember)] via-[var(--panel)] to-[var(--violet-mid)]" },
  { title: "First Commit", date: "2024", gradient: "from-[var(--amber)] via-[var(--violet-mid)] to-[var(--panel)]" },
];

export type Track = {
  title: string;
  artist: string;
  swatch: string;
};

// TODO(kumar): these are placeholder sample tracks. Two ways to make this real:
//   a) Spotify's official embed iframe for a playlist — no backend required,
//      keeps Spotify's own player UI. Drop it in place of NowPlaying's list:
//      <iframe src="https://open.spotify.com/embed/playlist/<id>" ... />
//   b) Spotify Web API (currently-playing / top-tracks endpoints) via a small
//      serverless route in app/api/now-playing/route.ts. Refresh the OAuth
//      token server-side, cache the response client-side for ~1-2 minutes,
//      and fall back to this static `tracks` array if the request fails.
export const tracks: Track[] = [
  { title: "Turning Coffee Into Commits", artist: "Sample Artist", swatch: "from-[var(--ember)] to-[var(--amber)]" },
  { title: "Merge Conflict Blues", artist: "Sample Artist", swatch: "from-[var(--violet-mid)] to-[var(--mint)]" },
  { title: "localhost:3000", artist: "Sample Artist", swatch: "from-[var(--amber)] to-[var(--violet-deep)]" },
  { title: "Late Night Deploy", artist: "Sample Artist", swatch: "from-[var(--mint)] to-[var(--violet-mid)]" },
];

export type OpenSourceItem = {
  title: string;
  repo: string;
  state: "merged" | "open" | "closed";
  url: string;
};

// Fallback shown by components/OpenSource.tsx only if the live GitHub search
// API call fails or returns no results (same "never render empty" pattern as
// the sample `tracks` above) — these are placeholders, not real PRs.
export const openSourceFallback: OpenSourceItem[] = [
  { title: "Sample: recent activity will appear here", repo: "sample-org/sample-repo", state: "open", url: "#" },
  { title: "Sample: once the GitHub API is reachable", repo: "sample-org/sample-repo", state: "merged", url: "#" },
];
