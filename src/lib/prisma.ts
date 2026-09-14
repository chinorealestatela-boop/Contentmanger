import { PrismaClient } from "@prisma/client";
import { existsSync, copyFileSync } from "node:fs";
import path from "node:path";

// Demo-mode fallback: if no DATABASE_URL is configured at all (e.g. a
// preview deployment with no database attached — see
// scripts/vercel-build.mjs / scripts/build-demo-db.mjs), fall back to a
// pre-seeded SQLite database bundled at build time, copied to a writable
// /tmp path on first use. Never runs when DATABASE_URL is set (local dev
// via .env, or a properly configured production deployment).
function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const bundled = path.join(process.cwd(), "prisma", "demo-seed.db");
  if (!existsSync(bundled)) return undefined;

  const runtimePath = "/tmp/demo-seed.db";
  if (!existsSync(runtimePath)) copyFileSync(bundled, runtimePath);
  return `file:${runtimePath}`;
}

const resolvedUrl = resolveDatabaseUrl();
if (resolvedUrl) process.env.DATABASE_URL = resolvedUrl;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
