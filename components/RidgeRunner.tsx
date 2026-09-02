"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { gameStack } from "@/lib/data";

// --- tunables -----------------------------------------------------------
const GRAVITY = 1900; // px/s^2
const MOVE_ACCEL = 2600; // px/s^2
const MAX_SPEED = 220; // px/s
const FRICTION = 2400; // px/s^2
const JUMP_VELOCITY = 640; // px/s (upward)
const CHAR_W = 16;
const CHAR_H = 22;
const COLLECT_RADIUS = 28;
const TOAST_MS = 1800;

type Collectible = {
  label: string;
  xFrac: number;
  collected: boolean;
};

type Star = { xFrac: number; yFrac: number; r: number; phase: number };

type CharState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: 1 | -1;
  squash: number; // 0..1, decays after landing, purely cosmetic
};

/**
 * groundY(x, width, height) is THE single source of truth for the ridge:
 * it's used to draw the foreground mountain silhouette (fill down from this
 * curve) and to resolve the character's walking surface (physics). Two sine
 * terms give it a hand-drawn, uneven-ridge feel rather than a pure wave.
 */
function groundY(x: number, width: number, height: number) {
  const baseline = height * 0.64;
  const amp1 = height * 0.1;
  const amp2 = height * 0.035;
  return (
    baseline +
    Math.sin((x / width) * Math.PI * 2.4 + 0.5) * amp1 +
    Math.sin((x / width) * Math.PI * 5.3 + 1.7) * amp2
  );
}

// Decorative, non-interactive background ridgelines (parallax silhouettes).
function backRidgeY(x: number, width: number, height: number, layer: 0 | 1) {
  const baseline = height * (layer === 0 ? 0.38 : 0.48);
  const amp = height * (layer === 0 ? 0.05 : 0.07);
  const freq = layer === 0 ? 1.5 : 1.9;
  const phase = layer === 0 ? 0.9 : 2.4;
  return baseline + Math.sin((x / width) * Math.PI * freq + phase) * amp;
}

function makeCollectibles(): Collectible[] {
  const fracs = [0.1, 0.25, 0.4, 0.58, 0.74, 0.9];
  return gameStack.map((label, i) => ({ label, xFrac: fracs[i], collected: false }));
}

function makeStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      xFrac: Math.random(),
      yFrac: Math.random() * 0.55,
      r: Math.random() * 1.2 + 0.4,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return stars;
}

