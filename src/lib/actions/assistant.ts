"use server";

import { requireScope } from "@/lib/queries/scope";
import { getActiveProvider, type AssistantMessage } from "@/lib/ai/provider";

export async function askAssistant(query: string, history: AssistantMessage[] = []) {
  const scope = await requireScope();
  const provider = await getActiveProvider();
  const result = await provider.respond({ query, history, scope });
  return { ...result, providerName: provider.name };
}
