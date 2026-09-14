// Lead priority scoring: a 0–100 score computed from engagement + value
// signals. Score ≥ 80 auto-flags a lead as VIP / high-value so the AI
// assistant and automation engine can fast-track it (spec §4: "Flag
// high-value/VIP leads").

export const VIP_SCORE_THRESHOLD = 80;

export type ScoreInputs = {
  respondedToContact: boolean;
  daysSinceLastActivity: number;
  serviceDateWithinDays: number | null; // how soon the trip is
  estimatedPrice: number | null;
  isRepeatClient: boolean;
  customerTier: string; // STANDARD | VIP | VVIP | CORPORATE
  vehicleIsLuxuryTier: boolean; // Rolls-Royce/Bentley/Maybach/Lamborghini/exotic
  hasQuoteSent: boolean;
  interactionCount: number;
};

export function scoreLead(inputs: ScoreInputs): { score: number; breakdown: { label: string; points: number }[] } {
  const breakdown: { label: string; points: number }[] = [];

  if (inputs.respondedToContact) breakdown.push({ label: "Customer has responded", points: 10 });

  if (inputs.daysSinceLastActivity <= 1) breakdown.push({ label: "Contacted within 24 hours", points: 12 });
  else if (inputs.daysSinceLastActivity <= 3) breakdown.push({ label: "Contacted within 3 days", points: 6 });
  else breakdown.push({ label: `${inputs.daysSinceLastActivity} days since last contact`, points: -8 });

  if (inputs.serviceDateWithinDays !== null) {
    if (inputs.serviceDateWithinDays <= 2) breakdown.push({ label: "Trip is within 48 hours", points: 18 });
    else if (inputs.serviceDateWithinDays <= 7) breakdown.push({ label: "Trip is this week", points: 10 });
    else breakdown.push({ label: "Trip is further out", points: 3 });
  }

  if (inputs.estimatedPrice !== null) {
    if (inputs.estimatedPrice >= 3000) breakdown.push({ label: "High estimated value (≥ $3,000)", points: 22 });
    else if (inputs.estimatedPrice >= 1000) breakdown.push({ label: "Solid estimated value (≥ $1,000)", points: 10 });
  }

  if (inputs.isRepeatClient) breakdown.push({ label: "Repeat client", points: 12 });

  if (inputs.customerTier === "VVIP") breakdown.push({ label: "VVIP client tier", points: 25 });
  else if (inputs.customerTier === "VIP") breakdown.push({ label: "VIP client tier", points: 15 });
  else if (inputs.customerTier === "CORPORATE") breakdown.push({ label: "Corporate account", points: 10 });

  if (inputs.vehicleIsLuxuryTier) breakdown.push({ label: "Top-tier vehicle requested", points: 10 });

  if (inputs.hasQuoteSent) breakdown.push({ label: "Quote already sent", points: 8 });

  breakdown.push({
    label: `${inputs.interactionCount} interaction${inputs.interactionCount === 1 ? "" : "s"} logged`,
    points: Math.min(inputs.interactionCount * 2, 10),
  });

  const raw = breakdown.reduce((sum, b) => sum + b.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return { score, breakdown };
}
