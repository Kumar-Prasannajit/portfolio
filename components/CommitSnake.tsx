"use client";

// Snake on the real contribution grid. The graph itself stays a server-
// rendered, untouched block; this component only adds a PLAY button to the
// legend row and, while a run is active, toggles classes on the existing
// `.gh-cell` nodes (React never re-renders them, so the mutation is safe).
// Stopping removes every class and the graph is exactly as it was.

import { useCallback, useEffect, useRef, useState } from "react";

const ROWS = 7;
const BEST_KEY = "kps-snake-best";
const START_MS = 130;
const MIN_MS = 70;

type Dir = readonly [number, number];
const KEYS: Record<string, Dir> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

type Phase = "idle" | "playing" | "over";

type Props = {
  /** Number of week columns in the grid. */
  cols: number;
  /** Total real cells; the last week is usually partial. */
  total: number;
  /** Cell indexes (week * 7 + day) that had real contributions — food spawns here first. */
  commitCells: number[];
};

export default function CommitSnake({ cols, total, commitCells }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);

  const quit = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setPhase("idle");
  }, []);

  useEffect(() => () => stopRef.current?.(), []);

  const start = useCallback(() => {
    stopRef.current?.();
    const btn = btnRef.current;
    const card = btn?.closest<HTMLElement>(".gh-card");
    if (!btn || !card) return;
    const cells = Array.from(
      card.querySelectorAll<HTMLElement>(".gh-weeks .gh-cell")
    );
    const clear = () =>
      cells.forEach((c) => c.classList.remove("is-snake", "is-trail", "is-food"));
    clear();

    const idx = (x: number, y: number) => x * ROWS + y;
    const valid = (x: number, y: number) => idx(x, y) < total;

    const snake: [number, number][] = [
      [4, 3],
      [3, 3],
      [2, 3],
    ];
    let dir: Dir = [1, 0];
    const queue: Dir[] = [];
    let food = -1;
    let points = 0;
    let timer = 0;
    let alive = true;

    const paint = (i: number, cls: string) => cells[i]?.classList.add(cls);

    const spawnFood = () => {
      const taken = new Set(snake.map(([x, y]) => idx(x, y)));
      const pool = commitCells.filter((i) => !taken.has(i));
      if (!pool.length) {
        for (let i = 0; i < total; i++) if (!taken.has(i)) pool.push(i);
      }
      if (!pool.length) return -1;
      const next = pool[Math.floor(Math.random() * pool.length)];
      paint(next, "is-food");
      return next;
    };

    snake.forEach(([x, y]) => paint(idx(x, y), "is-snake"));
    food = spawnFood();
    setScore(0);
    // Read lazily (not in an effect): the best score only shows once a run starts.
    try {
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
    } catch {}
    setPhase("playing");
    btn.focus();

    const finish = () => {
      alive = false;
      window.clearTimeout(timer);
      setPhase("over");
      setBest((prev) => {
        const next = Math.max(prev, points);
        if (next !== prev) {
          try {
            localStorage.setItem(BEST_KEY, String(next));
          } catch {}
        }
        return next;
      });
    };

    const tick = () => {
      if (queue.length) dir = queue.shift()!;
      const [hx, hy] = snake[0];
      // Edges wrap; only hitting the snake or the missing tail of the
      // partial last week ends the run.
      const nx = (hx + dir[0] + cols) % cols;
      const ny = (hy + dir[1] + ROWS) % ROWS;
      const ate = idx(nx, ny) === food;
      const body = ate ? snake : snake.slice(0, -1);
      if (!valid(nx, ny) || body.some(([x, y]) => x === nx && y === ny)) {
        finish();
        return;
      }
      snake.unshift([nx, ny]);
      const head = idx(nx, ny);
      cells[head].classList.remove("is-food", "is-trail");
      paint(head, "is-snake");
      if (ate) {
        points += 1;
        setScore(points);
        food = spawnFood();
      } else {
        const [tx, ty] = snake.pop()!;
        const tail = cells[idx(tx, ty)];
        tail.classList.remove("is-snake");
        tail.classList.add("is-trail");
      }
      timer = window.setTimeout(
        tick,
        Math.max(MIN_MS, START_MS - points * 3)
      );
    };
    timer = window.setTimeout(tick, START_MS);

    // Arrow keys are only claimed while focus is inside the graph card, so
    // page scroll is untouched everywhere else.
    const onKey = (e: KeyboardEvent) => {
      if (!card.contains(document.activeElement)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        quit();
        return;
      }
      if (!alive) return;
      const next = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!next) return;
      e.preventDefault();
      const last = queue.length ? queue[queue.length - 1] : dir;
      if (next[0] === -last[0] && next[1] === -last[1]) return;
      if (next[0] === last[0] && next[1] === last[1]) return;
      if (queue.length < 2) queue.push(next);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!card.contains(target)) {
        quit();
        return;
      }
      // Keep keyboard focus on the game when the card is clicked.
      if (!btn.contains(target)) requestAnimationFrame(() => btn.focus());
    };
    const onHide = () => {
      if (document.hidden) quit();
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) quit();
      },
      { threshold: 0.1 }
    );
    io.observe(card);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("visibilitychange", onHide);

    stopRef.current = () => {
      alive = false;
      window.clearTimeout(timer);
      io.disconnect();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("visibilitychange", onHide);
      clear();
    };
  }, [cols, total, commitCells, quit]);

  const playing = phase === "playing";

  return (
    <div className="gh-game">
      <button
        ref={btnRef}
        type="button"
        className="gh-play mono"
        aria-pressed={playing}
        onClick={playing ? quit : start}
      >
        {playing ? "■ QUIT" : phase === "over" ? "▶ AGAIN" : "▶ PLAY"}
      </button>
      {phase !== "idle" && (
        <span className="gh-score mono" aria-hidden="true">
          {phase === "over" ? "GAME OVER · " : ""}
          {score} · BEST {best}
        </span>
      )}
      <span className="sr-only" role="status">
        {phase === "over"
          ? `Game over. ${score} commits eaten. Best ${best}. Press Escape to restore the graph.`
          : playing
            ? "Snake started. Use the arrow keys or WASD; Escape quits."
            : ""}
      </span>
    </div>
  );
}
