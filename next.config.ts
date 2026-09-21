import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicit and false: URLs never get a trailing slash appended, so
  // kumarp.in/anything and kumarp.in/anything/ don't disagree with
  // whatever normalization Vercel's edge network applies. Mismatched
  // trailingSlash + platform-level redirects is a classic source of a
  // 308 loop — keep this pinned rather than relying on the (also
  // `false`) default.
  trailingSlash: false,

  // next/image serves WebP by default; AVIF first (smaller) where supported.
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // next-mdx-remote's own README calls this out explicitly for Turbopack
  // (which `next dev`/`next build` use by default here): without it,
  // Turbopack doesn't reliably tell the package's server-only code apart
  // from its client-bundle code, which is exactly the split RSC MDX
  // rendering depends on.
  transpilePackages: ["next-mdx-remote"],

  // Dev only: `next dev` refuses requests to its own /_next/* assets from any
  // host but localhost, so a page opened through an ngrok tunnel loads its HTML
  // but no JavaScript (no clock, no animations). Allow the ngrok hostnames.
  // Has no effect on `next build` / production.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "*.ngrok.io"],

  // No `redirects()`/`rewrites()` here and no proxy.ts (Next 16's
  // renamed middleware) in the project — nothing in the app is
  // redirecting the root route. If the 308 loop persists after a
  // deploy with this config, it is coming from the Vercel Dashboard's
  // domain configuration, not from the app. See the Vercel Dashboard
  // checklist in the PR/response for what to verify there.
};

export default nextConfig;
