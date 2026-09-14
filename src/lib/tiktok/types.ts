// Shared types for the TikTok AI Messaging Assistant pipeline. See
// src/lib/tiktok/pipeline.ts for how these compose, and AGENTS.md-adjacent
// docs in README.md ("TikTok AI Assistant") for the architecture overview.

import type { TikTokIntent } from "@/lib/constants";

export type Entities = {
  dollarAmounts: number[];
  downPaymentAmount: number | null; // a number the message ties specifically to a down payment
  monthlyPaymentAmount: number | null; // a number tied specifically to a monthly payment
  mentionsVehicle: string | null; // free-text vehicle description found in *this* message
  mentionsAppointmentTiming: string | null; // "saturday", "tomorrow", "this weekend", etc.
  hasVagueReferent: boolean; // message uses "it" / "that" / "this one" without naming a vehicle
  questionCount: number;
  isShortAcknowledgment: boolean; // "ok", "thanks", "lol", emoji-only, etc.
  statesOwnDownPayment: boolean; // "i got 1500 down" vs. asking "how much down"
};

export type Understanding = {
  normalizedText: string;
  paraphrase: string; // plain-English restatement of what the AI thinks they mean
  entities: Entities;
  requiresInfo: string[]; // what's missing to answer confidently, if anything
};

export type IntentClassification = {
  intent: TikTokIntent;
  baseConfidence: number; // 0-100, from pattern matching alone
  matchedRule: string;
};

export type HardTrigger = {
  reason:
    | "ANGRY_CUSTOMER"
    | "LEGAL_THREAT"
    | "SENSITIVE_TOPIC"
    | "DISPUTE"
    | "COMPLAINT"
    | "REQUESTED_HUMAN"
    | "UNAUTHORIZED_REQUEST";
  label: string;
};

export type ConfidenceResult = {
  score: number; // 0-100 final confidence, after all adjustments
  missingInfo: string[];
};

export type ConversationFacts = {
  tiktokUsername: string;
  vehicleInterest: string | null;
  vehicleId: string | null;
  desiredDownPayment: number | null;
  desiredMonthlyPayment: number | null;
  hasTradeIn: boolean | null;
  applicationStatus: string;
  appointmentRequested: boolean;
};

export type GeneratedResponse =
  | { kind: "ANSWER"; text: string; factsUsed: string[] }
  | { kind: "CLARIFY"; text: string }
  | { kind: "ESCALATE"; reason: string; note?: string }
  | { kind: "SILENT" };

export type PipelineOutcome =
  | { action: "SILENT" }
  | {
      action: "ESCALATE";
      reason: string;
      aiInterpretation: string;
      suggestedResponses: string[];
    }
  | {
      action: "RESPOND";
      text: string;
      autoSend: boolean; // true only when confidence clears the auto-send bar and mode allows it
    };

export type FactExtraction = Partial<{
  vehicleInterest: string;
  desiredDownPayment: number;
  desiredMonthlyPayment: number;
  hasTradeIn: boolean;
  appointmentRequested: boolean;
}>;