export default function RidgeRunner() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [collected, setCollected] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sizeRef = useRef({ width: 0, height: 0 });
  const starsRef = useRef<Star[]>([]);
  const collectiblesRef = useRef<Collectible[]>(makeCollectibles());
  const charRef = useRef<CharState>({ x: 60, y: 0, vx: 0, vy: 0, grounded: true, facing: 1, squash: 0 });
  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef({ left: false, right: false });
  const jumpRequestedRef = useRef(false);
  const reducedMotionRef = useRef(false);

  const announceCollect = useCallback((label: string) => {
    setCollected((c) => c + 1);
    setToast(`Collected ${label}!`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const requestJump = useCallback(() => {
    jumpRequestedRef.current = true;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;

    reducedMotionRef.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    starsRef.current = makeStars(70);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!wrap || !canvas) return;
      const width = wrap.clientWidth;
      const height = Math.max(220, Math.min(420, Math.round(width * 0.42)));
      const prevWidth = sizeRef.current.width;
      sizeRef.current = { width, height };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Keep the character's relative position stable across a real resize
      // (skip on the very first layout — there's no prior position to scale from).
      if (prevWidth > 0) {
        const scale = width / prevWidth;
        charRef.current.x = Math.min(Math.max(charRef.current.x * scale, 20), width - 20);
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    function onKeyDown(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "a", "d", "w", " ", "spacebar"].includes(k)) {
        e.preventDefault();
      }
      keysRef.current.add(k);
      if (k === " " || k === "spacebar" || k === "arrowup" || k === "w") requestJump();
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key.toLowerCase());
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let last = performance.now();
    const mountTime = last;
    let raf = 0;

    function step(now: number) {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const { width, height } = sizeRef.current;
      const c = charRef.current;

      // --- input -> horizontal acceleration ---
      const left = keysRef.current.has("arrowleft") || keysRef.current.has("a") || touchRef.current.left;
      const right = keysRef.current.has("arrowright") || keysRef.current.has("d") || touchRef.current.right;

      if (left && !right) {
        c.vx -= MOVE_ACCEL * dt;
        c.facing = -1;
      } else if (right && !left) {
        c.vx += MOVE_ACCEL * dt;
        c.facing = 1;
      } else {
        const decel = FRICTION * dt;
        if (c.vx > 0) c.vx = Math.max(0, c.vx - decel);
        else if (c.vx < 0) c.vx = Math.min(0, c.vx + decel);
      }
      c.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, c.vx));
      c.x += c.vx * dt;
      c.x = Math.max(18, Math.min(width - 18, c.x));

      // --- jump / gravity, resolved against groundY(x) ---
      if (jumpRequestedRef.current) {
        if (c.grounded) {
          c.vy = -JUMP_VELOCITY;
          c.grounded = false;
        }
        jumpRequestedRef.current = false;
      }

      const surfaceY = groundY(c.x, width, height) - CHAR_H / 2;
      if (!c.grounded) c.vy += GRAVITY * dt;
      applyVerticalPhysics(c, surfaceY, dt);

      // --- collectibles ---
      // Small grace period so a marker spawning near the character on a
      // narrow viewport can never register as an accidental instant collect.
      const canCollect = now - mountTime > 500;
      for (const item of collectiblesRef.current) {
        if (!canCollect || item.collected) continue;
        const ix = item.xFrac * width;
        const iy = groundY(ix, width, height) - 34;
        const dx = c.x - ix;
        const dy = c.y - iy;
        if (Math.sqrt(dx * dx + dy * dy) < COLLECT_RADIUS) {
          item.collected = true;
          announceCollect(item.label);
        }
      }

      draw(ctx, width, height, now / 1000);
      raf = requestAnimationFrame(step);
    }

    raf = requestAnimationFrame(step);

    // Browsers pause/throttle requestAnimationFrame while the tab is hidden.
    // Without this, `dt` on the first frame back would be measured against a
    // stale `last`, even though it's already clamped to 1/30s so it can't
    // cause a physics jump — resetting the clock here just keeps that frame
    // from reporting a misleadingly large elapsed time.
    function onVisibilityChange() {
      if (!document.hidden) last = performance.now();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    function draw(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
      ctx.clearRect(0, 0, width, height);

      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#0d0815");
      sky.addColorStop(0.55, "#150f1f");
      sky.addColorStop(1, "#1c1128");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // sunset glow near horizon
      const glowY = height * 0.62;
      const glow = ctx.createRadialGradient(width * 0.5, glowY, 0, width * 0.5, glowY, width * 0.55);
      glow.addColorStop(0, "rgba(255,122,82,0.35)");
      glow.addColorStop(0.4, "rgba(255,194,103,0.14)");
      glow.addColorStop(1, "rgba(21,15,31,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // stars
      for (const s of starsRef.current) {
        const twinkle = reducedMotionRef.current
          ? 0.7
          : 0.5 + 0.5 * Math.sin(t * 1.6 + s.phase);
        ctx.globalAlpha = 0.35 + twinkle * 0.65;
        ctx.fillStyle = "#e9e2f2";
        ctx.beginPath();
        ctx.arc(s.xFrac * width, s.yFrac * height, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // back mountain layers (parallax silhouettes, decorative only)
      drawRidge(ctx, width, height, (x) => backRidgeY(x, width, height, 0), "#2a1c40");
      drawRidge(ctx, width, height, (x) => backRidgeY(x, width, height, 1), "#241938");

      // foreground ridge — the walking surface
      drawRidge(ctx, width, height, (x) => groundY(x, width, height), "#1c1128", true);

      // collectibles
      for (const item of collectiblesRef.current) {
        const ix = item.xFrac * width;
        const iy = groundY(ix, width, height) - 34;
        drawCollectible(ctx, ix, iy, item.label, item.collected, t);
      }

      // character
      drawCharacter(ctx, charRef.current);
    }

    function drawRidge(
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      fn: (x: number) => number,
      fill: string,
      rim = false
    ) {
      ctx.beginPath();
      ctx.moveTo(0, height);
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * width;
        ctx.lineTo(x, fn(x));
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      if (rim) {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * width;
          const y = fn(x);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(255,194,103,0.55)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    function drawCollectible(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      label: string,
      collected: boolean,
      t: number
    ) {
      if (collected) return;
      const bob = reducedMotionRef.current ? 0 : Math.sin(t * 2.2 + x) * 3;
      const py = y + bob;

      const glow = ctx.createRadialGradient(x, py, 0, x, py, 16);
      glow.addColorStop(0, "rgba(124,247,176,0.55)");
      glow.addColorStop(1, "rgba(124,247,176,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, py, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#7cf7b0";
      ctx.beginPath();
      ctx.arc(x, py, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#e9e2f2";
      ctx.textAlign = "center";
      ctx.fillText(label, x, py - 14);
    }

    function drawCharacter(ctx: CanvasRenderingContext2D, c: CharState) {
      const w = CHAR_W;
      const h = CHAR_H * (1 - c.squash * 0.25);
      const x = c.x - w / 2;
      const y = c.y - h / 2;

      // body
      ctx.fillStyle = "#ff7a52";
      ctx.fillRect(x, y, w, h);
      // top highlight
      ctx.fillStyle = "#ffc267";
      ctx.fillRect(x, y, w, 4);
      // eye (abstract mascot, faces movement direction)
      ctx.fillStyle = "#150f1f";
      const eyeX = c.facing === 1 ? x + w - 6 : x + 2;
      ctx.fillRect(eyeX, y + 8, 4, 4);
      // feet shadow
      ctx.fillStyle = "rgba(21,15,31,0.4)";
      ctx.fillRect(x + 1, y + h - 2, w - 2, 2);
    }

    function applyVerticalPhysics(c: CharState, surfaceY: number, dt: number) {
      if (c.grounded) {
        c.y = surfaceY;
        c.squash = Math.max(0, c.squash - dt * 3);
      } else {
        c.y += c.vy * dt;
        if (c.y >= surfaceY) {
          c.y = surfaceY;
          c.vy = 0;
          c.grounded = true;
          c.squash = 1;
        }
      }
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [announceCollect, requestJump]);

  const setTouch = (dir: "left" | "right", value: boolean) => {
    touchRef.current[dir] = value;
  };

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`RidgeRunner mini-game: guide the pixel mascot along the mountain ridge with arrow keys, WASD, or space to jump, and collect the ${gameStack.length} glowing stack markers. ${collected} of ${gameStack.length} collected so far.`}
        className="block w-full rounded-xl border border-panel-line"
      />

      {/* HUD */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-panel-line bg-ink/70 px-3 py-1.5 font-pixel text-[9px] leading-none text-mint">
        STACK {collected}/{gameStack.length}
      </div>

      <p className="pointer-events-none absolute right-3 top-3 hidden max-w-[11rem] rounded-md border border-panel-line bg-ink/70 px-2 py-1 font-pixel text-[7px] leading-relaxed text-muted sm:block">
        ←/→/A/D MOVE · SPACE JUMP
      </p>

      <div
        aria-live="polite"
        role="status"
        className={`pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-panel-line bg-panel px-3 py-1.5 font-pixel text-[9px] text-amber shadow-lg transition-opacity duration-300 ${
          toast ? "opacity-100" : "opacity-0"
        }`}
      >
        {toast ?? ""}
      </div>

      {/* touch controls — mobile only */}
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between sm:hidden">
        <TouchButton
          label="Move left"
          onDown={() => setTouch("left", true)}
          onUp={() => setTouch("left", false)}
        >
          ◀
        </TouchButton>
        <TouchButton label="Jump" onDown={requestJump} onUp={() => {}}>
          ▲
        </TouchButton>
        <TouchButton
          label="Move right"
          onDown={() => setTouch("right", true)}
          onUp={() => setTouch("right", false)}
        >
          ▶
        </TouchButton>
      </div>
    </div>
  );
}

function TouchButton({
  label,
  onDown,
  onUp,
  children,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-panel-line bg-ink/80 text-lg text-paper active:bg-violet-mid"
    >
      {children}
    </button>
  );
}
