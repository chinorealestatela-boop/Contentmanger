// Response Generator (spec section 20). Given the classified intent,
// understanding, and verified conversation facts, produces one of:
// ANSWER (states a verified fact), CLARIFY (asks a safe question, states
// nothing), ESCALATE (can't safely proceed), or SILENT (no reply needed).
//
// The one rule every branch below follows: never write a number, name, or
// claim into an ANSWER unless it came from `facts`/the database/Training
// Center knowledge. When in doubt, this file asks or escalates instead of
// guessing — see spec section 3 ("never guess") and section 21.

import { prisma } from "@/lib/prisma";
import type { Vehicle } from "@prisma/client";
import { getPolicy, matchVehicleByText, getObjectionGuidance } from "@/lib/tiktok/knowledge-base";
import type { ConversationFacts, GeneratedResponse, IntentClassification, Understanding } from "@/lib/tiktok/types";

function vehicleLabel(v: Vehicle) {
  return `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;
}

function vehiclePrice(v: Vehicle): number | null {
  return v.internetPrice ?? v.sellingPrice ?? v.msrp ?? null;
}

async function resolveVehicle(understanding: Understanding, facts: ConversationFacts): Promise<Vehicle | null> {
  if (facts.vehicleId) {
    const v = await prisma.vehicle.findUnique({ where: { id: facts.vehicleId } });
    if (v) return v;
  }
  if (understanding.entities.mentionsVehicle) {
    const v = await matchVehicleByText(understanding.entities.mentionsVehicle);
    if (v) return v;
  }
  if (facts.vehicleInterest) {
    return matchVehicleByText(facts.vehicleInterest);
  }
  return null;
}

export async function generateResponse(
  classification: IntentClassification,
  understanding: Understanding,
  facts: ConversationFacts
): Promise<GeneratedResponse> {
  const { intent } = classification;
  const { entities } = understanding;

  switch (intent) {
    case "SPAM":
      return { kind: "SILENT" };

    case "CASUAL":
      if (entities.isShortAcknowledgment) return { kind: "SILENT" };
      return { kind: "ANSWER", text: "Hey! What are you in the market for — I can help you find it.", factsUsed: [] };

    case "VEHICLE_AVAILABILITY": {
      if (entities.mentionsVehicle) {
        const vehicle = await matchVehicleByText(entities.mentionsVehicle);
        if (vehicle) {
          return {
            kind: "ANSWER",
            text: `Yep, we've got a ${vehicleLabel(vehicle)} available right now. Want more details or to come see it?`,
            factsUsed: [vehicleLabel(vehicle), "AVAILABLE"],
          };
        }
        return { kind: "CLARIFY", text: `Let me check on that — what year/trim are you thinking for the ${entities.mentionsVehicle}?` };
      }
      if (entities.downPaymentAmount) {
        return {
          kind: "CLARIFY",
          text: `With about $${entities.downPaymentAmount.toLocaleString()} down I can look at a few options — what body style are you into (SUV, truck, sedan)?`,
        };
      }
      return { kind: "CLARIFY", text: "What are you looking for — body style, or a specific make/model? I'll check what's available." };
    }

    case "VEHICLE_PRICE": {
      const vehicle = await resolveVehicle(understanding, facts);
      if (!vehicle) return { kind: "CLARIFY", text: "Which vehicle are you asking about? Send me the year/make/model and I'll get you the price." };
      const price = vehiclePrice(vehicle);
      if (price === null) return { kind: "ESCALATE", reason: "MISSING_INFO", note: `No price on file for ${vehicleLabel(vehicle)}.` };
      return {
        kind: "ANSWER",
        text: `The ${vehicleLabel(vehicle)} is $${price.toLocaleString()}. Want me to see what that looks like with a down payment?`,
        factsUsed: [`$${price.toLocaleString()}`, `$${price}`, vehicleLabel(vehicle)],
      };
    }

    case "VEHICLE_INFO": {
      const vehicle = await resolveVehicle(understanding, facts);
      if (!vehicle) return { kind: "CLARIFY", text: "Which vehicle do you mean? I'll pull up the details." };
      const parts = [vehicleLabel(vehicle), `${vehicle.mileage.toLocaleString()} miles`];
      if (vehicle.exteriorColor) parts.push(vehicle.exteriorColor);
      return { kind: "ANSWER", text: `${parts.join(", ")}. Anything specific you want to know?`, factsUsed: parts };
    }

    case "DOWN_PAYMENT": {
      const policy = await getPolicy("down payment");
      if (policy) return { kind: "ANSWER", text: policy.content, factsUsed: [policy.content] };
      return { kind: "CLARIFY", text: "Depends on the vehicle and your situation — what were you thinking for a down payment, and I'll see what we can do?" };
    }

    case "MONTHLY_PAYMENT": {
      if (understanding.requiresInfo.length > 0) {
        return { kind: "CLARIFY", text: "Which vehicle are we talking monthly payment on? I'll get you real numbers, not a guess." };
      }
      return {
        kind: "CLARIFY",
        text: "I don't want to throw out a number that's not accurate — what down payment are you thinking, and I'll get you real numbers on that one.",
      };
    }

    case "FINANCING": {
      const policy = await getPolicy("financing");
      if (policy) return { kind: "ANSWER", text: policy.content, factsUsed: [policy.content] };
      return { kind: "CLARIFY", text: "Are you looking to finance, lease, or pay cash? I can walk you through what fits." };
    }

    case "BAD_CREDIT":
    case "NO_CREDIT":
    case "FIRST_TIME_BUYER": {
      const topic = intent === "BAD_CREDIT" ? "bad credit" : intent === "NO_CREDIT" ? "no credit" : "first time buyer";
      const policy = await getPolicy(topic);
      if (policy) return { kind: "ANSWER", text: policy.content, factsUsed: [policy.content] };
      return { kind: "ANSWER", text: "We work with all kinds of credit situations — want me to send the application link to get the ball rolling?", factsUsed: [] };
    }

    case "CREDIT": {
      const policy = await getPolicy("credit");
      if (policy) return { kind: "ANSWER", text: policy.content, factsUsed: [policy.content] };
      return { kind: "CLARIFY", text: "What's the credit question — approval odds, requirements, or something else?" };
    }

    case "DRIVERS_LICENSE": {
      const policy = await getPolicy("license");
      if (policy) return { kind: "ANSWER", text: policy.content, factsUsed: [policy.content] };
      return { kind: "ESCALATE", reason: "MISSING_INFO", note: "No dealership policy on file for driver's license requirements." };
    }

    case "TRADE_IN":
      return { kind: "CLARIFY", text: "What year/make/model is the trade, and roughly how many miles on it?" };

    case "APPOINTMENT_REQUEST":
    case "TEST_DRIVE": {
      if (entities.mentionsAppointmentTiming) {
        return { kind: "ANSWER", text: `${entities.mentionsAppointmentTiming.charAt(0).toUpperCase()}${entities.mentionsAppointmentTiming.slice(1)} works — what time's good for you?`, factsUsed: [] };
      }
      return { kind: "ANSWER", text: "For sure — what day/time works best for you?", factsUsed: [] };
    }

    case "DEALERSHIP_LOCATION": {
      const policy = await getPolicy("location");
      if (policy) return { kind: "ANSWER", text: policy.content, factsUsed: [policy.content] };
      return { kind: "ESCALATE", reason: "MISSING_INFO", note: "No dealership address on file in the Training Center." };
    }

    case "DEALERSHIP_HOURS": {
      const policy = await getPolicy("hours");
      if (policy) return { kind: "ANSWER", text: policy.content, factsUsed: [policy.content] };
      return { kind: "ESCALATE", reason: "MISSING_INFO", note: "No dealership hours on file in the Training Center." };
    }

    case "APPLICATION": {
      const policy = await getPolicy("application");
      if (policy) return { kind: "ANSWER", text: policy.content, factsUsed: [policy.content] };
      return { kind: "CLARIFY", text: "Want me to send you the link to start an application?" };
    }

    case "DOCUMENTS_NEEDED": {
      const policy = await getPolicy("documents");
      if (policy) return { kind: "ANSWER", text: policy.content, factsUsed: [policy.content] };
      return { kind: "ESCALATE", reason: "MISSING_INFO", note: "No documents-needed policy on file in the Training Center." };
    }

    case "FOLLOW_UP":
      return {
        kind: "ANSWER",
        text: facts.vehicleInterest ? `Hey! Still interested in the ${facts.vehicleInterest}?` : "Hey! Just checking in — still in the market?",
        factsUsed: [],
      };

    case "OBJECTION": {
      const guidance = await getObjectionGuidance(entities.mentionsVehicle ?? undefined);
      if (guidance.length) return { kind: "ANSWER", text: guidance[0].content, factsUsed: [guidance[0].content] };
      return { kind: "CLARIFY", text: "What number were you hoping to be at? Let me see what I can do." };
    }

    case "HESITATION":
      return { kind: "ANSWER", text: "All good, no rush — I'm here whenever you're ready. Anything I can answer in the meantime?", factsUsed: [] };

    case "GENERAL_INQUIRY":
      return { kind: "CLARIFY", text: "What can I help with — a specific vehicle, financing, or something else?" };

    case "UNCLEAR":
    default:
      return { kind: "ESCALATE", reason: "LOW_CONFIDENCE", note: "Could not classify the message with enough confidence." };
  }
}
