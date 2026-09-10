import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicit and false: URLs never get a trailing slash appended, so
  // kumarp.in/anything and kumarp.in/anything/ don't disagree with
  // whatever normalization Vercel's edge network applies. Mismatched
  // trailingSlash + platform-level redirects is a classic source of a
  // 308 loop — keep this pinned rather than relying on the (also
  // `false`) default.
  trailingSlash: false,

  // No `redirects()`/`rewrites()` here and no proxy.ts (Next 16's
  // renamed middleware) in the project — nothing in the app is
  // redirecting the root route. If the 308 loop persists after a
  // deploy with this config, it is coming from the Vercel Dashboard's
  // domain configuration, not from the app. See the Vercel Dashboard
  // checklist in the PR/response for what to verify there.
};

export default nextConfig;
