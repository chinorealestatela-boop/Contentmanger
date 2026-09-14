// Entity extraction — pulls structured signals (dollar amounts, vehicle
// mentions, vague referents, short acknowledgments) out of a message.
// Runs on the *raw* text for amounts (before slang normalization touches
// digits) and on the normalized text for everything else.

import type { Entities } from "@/lib/tiktok/types";

const VEHICLE_WORDS =
  "suv|truck|sedan|coupe|van|minivan|convertible|hatchback|wagon|" +
  "toyota|honda|ford|chevy|chevrolet|bmw|nissan|hyundai|kia|jeep|dodge|ram|gmc|" +
  "buick|mazda|subaru|audi|lexus|mercedes|benz|volkswagen|vw|acura|infiniti|" +
  "cadillac|chrysler|mitsubishi|tesla|corolla|camry|civic|accord|altima|sentra|" +
  "silverado|f-?150|f150|tahoe|suburban|equinox|malibu|charger|challenger|wrangler|" +
  "explorer|escape|mustang|cr-?v|rav4|pilot|odyssey|3 series|c-class";

// Individual words that, alone or combined ("cool sounds good", "ok thanks"),
// mean the customer has nothing more to ask — a reply would just be noise.
const ACK_WORDS = new Set([
  "ok", "okay", "k", "kk", "thanks", "thank", "you", "ty", "cool", "nice", "lol", "lmao",
  "haha", "hehe", "sounds", "good", "got", "it", "alright", "great", "awesome", "perfect",
  "sweet", "yep", "yup", "yeah", "nah", "bet",
]);

function parseMoney(s: string): number {
  return parseInt(s.replace(/[,$]/g, ""), 10);
}

export function extractEntities(rawText: string, normalizedText: string): Entities {
  const dollarAmounts: number[] = [];

  // Explicit "$500" / "$1,500" anywhere.
  for (const m of rawText.matchAll(/\$\s?(\d{1,3}(?:,\d{3})*|\d+)/g)) {
    dollarAmounts.push(parseMoney(m[1]));
  }
  // Bare "500 down" / "500 dollars down".
  const downMatch = rawText.match(/(\d{2,6})\s*(?:dollars?|bucks?)?\s*(?:down)\b/i);
  const downPaymentAmount = downMatch ? parseMoney(downMatch[1]) : (/down/i.test(rawText) && dollarAmounts[0]) || null;
  if (downMatch) dollarAmounts.push(parseMoney(downMatch[1]));

  // "300 a month" / "300/mo" / "300 monthly".
  const monthlyMatch = rawText.match(/(\d{2,6})\s*(?:dollars?|bucks?)?\s*(?:\/|a\s|per\s)?\s*(?:mo\.?|month(?:ly)?)\b/i);
  const monthlyPaymentAmount = monthlyMatch ? parseMoney(monthlyMatch[1]) : null;
  if (monthlyMatch) dollarAmounts.push(parseMoney(monthlyMatch[1]));

  const vehicleMatch = normalizedText.match(new RegExp(`\\b(${VEHICLE_WORDS})\\b`, "i"));
  const mentionsVehicle = vehicleMatch ? vehicleMatch[1] : null;

  const timingMatch = normalizedText.match(
    /\b(today|tomorrow|tonight|this weekend|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  );
  const mentionsAppointmentTiming = timingMatch ? timingMatch[1] : null;

  const hasVagueReferent = /\b(it|that|this one|that one|that car|that one there)\b/i.test(normalizedText) && !mentionsVehicle;

  const questionCount = (normalizedText.match(/\?/g) || []).length;

  const ackTokens = normalizedText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const allAckWords = ackTokens.length > 0 && ackTokens.every((t) => ACK_WORDS.has(t));
  const hasLetters = /\p{L}/u.test(rawText);
  const trimmedRaw = rawText.trim();
  // Only actual emoji/symbols count — bare "??" or "!!" is a nudge for a
  // reply, not an acknowledgment that nothing more is needed.
  const hasNonAsciiSymbol = /[^\x00-\x7F]/.test(trimmedRaw);
  const isPureEmojiOrPunct = !hasLetters && hasNonAsciiSymbol && trimmedRaw.length > 0 && trimmedRaw.length <= 8;
  const isShortAcknowledgment = allAckWords || isPureEmojiOrPunct;

  const statesOwnDownPayment = /\b(i (got|have|can do|can put)|got about|got around)\b.*\bdown\b/i.test(rawText) ||
    /\b(i (got|have))\s*\$?\d/i.test(rawText);

  return {
    dollarAmounts,
    downPaymentAmount,
    monthlyPaymentAmount,
    mentionsVehicle,
    mentionsAppointmentTiming,
    hasVagueReferent,
    questionCount,
    isShortAcknowledgment,
    statesOwnDownPayment,
  };
}

// ── Hard triggers (spec section 9) — cheap, deterministic safety net that
// runs regardless of confidence score or whether an LLM is configured. ──

const ANGER_WORDS = /\b(scam|rip ?off|ripped me off|ridiculous|unacceptable|pissed|furious|so angry|wtf|screw (this|you)|bullsh|worst (dealer|dealership|experience|service)|never coming back|f[* ]?ck|piece of (crap|junk|garbage) dealership)\b/i;

const LEGAL_WORDS = /\b(lawyer|attorney|su(e|ing) (you|the dealership)|lawsuit|legal action|bbb|better business bureau|consumer protection|file a complaint|report (you|this) to)\b/i;

const HUMAN_REQUEST_WORDS = /\b(real (person|human)|actual person|speak (to|with) (a )?(person|human|manager|chino)|talk to (chino|a manager|a real|someone)|is this a bot|are you a bot|are you (an? )?ai|is this automated)\b/i;

const DISPUTE_WORDS = /\b(that'?s not what (we|you) agreed|you (lied|promised)|bait and switch|never agreed to (that|this)|you told me|changed the (deal|price) on me)\b/i;

const COMPLAINT_WORDS = /\b(terrible service|horrible experience|worst dealership|complain(t|ing) about|unhappy with (my|the) (purchase|deal|car|vehicle))\b/i;

export function detectHardTrigger(rawText: string): { reason: string; label: string } | null {
  if (ANGER_WORDS.test(rawText)) return { reason: "ANGRY_CUSTOMER", label: "Customer language suggests anger/frustration" };
  if (LEGAL_WORDS.test(rawText)) return { reason: "LEGAL_THREAT", label: "Customer mentioned legal action" };
  if (DISPUTE_WORDS.test(rawText)) return { reason: "DISPUTE", label: "Customer is disputing a prior deal/agreement" };
  if (COMPLAINT_WORDS.test(rawText)) return { reason: "COMPLAINT", label: "Customer is complaining about the dealership" };
  if (HUMAN_REQUEST_WORDS.test(rawText)) return { reason: "REQUESTED_HUMAN", label: "Customer asked to speak with a real person" };
  return null;
}
