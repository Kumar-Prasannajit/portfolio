export const NAV_LINKS = [
  { href: "#about", label: "About" },
  { href: "#stack", label: "Stack" },
  { href: "#experience", label: "Experience" },
  { href: "#work", label: "Work" },
  { href: "#contact", label: "Contact" },
] as const;

export const SOCIAL_LINKS = {
  github: "https://github.com/Kumar-Prasannajit",
  linkedin: "https://www.linkedin.com/in/kumar-prasannajit-sahu",
  email: "kumarprasannajitsahu@gmail.com",
} as const;

export const TERM_ROWS = [
  { k: "NAME", v: "Kumar Prasannajit Sahu" },
  { k: "ROLE", v: "Full Stack Developer — backend focus" },
  { k: "STACK", v: "MongoDB · Express · React · Node" },
  { k: "NOW", v: "Aideas Tech Solutions, Hyderabad" },
  { k: "BASED", v: "Odisha, India" },
  { k: "DEGREE", v: "B.Tech ECE, GIET University" },
] as const;

export const STACK_GROUPS = [
  {
    label: "Languages & Frontend",
    items: ["JavaScript", "TypeScript", "React", "Next.js", "Tailwind CSS"],
  },
  {
    label: "Backend & APIs",
    items: ["Node.js", "Express.js", "REST APIs", "JWT Auth"],
  },
  {
    label: "Data & Infra",
    items: ["MongoDB", "PostgreSQL", "Redis", "Docker"],
  },
  {
    label: "Tooling & Payments",
    items: ["Git & GitHub", "Razorpay", "Vercel", "Postman"],
  },
] as const;

export const EXPERIENCE = [
  {
    role: "Junior Software Engineer",
    date: "SEP 2025 — PRESENT",
    org: "Aideas Tech Solutions Pvt. Ltd.",
    location: "Hyderabad, India",
    bullets: [
      "Built 10+ reusable React components, improving cross-device consistency and cutting UI development time by 30%.",
      "Integrated 5+ REST APIs with async JavaScript, reducing average page-load latency by 40%.",
    ],
  },
  {
    role: "Full Stack Developer Intern",
    date: "MAR 2025 — AUG 2025",
    org: "Navgyan Innovations Pvt. Ltd.",
    location: "Gunupur, India",
    bullets: [
      "Developed and maintained three responsive web applications serving 200+ users.",
      "Introduced structured Git workflows for a five-member team, cutting merge conflicts by 60% and improving deployment efficiency.",
    ],
  },
] as const;

export type ProjectLink = { label: string; href: string };

export const PROJECTS = [
  {
    title: "Manima Online",
    badge: "LIVE",
    description:
      "A multi-role spiritual-services marketplace for administrators, clients and agents, covering the complete service-booking lifecycle — with secure Razorpay and QR/UPI payments, server-side validation, idempotent payment handling, and CI/CD via GitHub Actions.",
    tags: ["React", "Node.js", "Express", "MongoDB", "JWT", "Razorpay"],
    links: [
      { label: "Live platform", href: "https://manimaonline.com/" },
    ] satisfies ProjectLink[],
  },
  {
    title: "BIRAC E-YUVA Center",
    badge: "LIVE",
    description:
      "Official site for the BIRAC E-YUVA Center at GIET University — a biotech innovation and entrepreneurship hub. Built section by section: a CSS 3D DNA-helix hero, a lightbox gallery, and a theme context for dark/light mode.",
    tags: ["Next.js", "React", "TypeScript", "Tailwind CSS"],
    links: [
      {
        label: "Live site",
        href: "https://giet-eyuva-center-999itzgca-e-yuva-giet.vercel.app/",
      },
      {
        label: "Source",
        href: "https://github.com/Kumar-Prasannajit/giet-eyuva-center",
      },
    ] satisfies ProjectLink[],
  },
  {
    title: "NIPL Website",
    badge: "LIVE",
    description:
      "The official website for Navgyan Innovations Pvt. Ltd. — an engaging, responsive presentation of the startup, with particle-field backgrounds, Lenis smooth scrolling and Swiper-powered sliders.",
    tags: ["HTML", "CSS", "JavaScript", "Particle.js", "Lenis", "Swiper.js"],
    links: [
      {
        label: "Live site",
        href: "https://kumar-prasannajit.github.io/NIPL-Website/",
      },
      {
        label: "Source",
        href: "https://github.com/Kumar-Prasannajit/NIPL-Website",
      },
    ] satisfies ProjectLink[],
  },
] as const;

export const MARQUEE_ITEMS = [
  "MERN STACK",
  "REACT · NODE.JS · EXPRESS · MONGODB",
  "01001011 01010000 01010011",
  "POSTGRESQL · REDIS · TAILWIND",
  "BACKEND-LEANING FULL-STACK",
  "BUILT IN ODISHA, INDIA",
] as const;

export const HERO_BINARY = "01001011 01010000 01010011 01000100 01000101 01010110";

/* ---------- GitHub contributions heatmap (static snapshot) ---------- */
export const GH_START = "2025-08-31";
export const GH_COUNTS: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 0, 9, 0,
  0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 4, 3, 2, 0, 0, 1, 1, 0, 0, 0,
  0, 0, 0, 1, 3, 1, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0,
  0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 1, 0, 2, 0,
  0, 0, 0, 0, 3, 5, 0, 6, 16, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 3, 1, 3, 3, 5, 0, 0, 2, 2, 7,
  1, 2, 0, 0, 3, 0, 0, 0, 0, 6, 0, 2, 0, 0, 1, 0, 2, 0, 1, 2,
  0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 9, 0, 0, 4, 6, 0, 0, 0, 0, 0, 6, 0,
  4, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0,
  0, 2, 6, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0,
  0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 8, 2, 2, 6, 3, 2, 3, 3, 2, 1,
  0, 0, 0, 0, 1, 0, 2, 1, 1, 0, 0, 5, 2, 0, 12, 0, 0, 0, 1, 1,
  0, 1, 4, 5, 0, 0, 0, 2, 8, 0,
];
