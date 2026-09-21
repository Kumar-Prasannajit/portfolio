"use client";

// The home page's fixed left panel: the portrait, then three big tiles that
// fill the rest of the panel down to the bottom of the screen: the time, the
// date and the number of viewers.
//
// The clock shows Kumar's own time (PANEL_TIME_ZONE in lib/data.ts). It is
// hydration-safe: the server and the first client render show placeholders,
// and the real time appears after mount. Numerals are sized from their tile
// (container query units, see .ident in globals.css) so they fill it at any
// panel size.

import Image from "next/image";
import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { PANEL_TIME_ZONE, PANEL_TIME_ZONE_LABEL } from "@/lib/data";
import { useViews } from "@/lib/views";

const ODOMETER_DIGITS = 5;

// Width of "DD MON" in em, measured with the real font, so each month is sized
// to fill its tile without overflowing (MAR is the widest, FEB the narrowest).
const DATE_EM: Record<string, number> = {
  JAN: 3.95, FEB: 3.87, MAR: 4.2, APR: 3.98, MAY: 4.12, JUN: 4.03,
  JUL: 3.87, AUG: 4.11, SEP: 3.87, OCT: 4.03, NOV: 4.1, DEC: 3.98,
};

// ---- the clock ---------------------------------------------------------------

let nowSecond = 0; // epoch seconds; 0 until the first tick on the client

// The panel only exists on wide screens (CSS hides it below this width), so
// the clock only ticks there instead of running for nothing on a phone.
const PANEL_MEDIA = "(min-width: 1024px)";

function subscribeClock(onChange: () => void) {
  const tick = () => {
    const s = Math.floor(Date.now() / 1000);
    if (s !== nowSecond) {
      nowSecond = s;
      onChange();
    }
  };
  const query = window.matchMedia(PANEL_MEDIA);
  let id: ReturnType<typeof setInterval> | undefined;
  const sync = () => {
    clearInterval(id);
    id = undefined;
    if (query.matches) {
      tick();
      id = setInterval(tick, 250);
    }
  };
  sync();
  query.addEventListener("change", sync);
  return () => {
    query.removeEventListener("change", sync);
    clearInterval(id);
  };
}

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PANEL_TIME_ZONE,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  day: "2-digit",
  month: "short",
  weekday: "short",
  year: "numeric",
});

function useNow() {
  const s = useSyncExternalStore(subscribeClock, () => nowSecond, () => 0);
  if (s === 0) return null;
  const p: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(s * 1000))) p[part.type] = part.value;
  return {
    hh: p.hour,
    mm: p.minute,
    ss: p.second,
    day: p.day,
    month: p.month.toUpperCase(),
    weekday: p.weekday.toUpperCase(),
    year: p.year,
  };
}

// ---- pieces ------------------------------------------------------------------

// Every digit gets the same width so the numbers don't jitter as they change.
function Digits({ text, dim = 0 }: { text: string; dim?: number }) {
  return (
    <span aria-hidden="true">
      {[...text].map((ch, i) =>
        ch === ":" ? (
          <span key={i} className="cl">
            :
          </span>
        ) : /\d/.test(ch) ? (
          <span key={i} className={i < dim ? "dg dim" : "dg"}>
            {ch}
          </span>
        ) : ch === " " ? (
          <span key={i} className="sp" />
        ) : (
          <span key={i} className={i < dim ? "lt dim" : "lt"}>
            {ch}
          </span>
        )
      )}
    </span>
  );
}

function Stat({
  label,
  meta,
  width,
  tone,
  spoken,
  children,
}: {
  label: string;
  meta?: ReactNode;
  /** Rough width of the value in em, so it can be sized to fit the tile. */
  width: number;
  tone?: "red";
  /** What a screen reader hears instead of the individual glyphs. */
  spoken: string;
  children: ReactNode;
}) {
  return (
    <section className={`stat${tone === "red" ? " stat-red" : ""}`} aria-label={label}>
      <div className="stat-head mono">
        <span className="stat-label">{label}</span>
        {meta && <span className="stat-meta">{meta}</span>}
      </div>
      <div
        className="stat-value"
        role="img"
        aria-label={spoken}
        style={{ "--w": width } as CSSProperties}
      >
        {children}
      </div>
    </section>
  );
}

// ---- the panel ---------------------------------------------------------------

export default function IdentityPanel() {
  const now = useNow();
  const views = useViews();

  const time = now ? `${now.hh}:${now.mm}` : "--:--";
  const seconds = now ? now.ss : "--";
  const date = now ? `${now.day} ${now.month}` : "-- ---";

  // An odometer: zero-padded to five digits, the leading zeros dimmed.
  let viewers = "·····";
  let viewersDim = viewers.length;
  let viewersMeta = "UNIQUE BROWSERS";
  if (views.status === "ok") {
    viewers = String(views.count).padStart(ODOMETER_DIGITS, "0");
    viewersDim = views.count === 0 ? viewers.length - 1 : viewers.length - String(views.count).length;
  } else if (views.status === "unconfigured") {
    viewers = "-----";
    viewersDim = viewers.length;
    viewersMeta = "NOT CONNECTED";
  } else if (views.status === "error") {
    viewers = "-----";
    viewersDim = viewers.length;
    viewersMeta = "COUNTER OFFLINE";
  }

  return (
    <div className="ident">
      <figure className="ident-photo">
        <Image
          src="/kumar-portrait-v3.jpg"
          alt="Portrait of Kumar Prasannajit Sahu: a motion-blurred silhouette in profile against a red wall."
          fill
          sizes="(min-width: 1280px) 460px, 340px"
          className="ident-img"
        />
        <figcaption className="ident-tag mono">[ KUMAR // ODISHA, IN ]</figcaption>
      </figure>

      <div className="ident-stats">
        <Stat
          label="LOCAL TIME"
          meta={
            <>
              {PANEL_TIME_ZONE_LABEL} · UTC+5:30 · <span className="stat-sec">{`:${seconds}`}</span>
            </>
          }
          width={3.2}
          spoken={now ? `Local time ${now.hh}:${now.mm}:${now.ss}` : "Local time"}
        >
          <Digits text={time} />
        </Stat>

        <Stat
          label="TODAY"
          meta={now ? `${now.weekday} · ${now.year}` : undefined}
          width={(now ? DATE_EM[now.month] : undefined) ?? 4.2}
          spoken={now ? `${now.weekday} ${now.day} ${now.month} ${now.year}` : "Date"}
        >
          <Digits text={date} />
        </Stat>

        <Stat
          label="VIEWERS"
          meta={viewersMeta}
          width={viewers.length * 0.7}
          tone="red"
          spoken={
            views.status === "ok"
              ? `${views.count.toLocaleString("en-US")} ${views.count === 1 ? "viewer" : "viewers"}`
              : `Viewers: ${viewersMeta.toLowerCase()}`
          }
        >
          <Digits text={viewers} dim={viewersDim} />
        </Stat>
      </div>
    </div>
  );
}
