"use client";

import dynamic from "next/dynamic";

// Canvas needs `window`, so the game only ever runs on the client. next/dynamic's
// `ssr: false` option requires a Client Component boundary, hence this wrapper.
const RidgeRunner = dynamic(() => import("@/components/RidgeRunner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex w-full items-center justify-center rounded-xl border border-panel-line bg-violet-deep/50 font-body text-sm text-muted"
      style={{ height: "clamp(220px, 42vw, 420px)" }}
      aria-hidden="true"
    >
      Loading the ridge…
    </div>
  ),
});

export default RidgeRunner;
