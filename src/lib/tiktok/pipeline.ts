// The orchestrator (spec section 20's "architecture", wired together).
// Every inbound TikTok message runs through here exactly once. This is
// the one place that enforces the hierarchy from spec section 18:
//
//   1. Understand the customer      -> understanding-engine
//   2. Determine intent             -> intent-engine
//   3. Check conversation context   -> facts passed in by the caller
//   4. Check available knowledge    -> knowledge-base (inside response-generator)
//   5. Determine whether answer is known -> response-generator's kind
//   6. Determine confidence         -> confidence-engine
//   7. Determine whether responding is appropriate -> this file
//   8. Respond only if all requirements are satisfied
//
// If any step fails, the result is ESCALATE or SILENT — never a guess.

import type { TikTokMode } from "@/lib/constants";
import { detectHardTrigger, extractEntities } from "@/lib/tiktok/entities";
import { normalizeText } from "@/lib/tiktok/normalize";
import { classifyIntent } from "@/lib/tiktok/intent-engine";
import { buildUnderstanding } from "@/lib/tiktok/understanding-engine";
import { computeConfidence } from "@/lib/tiktok/confidence-engine";
import { generateResponse } from "@/lib/tiktok/response-generator";
import { scanForHallucination, containsBannedPhrase } from "@/lib/tiktok/safety-guard";
import { getSettings, getDoNotSayPhrases } from "@/lib/tiktok/knowledge-base";
import { extractFacts } from "@/lib/tiktok/memory";
import type { ConversationFacts, FactExtraction, IntentClassification, PipelineOutcome, Understanding } from "@/lib/tiktok/types";

export type PipelineResult = {
  classification: IntentClassification;
  understanding: Understanding;
  confidenceScore: number;
  outcome: PipelineOutcome;
  extractedFacts: FactExtraction;
  temperature: string;
};

const HOT_INTENTS = new Set(["APPOINTMENT_REQUEST", "TEST_DRIVE"]);
const WARM_INTENTS = new Set([
  "FINANCING",
  "CREDIT",
  "BAD_CREDIT",
  "NO_CREDIT",
  "FIRST_TIME_BUYER",
  "DOWN_PAYMENT",
  "MONTHLY_PAYMENT",
  "VEHICLE_PRICE",
  "VEHICLE_AVAILABILITY",
  "TRADE_IN",
  "APPLICATION",
]);

function suggestTemperature(outcomeAction: PipelineOutcome["action"], intent: string, appointmentRequested: boolean): string {
  if (outcomeAction === "ESCALATE") return "HUMAN_REVIEW";
  if (intent === "SPAM") return "UNQUALIFIED";
  if (appointmentRequested || HOT_INTENTS.has(intent)) return "HOT";
  if (WARM_INTENTS.has(intent)) return "WARM";
  return "COLD";
}

/** Runs the full understand -> classify -> confidence -> generate ->
 * safety-check pipeline for one inbound message and returns the decision.
 * Does not touch the database — the caller (a server action) persists the
 * TikTokMessage/TikTokEscalation rows and applies extractedFacts. */
export async function runPipeline(rawText: string, facts: ConversationFacts, resolvedMode: TikTokMode): Promise<PipelineResult> {
  const hardTrigger = detectHardTrigger(rawText);
  const normalizedText = normalizeText(rawText);
  const entities = extractEntities(rawText, normalizedText);
  const classification = classifyIntent(normalizedText, entities);
  const understanding = buildUnderstanding(rawText, classification, facts);
  const confidence = computeConfidence(classification, understanding);
  const extractedFacts = extractFacts(classification.intent, entities);

  if (hardTrigger) {
    const outcome: PipelineOutcome = {
      action: "ESCALATE",
      reason: hardTrigger.reason,
      aiInterpretation: hardTrigger.label,
      suggestedResponses: hardTrigger.reason === "REQUESTED_HUMAN" ? ["No problem, let me get Chino on here for you."] : [],
    };
    return { classification, understanding, confidenceScore: confidence.score, outcome, extractedFacts, temperature: "HUMAN_REVIEW" };
  }

  if (resolvedMode === "OFF") {
    const outcome: PipelineOutcome = { action: "SILENT" };
    return { classification, understanding, confidenceScore: confidence.score, outcome, extractedFacts, temperature: suggestTemperature("SILENT", classification.intent, Boolean(extractedFacts.appointmentRequested)) };
  }

  const [settings, banned] = await Promise.all([getSettings(), getDoNotSayPhrases()]);
  const generated = await generateResponse(classification, understanding, facts);

  let outcome: PipelineOutcome;

  if (generated.kind === "SILENT") {
    outcome = { action: "SILENT" };
  } else if (generated.kind === "ESCALATE") {
    outcome = {
      action: "ESCALATE",
      reason: generated.reason,
      aiInterpretation: generated.note ? `${understanding.paraphrase} (${generated.note})` : understanding.paraphrase,
      suggestedResponses: [],
    };
  } else {
    // ANSWER or CLARIFY — run the safety guard before anything else.
    const bannedHit = containsBannedPhrase(generated.text, banned);
    const hallucination = generated.kind === "ANSWER" ? scanForHallucination(generated.text, generated.factsUsed) : { safe: true as const };

    if (bannedHit) {
      outcome = {
        action: "ESCALATE",
        reason: "COMPLEX",
        aiInterpretation: `Draft used a phrase Chino marked as "never say": "${bannedHit}".`,
        suggestedResponses: [generated.text],
      };
    } else if (!hallucination.safe) {
      outcome = {
        action: "ESCALATE",
        reason: "HALLUCINATION_BLOCKED",
        aiInterpretation: hallucination.reason ?? "Draft failed the safety check.",
        suggestedResponses: [generated.text],
      };
    } else {
      const minToSend = generated.kind === "CLARIFY" ? 40 : settings.draftThreshold;
      if (confidence.score < minToSend) {
        outcome = {
          action: "ESCALATE",
          reason: "LOW_CONFIDENCE",
          aiInterpretation: understanding.paraphrase,
          suggestedResponses: [generated.text],
        };
      } else {
        const autoSend = confidence.score >= settings.autoThreshold && resolvedMode === "AUTO";
        outcome = { action: "RESPOND", text: generated.text, autoSend };
      }
    }
  }

  const temperature = suggestTemperature(outcome.action, classification.intent, Boolean(extractedFacts.appointmentRequested));
  return { classification, understanding, confidenceScore: confidence.score, outcome, extractedFacts, temperature };
}
