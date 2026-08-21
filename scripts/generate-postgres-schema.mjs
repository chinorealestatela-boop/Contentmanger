// Derives prisma/schema.postgres.prisma from the canonical prisma/schema.prisma
// by swapping only the datasource block (sqlite -> postgresql). This keeps a
// single source of truth for all models — the Postgres schema can never drift
// from the SQLite one because it's generated from it on every build.
//
// Used for production hosting (e.g. Vercel), where serverless functions have
// no persistent writable filesystem and a file-based SQLite DB won't work.
// Local development keeps using SQLite via prisma/schema.prisma directly —
// no external database required to run this app locally.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcPath = path.join(root, "prisma", "schema.prisma");
const outPath = path.join(root, "prisma", "schema.postgres.prisma");

const src = readFileSync(srcPath, "utf8");

const sqliteBlock = /datasource db \{\s*provider = "sqlite"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}/;
if (!sqliteBlock.test(src)) {
  console.error("Could not find the expected SQLite datasource block in prisma/schema.prisma — aborting.");
  process.exit(1);
}

const postgresBlock = 'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}';
const out = src.replace(sqliteBlock, postgresBlock);

writeFileSync(outPath, out);
console.log(`Generated ${path.relative(root, outPath)} from ${path.relative(root, srcPath)}.`);
