// The automation scripts import lib/*.ts directly, which needs Node's native
// TypeScript support (22.18+). Deliberately not an "engines" field in
// package.json: Vercel reads that to pick the site's Node version.

const MIN = [22, 18];

export function assertNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < MIN[0] || (major === MIN[0] && minor < MIN[1])) {
    console.error(`Node >= ${MIN.join(".")} required (found ${process.versions.node})`);
    process.exit(1);
  }
}
