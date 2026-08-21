// AI provider adapter interface.
//
// v1 ships with only `internalProvider` — a deterministic, rule-based
// engine that reads directly from the CRM database and needs no API key.
// A real LLM provider (OpenAI, Anthropic, etc.) can be dropped in later by
// implementing this same interface and switching `getActiveProvider()`
// once an API key is present in Settings → Integrations. No other code in
// the app needs to change.

import type { Scope } from "@/lib/queries/scope";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

export type AssistantProvider = {
  id: string;
  name: string;
  requiresApiKey: boolean;
  isConfigured: () => Promise<boolean>;
  respond: (input: { query: string; history: AssistantMessage[]; scope: Scope }) => Promise<{ answer: string; suggestions?: string[] }>;
};

export async function getActiveProvider(): Promise<AssistantProvider> {
  // Future: check Integration table for an enabled + configured OPENAI row
  // and return an OpenAI-backed provider instead. For now, always internal.
  const { internalProvider } = await import("@/lib/ai/internal-provider");
  return internalProvider;
}
