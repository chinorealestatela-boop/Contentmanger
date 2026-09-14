// Understanding Engine (spec section 1): turns a raw, possibly slang-heavy
// message into a normalized form, a plain-English paraphrase of what the
// AI thinks the customer means, and a list of anything it's missing to
// answer confidently. This is what shows up as "AI's interpretation" on
// the Human Review screen (spec section 9) — the goal is that Chino can
// read the paraphrase and immediately tell whether the AI got it right,
// without re-reading the raw slang himself.

import type { TikTokIntent } from "@/lib/constants";
import { normalizeText } from "@/lib/tiktok/normalize";
import { extractEntities } from "@/lib/tiktok/entities";
import type { ConversationFacts, Understanding } from "@/lib/tiktok/types";
import type { IntentClassification } from "@/lib/tiktok/types";

const NEEDS_VEHICLE_CONTEXT: TikTokIntent[] = ["VEHICLE_PRICE", "MONTHLY_PAYMENT", "VEHICLE_INFO"];

// Only these intents actually need to know *which* vehicle "it"/"that"
// refers to. A vague referent in "can i test drive it tomorrow" or "can i
// come see it" doesn't block scheduling — no reason to treat those as
// missing information the way a price or payment question would.
const REFERENT_SENSITIVE_INTENTS: TikTokIntent[] = ["VEHICLE_PRICE", "MONTHLY_PAYMENT", "DOWN_PAYMENT", "VEHICLE_INFO", "VEHICLE_AVAILABILITY"];

function paraphraseFor(intent: TikTokIntent, rawText: string, hasVehicleContext: boolean): string {
  switch (intent) {
    case "VEHICLE_AVAILABILITY":
      return "Asking whether a vehicle matching their criteria is available.";
    case "VEHICLE_PRICE":
      return hasVehicleContext ? "Asking the price of the vehicle already discussed." : "Asking a price, but it's unclear which vehicle they mean.";
    case "DOWN_PAYMENT":
      return "Asking how much money they'd need to put down.";
    case "MONTHLY_PAYMENT":
      return hasVehicleContext ? "Asking about the estimated monthly payment for the vehicle discussed." : "Asking about monthly payment, but it's unclear which vehicle.";
    case "FINANCING":
      return "Asking about financing options/process.";
    case "CREDIT":
      return "Asking a credit-related question.";
    case "BAD_CREDIT":
      return "Mentioning they have bad credit, likely wondering if they can still qualify.";
    case "NO_CREDIT":
      return "Mentioning they have no credit history, likely wondering if they can still qualify.";
    case "FIRST_TIME_BUYER":
      return "Mentioning this would be their first vehicle purchase/loan.";
    case "DRIVERS_LICENSE":
      return "Asking a question about driver's license requirements.";
    case "TRADE_IN":
      return "Bringing up a trade-in vehicle.";
    case "APPOINTMENT_REQUEST":
      return "Wanting to schedule a time to come in.";
    case "TEST_DRIVE":
      return "Wanting to schedule or asking about a test drive.";
    case "DEALERSHIP_LOCATION":
      return "Asking where the dealership is located.";
    case "DEALERSHIP_HOURS":
      return "Asking about dealership hours.";
    case "VEHICLE_INFO":
      return "Asking for more details/specs on a vehicle.";
    case "APPLICATION":
      return "Asking about the credit application.";
    case "DOCUMENTS_NEEDED":
      return "Asking what documents/paperwork they need to bring.";
    case "FOLLOW_UP":
      return "Following up on a prior conversation.";
    case "OBJECTION":
      return "Pushing back — price/budget objection.";
    case "HESITATION":
      return "Hesitant / not ready to commit yet.";
    case "CASUAL":
      return "Casual greeting, not asking anything specific yet.";
    case "SPAM":
      return "Looks like spam/promotional content, not a genuine customer inquiry.";
    case "GENERAL_INQUIRY":
      return "Asking a general question.";
    case "UNCLEAR":
    default:
      return `Not confident what they mean by: "${rawText.trim()}"`;
  }
}

export function buildUnderstanding(
  rawText: string,
  classification: IntentClassification,
  facts: Pick<ConversationFacts, "vehicleInterest" | "vehicleId">
): Understanding {
  const normalizedText = normalizeText(rawText);
  const entities = extractEntities(rawText, normalizedText);

  const hasVehicleContext = Boolean(entities.mentionsVehicle || facts.vehicleId || facts.vehicleInterest);
  const requiresInfo: string[] = [];

  if (NEEDS_VEHICLE_CONTEXT.includes(classification.intent) && !hasVehicleContext) {
    requiresInfo.push("which vehicle they're asking about");
  }
  if (entities.hasVagueReferent && !hasVehicleContext && REFERENT_SENSITIVE_INTENTS.includes(classification.intent)) {
    requiresInfo.push("what \"it\"/\"that\" refers to");
  }
  if (entities.questionCount >= 2) {
    requiresInfo.push("multiple questions in one message — confirm each part is addressed");
  }

  const paraphrase = paraphraseFor(classification.intent, rawText, hasVehicleContext);

  return { normalizedText, paraphrase, entities, requiresInfo };
}
