// Builds a fully seeded, self-contained SQLite database at
// prisma/demo-seed.db during the build step, for deployments that have no
// Postgres database attached (see scripts/vercel-build.mjs). Bundled into
// the serverless output via next.config.ts's outputFileTracingIncludes,
// then copied to a writable /tmp path at runtime by src/lib/prisma.ts.
//
// Demo-mode only: data resets on every cold start and every redeploy.
// Never used when a real DATABASE_URL is configured (local dev or a
// properly configured production deployment) — see README.

import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dbPath = path.join(root, "prisma", "demo-seed.db");

for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  const p = dbPath + suffix;
  if (existsSync(p)) rmSync(p);
}

const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
const run = (cmd) => execSync(cmd, { stdio: "inherit", env, cwd: root });

run("npx prisma db push --accept-data-loss --skip-generate");
run("npx tsx prisma/seed.ts");

console.log(`Built demo database at ${path.relative(root, dbPath)}.`);
