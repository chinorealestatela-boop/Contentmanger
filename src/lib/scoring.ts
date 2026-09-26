// Lead scoring: a 0–100 score computed from engagement signals.
// HOT 80–100 · WARM 50–79 · COLD 0–49

import type { Temperature } from "@/lib/constants";

export function classifyScore(score: number): Temperature {
  if (score >= 80) return "HOT";
  if (score >= 50) return "WARM";
  return "COLD";
}

export type ScoreInputs = {
  respondedToContact: boolean;
  daysSinceLastActivity: number;
  hasUpcomingAppointment: boolean;
  appointmentConfirmed: boolean;
  completedTestDrive: boolean;
  creditAppStatus: string; // NOT_STARTED | PENDING | SUBMITTED | APPROVED | DECLINED
  hasTrade: boolean;
  purchaseTimeframe: string | null; // IMMEDIATE | THIS_WEEK | THIS_MONTH | THIS_QUARTER | RESEARCHING
  vehicleAvailable: boolean;
  interactionCount: number;
  daysSinceFinancingRequest: number | null; // null = never asked about financing
};

// Weighted point breakdown — kept as small named steps so the automation
// engine / AI assistant can explain *why* a lead scored the way it did.
export function scoreLead(inputs: ScoreInputs): { score: number; breakdown: { label: string; points: number }[] } {
  const breakdown: { label: string; points: number }[] = [];

  if (inputs.respondedToContact) breakdown.push({ label: "Customer has responded", points: 12 });

  if (inputs.daysSinceLastActivity <= 1) breakdown.push({ label: "Contacted within 24 hours", points: 15 });
  else if (inputs.daysSinceLastActivity <= 3) breakdown.push({ label: "Contacted within 3 days", points: 8 });
  else if (inputs.daysSinceLastActivity <= 7) breakdown.push({ label: "Contacted within a week", points: 2 });
  else breakdown.push({ label: `${inputs.daysSinceLastActivity} days since last activity`, points: -10 });

  if (inputs.hasUpcomingAppointment) breakdown.push({ label: "Appointment scheduled", points: 15 });
  if (inputs.appointmentConfirmed) breakdown.push({ label: "Appointment confirmed", points: 8 });
  if (inputs.completedTestDrive) breakdown.push({ label: "Completed a test drive", points: 18 });

  if (inputs.creditAppStatus === "SUBMITTED") breakdown.push({ label: "Credit application submitted", points: 10 });
  if (inputs.creditAppStatus === "APPROVED") breakdown.push({ label: "Credit approved", points: 16 });

  if (inputs.hasTrade) breakdown.push({ label: "Has a trade-in", points: 5 });

  // A customer actively asking about financing is a strong buying signal on
  // its own — enough to read HOT even with no other engagement yet — that
  // fades on its own as it ages rather than needing to be cleared manually.
  if (inputs.daysSinceFinancingRequest !== null) {
    if (inputs.daysSinceFinancingRequest <= 7) breakdown.push({ label: "Asked about financing this week", points: 70 });
    else if (inputs.daysSinceFinancingRequest <= 30) breakdown.push({ label: "Asked about financing this month", points: 30 });
  }

  switch (inputs.purchaseTimeframe) {
    case "IMMEDIATE":
      breakdown.push({ label: "Buying immediately", points: 20 });
      break;
    case "THIS_WEEK":
      breakdown.push({ label: "Buying this week", points: 14 });
      break;
    case "THIS_MONTH":
      breakdown.push({ label: "Buying this month", points: 8 });
      break;
    case "THIS_QUARTER":
      breakdown.push({ label: "Buying this quarter", points: 3 });
      break;
    case "RESEARCHING":
      breakdown.push({ label: "Just researching", points: -5 });
      break;
  }

  if (inputs.vehicleAvailable) breakdown.push({ label: "Vehicle of interest is available", points: 5 });
  else breakdown.push({ label: "Vehicle of interest unavailable", points: -12 });

  breakdown.push({
    label: `${inputs.interactionCount} interaction${inputs.interactionCount === 1 ? "" : "s"} logged`,
    points: Math.min(inputs.interactionCount * 2, 12),
  });

  const raw = breakdown.reduce((sum, b) => sum + b.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return { score, breakdown };
}
