import test from "node:test";
import assert from "node:assert/strict";
import { computeStack } from "./stack.ts";
import type { Project } from "./data.ts";

// Only the fields computeStack reads; the rest of Project is case-study copy.
function project(
  slug: string,
  tags: string[],
  extra: { lastWorked?: string } = {},
): Project {
  return { slug, tags, links: [], ...extra } as unknown as Project;
}

const PROJECTS = [
  project("a", ["React", "Node.js", "Express"]),
  project("b", ["Next.js", "React", "TypeScript"]),
  project("c", ["HTML", "React"]),
];

const DATES = { a: "2025-09-17T00:00:00Z", b: "2026-07-30T00:00:00Z" };

const byName = (tools: ReturnType<typeof computeStack>) =>
  Object.fromEntries(tools.map((t) => [t.name, t]));

test("a newer GitHub activity date beats the showcased-repo date", () => {
  const tools = byName(
    computeStack(PROJECTS, DATES, { React: "2026-09-29T08:00:00Z" }),
  );
  assert.equal(tools.React.lastUsed, "2026-09-29T08:00:00Z");
});

test("an older GitHub activity date never lowers the project date", () => {
  const tools = byName(
    computeStack(PROJECTS, DATES, { TypeScript: "2025-01-01T00:00:00Z" }),
  );
  assert.equal(tools.TypeScript.lastUsed, "2026-07-30T00:00:00Z");
});

test("a tool missing from the activity map falls back to the project date", () => {
  const tools = byName(
    computeStack(PROJECTS, DATES, { React: "2026-09-29T08:00:00Z" }),
  );
  assert.equal(tools.Express.lastUsed, "2025-09-17T00:00:00Z");
});

test("an empty activity map reproduces the old project-only dates", () => {
  const tools = byName(computeStack(PROJECTS, DATES, {}));
  assert.equal(tools.React.lastUsed, "2026-07-30T00:00:00Z");
  assert.equal(tools.HTML.lastUsed, null);
});

test("activity can supply a date for a tool whose project has none", () => {
  const tools = byName(
    computeStack(PROJECTS, DATES, { HTML: "2026-09-01T00:00:00Z" }),
  );
  assert.equal(tools.HTML.lastUsed, "2026-09-01T00:00:00Z");
});

test("lastWorked still counts alongside GitHub activity", () => {
  const withWorked = [
    project("m", ["Razorpay"], { lastWorked: "2026-10-01T00:00:00Z" }),
  ];
  const older = byName(
    computeStack(withWorked, {}, { Razorpay: "2026-09-01T00:00:00Z" }),
  );
  assert.equal(older.Razorpay.lastUsed, "2026-10-01T00:00:00Z");
  const newer = byName(
    computeStack(withWorked, {}, { Razorpay: "2026-10-05T00:00:00Z" }),
  );
  assert.equal(newer.Razorpay.lastUsed, "2026-10-05T00:00:00Z");
});

test("tools seen only in GitHub activity are not added to the board", () => {
  const names = computeStack(PROJECTS, DATES, {
    Vite: "2026-10-01T00:00:00Z",
  }).map((t) => t.name);
  assert.ok(!names.includes("Vite"));
});

test("ranking and counts ignore the activity map", () => {
  const plain = computeStack(PROJECTS, DATES, {});
  const busy = computeStack(PROJECTS, DATES, {
    HTML: "2026-10-01T00:00:00Z",
    Express: "2026-10-02T00:00:00Z",
    "Node.js": "2026-10-03T00:00:00Z",
  });
  const strip = (tools: typeof plain) =>
    tools.map(({ name, count, weight }) => ({ name, count, weight }));
  assert.deepEqual(strip(busy), strip(plain));
  assert.equal(plain[0].name, "React"); // 3 projects
});

test("pinned tools join the board even when no project lists them", () => {
  const tools = computeStack(PROJECTS, DATES, { Redis: "2026-10-11T00:00:00Z" }, {
    pinned: ["Redis", "Docker", "React"],
  });
  const names = tools.map((t) => t.name);
  // After the ranked ones, in pinned order; React is already ranked, so not twice.
  assert.deepEqual(names.slice(-2), ["Redis", "Docker"]);
  assert.equal(names.filter((n) => n === "React").length, 1);
  const by = byName(tools);
  assert.equal(by.Redis.lastUsed, "2026-10-11T00:00:00Z");
  assert.equal(by.Docker.lastUsed, null);
  assert.equal(by.Docker.count, 0);
  assert.equal(by.Docker.weight, 0);
});

test("a pinned tool cut by size keeps its project count and date", () => {
  const tools = byName(
    computeStack(PROJECTS, DATES, {}, { size: 1, pinned: ["Express"] }),
  );
  assert.equal(tools.Express.count, 1);
  assert.equal(tools.Express.lastUsed, "2025-09-17T00:00:00Z");
});
