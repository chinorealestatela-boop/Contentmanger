// Vercel build entry point. Uses the real Postgres pipeline when the
// project has DATABASE_URL + DIRECT_URL configured (unchanged from
// before — this is what a properly configured production/preview
// deployment uses). Falls back to a self-contained SQLite demo when
// they're absent, so a preview deploy with no database attached still
// builds into something viewable instead of failing — see
// scripts/build-demo-db.mjs and README's "Running without a database"
// section for what that trade-off means.

import { execSync } from "node:child_process";

const looksLikePostgres = (url) => typeof url === "string" && /^postgres(ql)?:\/\//.test(url);
const hasPostgres = looksLikePostgres(process.env.DATABASE_URL) && looksLikePostgres(process.env.DIRECT_URL);

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (hasPostgres) {
  run("node scripts/generate-postgres-schema.mjs");
  run("npx prisma generate --schema=prisma/schema.postgres.prisma");
  run("npx prisma db push --schema=prisma/schema.postgres.prisma --accept-data-loss --skip-generate");
} else {
  console.log(
    "No Postgres DATABASE_URL/DIRECT_URL configured for this deployment — building a self-contained SQLite demo instead. " +
      "Data resets on every cold start and redeploy; see README's \"Running without a database\" section."
  );
  run("node scripts/build-demo-db.mjs");
}

run("next build");
