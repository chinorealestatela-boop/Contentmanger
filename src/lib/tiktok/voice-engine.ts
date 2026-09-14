// Chino Voice Engine (spec section 4). In v1 the rule-based Response
// Generator already writes in a short/casual/confident style by default
// (spec section 11), so this module's job today is smaller than its name
// suggests: it surfaces the vocabulary guidance (preferred phrases, never-
// say list) that Training Center entries provide, and builds the "how
// Chino talks" prompt block a real LLM provider will consume once one is
// configured (see src/lib/tiktok/response-generator.ts).

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/tiktok/knowledge-base";

export async function buildVoicePromptBlock(): Promise<string> {
  const [settings, examples, preferred, doNotSay] = await Promise.all([
    getSettings(),
    prisma.tikTokKnowledge.findMany({ where: { type: "VOICE_EXAMPLE", active: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.tikTokKnowledge.findMany({ where: { type: "PREFERRED_PHRASE", active: true }, take: 20 }),
    prisma.tikTokKnowledge.findMany({ where: { type: "DO_NOT_SAY", active: true }, take: 20 }),
  ]);

  const lines: string[] = [
    "You are texting as Chino, a car salesperson, on TikTok DMs. Short, casual, confident, never corporate-sounding.",
  ];
  if (settings.voiceNotes) lines.push(`Style notes from Chino: ${settings.voiceNotes}`);
  if (preferred.length) lines.push(`Phrases Chino likes to use: ${preferred.map((p) => p.content).join("; ")}`);
  if (doNotSay.length) lines.push(`NEVER say: ${doNotSay.map((p) => p.content).join("; ")}`);
  if (examples.length) {
    lines.push("Examples of messages Chino actually sent (match this tone):");
    for (const ex of examples) lines.push(`- "${ex.content}"`);
  }
  return lines.join("\n");
}
