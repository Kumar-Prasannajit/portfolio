# Kumar Sahu — Portfolio

Personal portfolio for Kumar Prasannajit Sahu, Full Stack Developer. Next.js
(App Router) + TypeScript + Tailwind CSS, with a hand-drawn "dusk over a
mountain ridge" identity and a small playable Canvas 2D game in the hero
(`components/RidgeRunner.tsx`).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

- `app/page.tsx` — assembles the single-page layout: Hero → About → Tech
  Stack → Projects → Open Source → Contribution activity → Experience →
  Gallery → Now Playing → Footer.
- `components/` — one component per section (`Hero`, `About`, `TechStack`,
  `Projects`, `OpenSource`, `GithubHeatmap`, `Experience`, `Gallery`,
  `NowPlaying`, `Nav`, `Footer`), plus `RidgeRunner.tsx` (the hero game,
  client-only) and `RidgeRunnerLoader.tsx` (its `next/dynamic`, `ssr: false`
  boundary).
- `lib/data.ts` — all real content (bio, stack, experience, projects, gallery
  placeholders, sample tracks, social links, Open Source fallback). Edit
  facts here, not in JSX.
- `lib/github.ts` — server-only fetch helpers for the Open Source feed and
  the contribution heatmap, both hitting GitHub's public unauthenticated
  endpoints for `Kumar-Prasannajit`, cached/revalidated hourly via Next's
  `fetch(..., { next: { revalidate: 3600 } })` (never called client-side, so
  the 60 req/hr unauthenticated rate limit is a non-issue). Both fall back to
  static placeholder data on failure — `OpenSource.tsx` never renders empty,
  and `GithubHeatmap.tsx` falls back to an illustrative (not real) pattern.
- `app/globals.css` — the design-token palette (`--ink`, `--ember`, etc.) as
  a Tailwind v4 `@theme`, plus the reduced-motion and focus-visible rules.

## TODOs before this goes live

These are called out with `// TODO(kumar): ...` comments at their exact
location in the code; this is just the checklist view.

1. **Resume & LinkedIn** (`lib/data.ts` → `social`) — GitHub is filled in
   (`github.com/Kumar-Prasannajit`, also what `lib/github.ts` queries for the
   Open Source feed and heatmap). Replace the `#linkedin` placeholder href
   with your real profile URL, and drop your actual resume PDF at
   `public/resume.pdf` (referenced by both the nav's "Resume" link and the
   hero's "Resume" button).
2. **Project links** (`lib/data.ts` → `projects`) — each project currently
   links to a placeholder anchor (`#manima-online`, etc.). Swap in the real
   live URLs / repo URLs.
3. **Contact email** (`components/Footer.tsx`) — replace the placeholder
   `hello@example.com` mailto with your real address.
4. **Site domain** (`app/layout.tsx` → `siteUrl`) — used for `metadataBase`
   and Open Graph URLs; point it at your real deployed domain once you have
   one.
5. **Gallery photos** (`components/Gallery.tsx`, data in `lib/data.ts` →
   `gallery`) — tiles are currently CSS-gradient placeholders. To swap in
   real photos: drop files into `public/gallery/`, then in `Gallery.tsx`
   replace a tile's gradient `<div>` with
   `<Image src="/gallery/your-file.jpg" alt="…" fill className="object-cover" />`
   (the tile wrapper already has `relative`), and update that item's
   title/date in `lib/data.ts`.
6. **Now Playing** (`components/NowPlaying.tsx`, data in `lib/data.ts` →
   `tracks`) — currently a static sample list. Two integration paths are
   documented inline; pick one:
   - **(a) Spotify embed** — no backend: drop in
     `<iframe src="https://open.spotify.com/embed/playlist/<id>">` in place
     of the track list.
   - **(b) Spotify Web API** — add a serverless route
     (`app/api/now-playing/route.ts`) hitting the currently-playing /
     top-tracks endpoints, refresh the OAuth token server-side, cache the
     response client-side for ~1–2 minutes, and fall back to the static
     `tracks` array if the request fails.

## Deploying

Built for Vercel. Push to a Git repo, import it at
[vercel.com/new](https://vercel.com/new), and deploy — no environment
variables are required unless you wire up the Spotify Web API option above.
