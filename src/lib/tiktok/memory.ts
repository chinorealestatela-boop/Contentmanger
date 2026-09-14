// Context Memory (spec section 12). Pulls durable facts out of a message
// so the conversation profile (spec section 13) fills in gradually and the
// AI never re-asks for something the customer already said.

import type { TikTokIntent } from "@/lib/constants";
import type { Entities, FactExtraction } from "@/lib/tiktok/types";

export function extractFacts(intent: TikTokIntent, entities: Entities): FactExtraction {
  const facts: FactExtraction = {};

  if (entities.mentionsVehicle) {
    facts.vehicleInterest = entities.mentionsVehicle;
  }

  if (intent === "DOWN_PAYMENT" && entities.statesOwnDownPayment && entities.downPaymentAmount) {
    facts.desiredDownPayment = entities.downPaymentAmount;
  }

  if (intent === "MONTHLY_PAYMENT" && entities.monthlyPaymentAmount) {
    facts.desiredMonthlyPayment = entities.monthlyPaymentAmount;
  }

  if (intent === "TRADE_IN") {
    facts.hasTradeIn = true;
  }

  if (intent === "APPOINTMENT_REQUEST" || intent === "TEST_DRIVE") {
    facts.appointmentRequested = true;
  }

  return facts;
}
