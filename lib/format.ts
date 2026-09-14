// Pure, client-safe formatting helpers shared between server pages and
// client components. Deliberately separate from lib/content.ts (which
// imports `node:fs`) — a client component importing even one named
// export from a module that touches `fs` pulls the whole module,
// `fs` import included, into the client bundle, which Turbopack can't
// resolve ("chunking context does not support external modules").

export function formatContentDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
