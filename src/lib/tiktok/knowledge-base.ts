// Knowledge Base (spec sections 3, 5, 16). Every fact the assistant is
// allowed to state comes from here or straight from the CRM's own Vehicle
// table — never invented, never interpolated. This is also what the
// Training Center (src/app/(app)/tiktok/training) reads and writes.

import { prisma } from "@/lib/prisma";
import type { TikTokAISettings, Vehicle } from "@prisma/client";

export async function getSettings(): Promise<TikTokAISettings> {
  const existing = await prisma.tikTokAISettings.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return prisma.tikTokAISettings.create({ data: { id: "default" } });
}

export async function findAvailableVehicles(criteria: { bodyStyle?: string; make?: string; model?: string; maxPrice?: number }) {
  return prisma.vehicle.findMany({
    where: {
      status: "AVAILABLE",
      ...(criteria.bodyStyle ? { bodyStyle: { contains: criteria.bodyStyle } } : {}),
      ...(criteria.make ? { make: { contains: criteria.make } } : {}),
      ...(criteria.model ? { model: { contains: criteria.model } } : {}),
      ...(criteria.maxPrice ? { OR: [{ internetPrice: { lte: criteria.maxPrice } }, { sellingPrice: { lte: criteria.maxPrice } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

/** Best-effort match of a free-text vehicle mention ("bmw", "civic",
 * "reliable suv") against real inventory. Never returns a guess — only an
 * actual row from the Vehicle table, or nothing. */
export async function matchVehicleByText(text: string): Promise<Vehicle | null> {
  const cleaned = text.trim();
  if (!cleaned) return null;
  const matches = await prisma.vehicle.findMany({
    where: {
      status: "AVAILABLE",
      OR: [{ make: { contains: cleaned } }, { model: { contains: cleaned } }, { bodyStyle: { contains: cleaned.toUpperCase() } }],
    },
    take: 2,
  });
  // Ambiguous (0 or 2+ candidates) — the caller must treat this as "unknown", not guess.
  return matches.length === 1 ? matches[0] : null;
}

export async function searchKnowledge(type: string, keywords: string[]) {
  if (!keywords.length) return prisma.tikTokKnowledge.findMany({ where: { type, active: true }, orderBy: { updatedAt: "desc" }, take: 3 });
  return prisma.tikTokKnowledge.findMany({
    where: {
      type,
      active: true,
      OR: keywords.flatMap((k) => [{ content: { contains: k } }, { tags: { contains: k } }, { title: { contains: k } }]),
    },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });
}

export async function getPolicy(topic: string) {
  const hits = await searchKnowledge("POLICY", [topic]);
  return hits[0] ?? null;
}

export async function getDoNotSayPhrases(): Promise<string[]> {
  const rows = await prisma.tikTokKnowledge.findMany({ where: { type: "DO_NOT_SAY", active: true }, select: { content: true } });
  return rows.map((r) => r.content.trim()).filter(Boolean);
}

export async function getObjectionGuidance(keyword?: string) {
  return searchKnowledge("KNOWLEDGE", keyword ? [keyword, "objection"] : ["objection"]);
}
