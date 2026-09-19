// idx mostly mirrors each target section's own eyebrow index (see
// About.tsx, Projects.tsx, Contact.tsx) — 05 (Activity) has no nav link,
// hence the jump from 04 to 06. Stack (idx 02 on-page) and Experience
// (idx 03 on-page) were deliberately dropped from the navbar in favor of
// Blogs/Weekly at those nav slots — both sections are still live on the
// homepage (reachable by scroll or via "/#stack" / "/#experience", and
// still listed in the command palette), they just no longer have a top
// nav link, so idx 02/03 here point at different content than the
// same-numbered eyebrows on the page itself. This is an intentional,
// explicitly-confirmed exception to "idx mirrors the target's own idx".
//
// Home-section links are root-relative ("/#about") rather than bare
// hashes so they still work when Nav is rendered on a non-home route
// (e.g. clicking "About" from /blog navigates to / and jumps there).
export const NAV_LINKS = [
  { href: "/#about", label: "About", idx: "01" },
  { href: "/blog", label: "Blogs", idx: "02" },
  { href: "/weekly", label: "Weekly", idx: "03" },
  { href: "/#work", label: "Work", idx: "04" },
  { href: "/#contact", label: "Contact", idx: "06" },
] as const;

// Rotates in the nav's tagline slot via a GSAP letter-scatter transition
// (see components/TaglineCycler.tsx). Case is intentional per-line — most
// are all-caps but "console.log" reads as an actual code identifier, so
// it stays lowercase.
export const NAV_TAGLINES = [
  "STILL SINGLE, BUT MY LOCALHOST IS ATTACHED TO ME.",
  "MY BACK PAIN IS 80% BAD CHAIR AND 20% CARRYING UNPRODUCTIVE REPOS.",
  "console.log IS MY THERAPIST.",
  "NO SPEC, NO BRIEF, JUST BUILDING COOL SHIT.",
  "OFFICIALLY EMPLOYED, UNOFFICIALLY BUILDING THE NEXT THING.",
  "9 TO 5 PAYS THE BILLS, 5 TO 9 BUILDS THE FUTURE.",
] as const;

export const NAV_LOGO_MARK = "KP.";

export const SOCIAL_LINKS = {
  github: "https://github.com/Kumar-Prasannajit",
  linkedin: "https://www.linkedin.com/in/kumar-prasannajit-sahu",
  instagram: "https://www.instagram.com/kumarprasannajit_/",
  resume: "/Kumar_Prasannajit_Sahu.pdf",
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
    image: "/projects/manima.jpg",
    summary:
      "Live spiritual-services marketplace with Razorpay and UPI/QR payments.",
    description:
      "A live spiritual-services marketplace that moves real money: Razorpay and UPI/QR payments end-to-end, with idempotent handling and server-side validation to prevent double-charges across three roles — admin, client and agent. Shipped with CI/CD via GitHub Actions.",
    tags: ["React", "Node.js", "Express", "MongoDB", "JWT", "Razorpay"],
    links: [
      { label: "Live platform", href: "https://manimaonline.com/" },
    ] satisfies ProjectLink[],
    sourceNote: "Source private — client codebase",
  },
  {
    title: "BIRAC E-YUVA Center",
    badge: "LIVE",
    image: "/projects/eyuva.jpg",
    summary:
      "Biotech innovation hub site with a CSS-only 3D DNA-helix hero and dark/light themes.",
    description:
      "Solo-built site for GIET University's BIRAC E-YUVA Center, a biotech innovation and entrepreneurship hub — a CSS-only 3D DNA-helix hero, a lightbox project gallery, and a full dark/light theme system, end to end.",
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
    image: "/projects/nipl.jpg",
    summary:
      "Marketing site with particle backgrounds, Lenis smooth scrolling and Swiper sliders.",
    description:
      "Solo-built marketing site for Navgyan Innovations Pvt. Ltd. — particle-field backgrounds, Lenis smooth scrolling and Swiper-powered sliders, built fully responsive from scratch.",
    tags: ["HTML", "CSS", "JavaScript", "Particle.js", "Lenis", "Swiper.js"],
    links: [
      {
        label: "Live site",
        href: "https://navgyaninnovations.com/",
      },
      {
        label: "Source",
        href: "https://github.com/Kumar-Prasannajit/NIPL-Website",
      },
    ] satisfies ProjectLink[],
  },
] as const;

// /specs page. Same shape as STACK_GROUPS (label + pill items) so the page
// reuses Stack.tsx's exact pill-row rendering. Machine/OS/Editor rows are
// the real thing (pulled from the dev machine via PowerShell) — swap them
// if you switch rigs. Peripherals can't be detected from code, so those
// are placeholder jokes; replace with your actual gear whenever.
export const SPECS_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Machine",
    items: [
      "11th Gen Intel Core i5-1145G7 @ 2.60GHz",
      "15GB RAM (send help)",
      "Intel Iris Xe Graphics",
      "512GB NVMe SSD",
    ],
  },
  {
    label: "OS & Runtime",
    items: ["Windows 11 Pro", "Node.js v24", "Git 2.55"],
  },
  {
    label: "Editor & Terminal",
    items: ["VS Code", "PowerShell", "Git Bash"],
  },
  {
    label: "Peripherals",
    items: [
      "Mouse — clicks when needed",
      "Keyboard — types when asked",
      "Monitor — renders whatever VS Code throws at it",
    ],
  },
];

// /places page — bucket-list destinations. Placeholder wishlist, swap for
// your real list whenever — see PLACES type shape above SPECS_GROUPS.
export const PLACES: { name: string; note: string }[] = [
  { name: "Japan", note: "For the neon signs and the WiFi that actually works" },
  { name: "Iceland", note: "Aurora borealis > any CSS gradient I've ever shipped" },
  { name: "Ladakh", note: "High altitude, low bandwidth, zero regrets" },
  { name: "Switzerland", note: "Mountains, trains on time, sanity briefly restored" },
  { name: "New York", note: "To see if it's really as fast-paced as the memes say" },
  { name: "Bali", note: "Coding from a beach, at least once, for the plot" },
];

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

export type Project = (typeof PROJECTS)[number];
