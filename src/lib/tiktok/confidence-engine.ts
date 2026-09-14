// Confidence Engine (spec section 2). Takes the intent classification +
// understanding and produces a single 0-100 score plus a list of anything
// missing. This score alone gates whether a response is even attempted —
// see pipeline.ts for how it's combined with the safety guard and mode
// settings to make the final send/draft/escalate decision.
//
// Deliberately conservative: confidence is *capped*, never boosted, by
// ambiguity signals. A well-matched pattern on an ambiguous referent still
// can't clear the auto-send bar.

import type { TikTokIntent } from "@/lib/constants";
import type { ConfidenceResult, Entities, IntentClassification, Understanding } from "@/lib/tiktok/types";

// Intents where getting the answer wrong is especially costly (money,
// credit, legal-adjacent) — these get a stricter ceiling when anything is
// uncertain, per spec section 3 ("never guess" list).
const HIGH_STAKES_INTENTS: TikTokIntent[] = [
  "VEHICLE_PRICE",
  "DOWN_PAYMENT",
  "MONTHLY_PAYMENT",
  "FINANCING",
  "CREDIT",
  "BAD_CREDIT",
  "NO_CREDIT",
  "TRADE_IN",
];

export function computeConfidence(classification: IntentClassification, understanding: Understanding): ConfidenceResult {
  let score = classification.baseConfidence;
  const missingInfo = [...understanding.requiresInfo];
  const entities: Entities = understanding.entities;

  if (understanding.requiresInfo.length > 0 && HIGH_STAKES_INTENTS.includes(classification.intent)) {
    // Can't identify the vehicle/amount in play for a money question —
    // hard cap well below the draft threshold rather than guess.
    score = Math.min(score, 40);
  } else if (understanding.requiresInfo.length > 0) {
    score = Math.min(score, 55);
  }

  if (entities.questionCount >= 2) {
    score -= 8; // multiple questions in one message — more can go wrong
  }

  if (classification.intent === "UNCLEAR") {
    score = Math.min(score, 30);
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), missingInfo };
}
