// Intent classification (spec section 6). Rule-based pattern matching over
// the normalized text, ordered from most to least specific so a message
// matching several patterns gets the most useful label. Every rule also
// carries a base confidence, which the Confidence Engine then adjusts for
// missing context (see confidence-engine.ts).
//
// This runs standalone (no API key, no network call) so the assistant is
// fully testable and usable offline — see scripts/tiktok-ai-eval.ts. When
// a real LLM provider is wired in later (src/lib/tiktok/llm-provider.ts,
// activated the same way src/lib/ai/provider.ts activates OpenAI), it can
// replace or augment this classifier without touching anything downstream.

import type { TikTokIntent } from "@/lib/constants";
import type { Entities, IntentClassification } from "@/lib/tiktok/types";

type Rule = {
  intent: TikTokIntent;
  confidence: number;
  label: string;
  test: (t: string, e: Entities) => boolean;
};

const RULES: Rule[] = [
  { intent: "CASUAL", confidence: 65, label: "short acknowledgment / emoji-only", test: (_t, e) => e.isShortAcknowledgment },
  {
    intent: "DRIVERS_LICENSE",
    confidence: 82,
    label: "driver's license",
    test: (t) => /(driver'?s? licen[sc]e|do i need a licen[sc]e|no licen[sc]e|licen[sc]e (is )?suspended)/.test(t),
  },
  { intent: "TEST_DRIVE", confidence: 90, label: "mentions test drive", test: (t) => /\btest ?drive\b/.test(t) },
  {
    intent: "APPOINTMENT_REQUEST",
    confidence: 88,
    label: "appointment keywords",
    test: (t) =>
      /\b(come (in|by)|stop by|swing by|set up an appointment|schedule (a|an)|book (a|an) appointment|come see|come check it out|come look at|when can i come)\b/.test(t),
  },
  {
    intent: "VEHICLE_AVAILABILITY",
    confidence: 85,
    label: "availability within a budget",
    test: (t, e) => /\b(got|have|anything|any(thing)? available)\b.*\bdown\b/.test(t) && e.downPaymentAmount !== null,
  },
  {
    intent: "VEHICLE_AVAILABILITY",
    confidence: 60,
    label: "wants something soon",
    test: (t) =>
      /\b(trying to get|want to get|need)\b.*\b(asap|soon|today|right now|this week)\b/.test(t) ||
      /\basap\b.*\b(car|vehicle|ride|whip|something)\b/.test(t),
  },
  {
    intent: "DOWN_PAYMENT",
    confidence: 85,
    label: "down payment keywords",
    test: (t, e) => /down payment|money down|how much down|to put down|get me in (that|it|this)|need down/.test(t) || e.downPaymentAmount !== null,
  },
  {
    intent: "MONTHLY_PAYMENT",
    confidence: 85,
    label: "monthly payment keywords",
    test: (t, e) =>
      /(monthly payment|a month\b|per month|\/mo\b|payments? (look|looking)|what.*(payment|monthly)|looking like monthly)/.test(t) ||
      e.monthlyPaymentAmount !== null,
  },
  {
    intent: "BAD_CREDIT",
    confidence: 82,
    label: "bad credit",
    test: (t) => /(bad credit|poor credit|credit is (pretty |kind of |really |very )?(bad|rough|not (good|great))|repo(ssession|'?d)?|bankruptcy)/.test(t),
  },
  {
    intent: "NO_CREDIT",
    confidence: 82,
    label: "no credit",
    test: (t) => /(no credit\b|never had credit|don'?t have (any )?credit|credit invisible|building credit)/.test(t),
  },
  {
    intent: "FIRST_TIME_BUYER",
    confidence: 80,
    label: "first-time buyer",
    test: (t) => /(first time buy(er|ing)|never (bought|financed|owned) a car|never had a car loan)/.test(t),
  },
  {
    intent: "FINANCING",
    confidence: 78,
    label: "financing",
    test: (t) => /(financ(e|ing)|interest rate|\bapr\b|loan term|buy here pay here|\bbhph\b)/.test(t),
  },
  {
    intent: "CREDIT",
    confidence: 72,
    label: "credit (generic)",
    test: (t) => /\bcredit\b|approval odds|get approved|do i qualify\b/.test(t),
  },
  {
    intent: "TRADE_IN",
    confidence: 82,
    label: "trade-in",
    test: (t) => /(trade ?in|trade it in|have a trade|what.*trade.*worth|trading in|as a trade\b)/.test(t),
  },
  { intent: "APPLICATION", confidence: 78, label: "application", test: (t) => /\bapplication\b|\bapply\b|credit app\b/.test(t) },
  {
    intent: "DOCUMENTS_NEEDED",
    confidence: 80,
    label: "documents needed",
    test: (t) => /(what (documents? )?do i need to bring|documents? (needed|required)|paperwork|pay ?stubs?|proof of income|proof of residence)/.test(t),
  },
  {
    intent: "DEALERSHIP_HOURS",
    confidence: 85,
    label: "hours",
    test: (t) => /\b(hours|what time.*(open|close)|when (do|are) you (open|close))\b/.test(t),
  },
  {
    intent: "DEALERSHIP_LOCATION",
    confidence: 85,
    label: "location",
    test: (t) => /\b(where are you located|address|what'?s the address|where'?s the dealership|directions)\b/.test(t),
  },
  {
    intent: "VEHICLE_AVAILABILITY",
    confidence: 78,
    label: "availability",
    test: (t) =>
      /(you (all )?(still )?got|do you (all )?(still )?have|is (it|that|this|the [a-z]+) (still )?(available|in stock|there)|got anything|any(thing)? (in stock|available)|still have)/.test(
        t
      ),
  },
  {
    intent: "VEHICLE_PRICE",
    confidence: 80,
    label: "price",
    test: (t) => /(how much (is|for)|what'?s the price|price on|asking price|out the door price|\botd\b|price wise|looking price)/.test(t),
  },
  {
    intent: "VEHICLE_INFO",
    confidence: 72,
    label: "vehicle info",
    test: (t) => /(mileage|miles on it|what color|features|specs\b|engine|transmission)/.test(t),
  },
  {
    intent: "FOLLOW_UP",
    confidence: 68,
    label: "follow-up",
    test: (t) => /(just checking|following up|any update|still (there|interested)|haven'?t heard back)/.test(t),
  },
  {
    intent: "OBJECTION",
    confidence: 75,
    label: "objection",
    test: (t) => /(too (expensive|much|high)|out of my (budget|price range)|can'?t afford|need a better (deal|price)|cheaper (somewhere|elsewhere))/.test(t),
  },
  {
    intent: "HESITATION",
    confidence: 62,
    label: "hesitation",
    test: (t) => /(still thinking|not sure yet|need to think about it|talk to my (wife|husband|spouse|partner))/.test(t),
  },
  {
    intent: "SPAM",
    confidence: 85,
    label: "spam",
    test: (t) => /(check out my page|follow (me|for follow)|dm me for|make \$\d+ (a|per) (day|week)|work from home|click (the|this) link|https?:\/\/|onlyfans)/.test(t),
  },
  {
    intent: "CASUAL",
    confidence: 60,
    label: "casual greeting",
    test: (t) => /^(hey|hi|hello|yo|sup|what'?s up|good (morning|afternoon|evening))\b/.test(t) && t.length < 30,
  },
  { intent: "GENERAL_INQUIRY", confidence: 50, label: "generic question", test: (t) => /\?/.test(t) },
];

export function classifyIntent(normalizedText: string, entities: Entities): IntentClassification {
  for (const rule of RULES) {
    if (rule.test(normalizedText, entities)) {
      return { intent: rule.intent, baseConfidence: rule.confidence, matchedRule: rule.label };
    }
  }
  return { intent: "UNCLEAR", baseConfidence: 25, matchedRule: "no pattern matched" };
}
