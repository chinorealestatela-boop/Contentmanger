// Safety / Hallucination Guard (spec sections 3, 18). Runs on every
// AI-generated draft right before it would be sent or shown, independent
// of how the draft was produced (rule-based today, an LLM later). Two
// checks:
//
// 1. No unverified numbers/claims — any dollar amount, percentage, or
//    approval-style claim in the draft must trace back to a fact the
//    response generator explicitly marked as used (verified against the
//    CRM's own data or Training Center knowledge). Anything else blocks
//    the send and forces a human-review escalation instead.
// 2. No banned phrases — anything in the "Never Say This" knowledge list.

const MONEY_OR_PERCENT = /\$\s?\d[\d,]*(?:\.\d+)?|\b\d{1,3}(?:\.\d+)?\s?%/g;
const APPROVAL_CLAIM = /\b(you'?re approved|you (are|have been) approved|guaranteed approval|100% approved)\b/i;

export function scanForHallucination(text: string, factsUsed: string[]): { safe: boolean; reason?: string } {
  if (APPROVAL_CLAIM.test(text)) {
    return { safe: false, reason: "Draft claims a credit approval, which the AI cannot verify." };
  }
  const found = text.match(MONEY_OR_PERCENT) ?? [];
  for (const token of found) {
    const normalized = token.replace(/\s/g, "");
    const covered = factsUsed.some((fact) => fact.replace(/\s/g, "").includes(normalized));
    if (!covered) {
      return { safe: false, reason: `Draft states "${token}" without a verified source.` };
    }
  }
  return { safe: true };
}

export function containsBannedPhrase(text: string, bannedPhrases: string[]): string | null {
  const lower = text.toLowerCase();
  for (const phrase of bannedPhrases) {
    if (phrase && lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}
