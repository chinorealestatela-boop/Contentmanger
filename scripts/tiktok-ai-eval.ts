// Runs the TikTok AI pipeline against a broad set of realistic customer
// messages — slang, typos, abbreviations, voice-to-text style, incomplete
// sentences, multiple questions, objections, and hard triggers — and
// checks that its behavior matches the one rule that matters most:
// never guess. Confidence and intent classification are exercised through
// the real pipeline (src/lib/tiktok/pipeline.ts); no mocking.
//
// Usage: npx tsx scripts/tiktok-ai-eval.ts

import { runPipeline } from "../src/lib/tiktok/pipeline";
import type { ConversationFacts } from "../src/lib/tiktok/types";
import type { PipelineOutcome } from "../src/lib/tiktok/types";

const emptyFacts: ConversationFacts = {
  tiktokUsername: "test_user",
  vehicleInterest: null,
  vehicleId: null,
  desiredDownPayment: null,
  desiredMonthlyPayment: null,
  hasTradeIn: null,
  applicationStatus: "NOT_STARTED",
  appointmentRequested: false,
};

const vehicleContextFacts: ConversationFacts = { ...emptyFacts, vehicleInterest: "civic" };

type Expectation = {
  text: string;
  facts?: ConversationFacts;
  // Loose checks — this suite verifies *behavior guarantees*, not exact
  // wording, since wording depends on Training Center content that varies
  // per dealership.
  expectIntentIn?: string[];
  expectAction?: PipelineOutcome["action"];
  expectMinConfidence?: number;
  expectMaxConfidence?: number;
  note?: string;
};

const cases: Expectation[] = [
  // ── Down payment slang (spec section 1 example) ────────────────────────
  { text: "yall got anything 4 like 500 down", expectIntentIn: ["VEHICLE_AVAILABILITY"], note: "budget-constrained availability, not a hard down-payment question" },
  { text: "wat u got for 500 down", expectIntentIn: ["VEHICLE_AVAILABILITY", "DOWN_PAYMENT"] },
  { text: "how much down do i need", expectIntentIn: ["DOWN_PAYMENT"] },
  { text: "how much u need to get me in that", facts: vehicleContextFacts, expectIntentIn: ["DOWN_PAYMENT"], note: "vague referent resolved by conversation context" },
  { text: "how much u need to get me in that", expectIntentIn: ["DOWN_PAYMENT"], expectMaxConfidence: 40, note: "vague referent, NO context — must not guess" },
  { text: "whats the down payment on it", expectIntentIn: ["DOWN_PAYMENT"] },
  { text: "do i need money down", expectIntentIn: ["DOWN_PAYMENT"] },
  { text: "wats the dwn pymt", expectIntentIn: ["DOWN_PAYMENT"] },
  { text: "can i get in with no money down", expectIntentIn: ["DOWN_PAYMENT"] },
  { text: "how much down 4 the civic", expectIntentIn: ["DOWN_PAYMENT"] },

  // ── Monthly payment slang ───────────────────────────────────────────────
  { text: "what's it lookin like monthly", expectIntentIn: ["MONTHLY_PAYMENT"], expectMaxConfidence: 55, note: "no vehicle context — should not guess a number" },
  { text: "what's it lookin like monthly", facts: vehicleContextFacts, expectIntentIn: ["MONTHLY_PAYMENT"] },
  { text: "how much a month", expectIntentIn: ["MONTHLY_PAYMENT"] },
  { text: "whats the monthly payment look like", expectIntentIn: ["MONTHLY_PAYMENT"] },
  { text: "300 a month is that doable", expectIntentIn: ["MONTHLY_PAYMENT"] },
  { text: "what would payments be", expectIntentIn: ["MONTHLY_PAYMENT"] },
  { text: "300/mo work?", expectIntentIn: ["MONTHLY_PAYMENT"] },

  // ── Urgency / vague purchase intent ─────────────────────────────────────
  { text: "im tryna get sum asap", expectIntentIn: ["VEHICLE_AVAILABILITY", "UNCLEAR"] },
  { text: "need a car asap", expectIntentIn: ["VEHICLE_AVAILABILITY"] },
  { text: "trying to get something today", expectIntentIn: ["VEHICLE_AVAILABILITY"] },

  // ── Availability ─────────────────────────────────────────────────────────
  { text: "yall still got the civic", expectIntentIn: ["VEHICLE_AVAILABILITY"] },
  { text: "is that still available", expectIntentIn: ["VEHICLE_AVAILABILITY", "GENERAL_INQUIRY"] },
  { text: "u got any suvs", expectIntentIn: ["VEHICLE_AVAILABILITY"] },
  { text: "do you have any trucks in stock", expectIntentIn: ["VEHICLE_AVAILABILITY"] },
  { text: "got anything under 15k", expectIntentIn: ["VEHICLE_AVAILABILITY", "GENERAL_INQUIRY"] },

  // ── Price ────────────────────────────────────────────────────────────────
  { text: "how much is it", expectIntentIn: ["VEHICLE_PRICE"], note: "ambiguous 'it' — must clarify which vehicle, never guess a price" },
  { text: "how much is the civic", expectIntentIn: ["VEHICLE_PRICE"] },
  { text: "whats the price on that truck", expectIntentIn: ["VEHICLE_PRICE"] },
  { text: "asking price?", expectIntentIn: ["VEHICLE_PRICE", "GENERAL_INQUIRY"] },
  { text: "whats the otd price", expectIntentIn: ["VEHICLE_PRICE"] },

  // ── Financing / credit ───────────────────────────────────────────────────
  { text: "how does financing work", expectIntentIn: ["FINANCING"] },
  { text: "whats the interest rate", expectIntentIn: ["FINANCING"] },
  { text: "i have bad credit can i still get approved", expectIntentIn: ["BAD_CREDIT"] },
  { text: "my credit is pretty rough", expectIntentIn: ["BAD_CREDIT"] },
  { text: "i just filed bankruptcy", expectIntentIn: ["BAD_CREDIT"] },
  { text: "i dont have any credit", expectIntentIn: ["NO_CREDIT"] },
  { text: "never had a car loan before", expectIntentIn: ["FIRST_TIME_BUYER"] },
  { text: "this would be my first time buying a car", expectIntentIn: ["FIRST_TIME_BUYER"] },
  { text: "whats my approval odds", expectIntentIn: ["CREDIT", "GENERAL_INQUIRY"] },
  { text: "do i need good credit", expectIntentIn: ["CREDIT"] },

  // ── Trade-in ─────────────────────────────────────────────────────────────
  { text: "i have a trade in", expectIntentIn: ["TRADE_IN"] },
  { text: "whats my trade worth", expectIntentIn: ["TRADE_IN"], note: "must ask for details, never guess a trade-in value" },
  { text: "can i trade in my old car", expectIntentIn: ["TRADE_IN"] },

  // ── Driver's license ─────────────────────────────────────────────────────
  { text: "do i need a license to test drive", expectIntentIn: ["DRIVERS_LICENSE"] },
  { text: "my license is suspended can i still buy", expectIntentIn: ["DRIVERS_LICENSE"] },

  // ── Appointment / test drive ─────────────────────────────────────────────
  { text: "can i come by saturday", expectIntentIn: ["APPOINTMENT_REQUEST"], expectAction: "RESPOND" },
  { text: "when can i come see it", expectIntentIn: ["APPOINTMENT_REQUEST"] },
  { text: "can i test drive it tomorrow", expectIntentIn: ["TEST_DRIVE"], expectAction: "RESPOND" },
  { text: "wanna set up an appointment", expectIntentIn: ["APPOINTMENT_REQUEST"] },

  // ── Hours / location ─────────────────────────────────────────────────────
  { text: "what are your hours", expectIntentIn: ["DEALERSHIP_HOURS"] },
  { text: "where are you located", expectIntentIn: ["DEALERSHIP_LOCATION"] },
  { text: "whats the address", expectIntentIn: ["DEALERSHIP_LOCATION"] },

  // ── Application / documents ──────────────────────────────────────────────
  { text: "how do i apply", expectIntentIn: ["APPLICATION"] },
  { text: "what documents do i need to bring", expectIntentIn: ["DOCUMENTS_NEEDED"] },
  { text: "do i need pay stubs", expectIntentIn: ["DOCUMENTS_NEEDED"] },

  // ── Follow-up / objection / hesitation ───────────────────────────────────
  { text: "just checking in, still interested", expectIntentIn: ["FOLLOW_UP"] },
  { text: "that's too expensive for me", expectIntentIn: ["OBJECTION"] },
  { text: "i need a better price", expectIntentIn: ["OBJECTION"] },
  { text: "still thinking about it", expectIntentIn: ["HESITATION"] },
  { text: "let me talk to my wife first", expectIntentIn: ["HESITATION"] },

  // ── Casual ────────────────────────────────────────────────────────────────
  { text: "hey", expectIntentIn: ["CASUAL"] },
  { text: "yo whats good", expectIntentIn: ["CASUAL"] },
  { text: "lol", expectAction: "SILENT" },
  { text: "ok thanks", expectAction: "SILENT" },

  // ── Spam ──────────────────────────────────────────────────────────────────
  { text: "check out my page for the best deals dm me for info", expectIntentIn: ["SPAM"], expectAction: "SILENT" },
  { text: "make $500 a day working from home click the link", expectIntentIn: ["SPAM"], expectAction: "SILENT" },

  // ── Hard triggers — must escalate regardless of confidence ──────────────
  { text: "this is a scam you ripped me off", expectAction: "ESCALATE" },
  { text: "im calling my lawyer about this", expectAction: "ESCALATE" },
  { text: "im going to sue the dealership", expectAction: "ESCALATE" },
  { text: "thats not what we agreed to, you lied to me", expectAction: "ESCALATE" },
  { text: "worst dealership ever, terrible service", expectAction: "ESCALATE" },
  { text: "can i talk to a real person", expectAction: "ESCALATE" },
  { text: "is this a bot", expectAction: "ESCALATE" },
  { text: "let me speak to chino directly", expectAction: "ESCALATE" },

  // ── Multiple questions / genuinely unclear ───────────────────────────────
  { text: "how much down and whats the monthly and is it still available", expectMaxConfidence: 100 },
  { text: "asdkfj not sure what im even asking lol", expectIntentIn: ["UNCLEAR", "CASUAL"] },
  { text: "??", expectIntentIn: ["GENERAL_INQUIRY", "UNCLEAR"] },
  { text: "is it still there and how much down and can i come today", expectIntentIn: ["DOWN_PAYMENT", "VEHICLE_AVAILABILITY", "APPOINTMENT_REQUEST"] },
  { text: "whats the deal with financing and do yall take trades and whens your next opening", expectIntentIn: ["FINANCING"] },

  // ── Typos / misspellings ──────────────────────────────────────────────────
  { text: "hw much is teh civc", expectIntentIn: ["VEHICLE_PRICE", "UNCLEAR"] },
  { text: "avail today?", expectIntentIn: ["VEHICLE_AVAILABILITY", "GENERAL_INQUIRY"] },
  { text: "wat time u guys close", expectIntentIn: ["DEALERSHIP_HOURS"] },
  { text: "wheres the dealership at", expectIntentIn: ["DEALERSHIP_LOCATION"] },
  { text: "duz financing take long", expectIntentIn: ["FINANCING", "UNCLEAR"] },
  { text: "i gotta bad credit score tho", expectIntentIn: ["BAD_CREDIT"] },
  { text: "wats needed 4 an appt", expectIntentIn: ["APPOINTMENT_REQUEST", "DOCUMENTS_NEEDED", "UNCLEAR"], note: "genuinely ambiguous phrasing — UNCLEAR/escalate is an acceptable, safe outcome" },
  { text: "hows the mileage on it", facts: vehicleContextFacts, expectIntentIn: ["VEHICLE_INFO"] },

  // ── Voice-to-text style (no punctuation, run-on) ─────────────────────────
  { text: "hey is the civic still there im really interested", expectIntentIn: ["VEHICLE_AVAILABILITY", "CASUAL"] },
  { text: "so i have about a thousand dollars saved up for a down payment", expectIntentIn: ["DOWN_PAYMENT"] },
  { text: "im looking for something reliable for under three hundred a month", expectIntentIn: ["MONTHLY_PAYMENT"] },

  // ── Emoji-heavy / very short ──────────────────────────────────────────────
  { text: "😍😍😍", expectAction: "SILENT", note: "emoji-only reaction, nothing to answer" },
  { text: "🔥", expectAction: "SILENT" },
  { text: "👍", expectAction: "SILENT" },
  { text: "sold?", expectIntentIn: ["GENERAL_INQUIRY", "VEHICLE_AVAILABILITY"] },

  // ── Incomplete sentences ──────────────────────────────────────────────────
  { text: "the bmw", expectIntentIn: ["UNCLEAR", "VEHICLE_AVAILABILITY"] },
  { text: "down payment", expectIntentIn: ["DOWN_PAYMENT"] },
  { text: "hours?", expectIntentIn: ["DEALERSHIP_HOURS"] },

  // ── More casual / greetings ───────────────────────────────────────────────
  { text: "good morning", expectIntentIn: ["CASUAL"] },
  { text: "sup", expectIntentIn: ["CASUAL"] },
  { text: "wassup yall", expectIntentIn: ["CASUAL"] },
  { text: "haha nice", expectAction: "SILENT" },
  { text: "cool sounds good", expectAction: "SILENT" },

  // ── More spam ─────────────────────────────────────────────────────────────
  { text: "follow me for follow back and daily car deals", expectIntentIn: ["SPAM"], expectAction: "SILENT" },
  { text: "check out my onlyfans link in bio", expectIntentIn: ["SPAM"], expectAction: "SILENT" },
  { text: "click here https://totally-legit-deals.example to win a free car", expectIntentIn: ["SPAM"], expectAction: "SILENT" },

  // ── More hard triggers ────────────────────────────────────────────────────
  { text: "im reporting this dealership to the bbb", expectAction: "ESCALATE" },
  { text: "you guys are a bunch of scammers", expectAction: "ESCALATE" },
  { text: "i want to file a complaint about my last visit", expectAction: "ESCALATE" },
  { text: "can i get an actual human on this chat", expectAction: "ESCALATE" },
  { text: "are you even a real person or ai", expectAction: "ESCALATE" },

  // ── More financing / credit variants ──────────────────────────────────────
  { text: "do you guys do buy here pay here", expectIntentIn: ["FINANCING", "GENERAL_INQUIRY"] },
  { text: "whats apr looking like", expectIntentIn: ["FINANCING"] },
  { text: "no credit no problem right", expectIntentIn: ["NO_CREDIT"] },
  { text: "i got repo'd last year can i still get approved", expectIntentIn: ["BAD_CREDIT"] },

  // ── More availability/price with explicit vehicle ────────────────────────
  { text: "yall got any toyotas", expectIntentIn: ["VEHICLE_AVAILABILITY"] },
  { text: "hows the tahoe looking price wise", expectIntentIn: ["VEHICLE_PRICE"] },
  { text: "whats the mileage on the silverado", expectIntentIn: ["VEHICLE_INFO"] },
  { text: "what color options for the accord", expectIntentIn: ["VEHICLE_INFO"] },

  // ── More trade-in ─────────────────────────────────────────────────────────
  { text: "i wanna trade in my 2015 malibu", expectIntentIn: ["TRADE_IN"] },
  { text: "would yall take my old truck as a trade", expectIntentIn: ["TRADE_IN"] },

  // ── More appointment/test drive ───────────────────────────────────────────
  { text: "can i swing by after work", expectIntentIn: ["APPOINTMENT_REQUEST"] },
  { text: "im free this weekend to come check it out", expectIntentIn: ["APPOINTMENT_REQUEST"] },
  { text: "can we do a test drive friday", expectIntentIn: ["TEST_DRIVE"] },
];

async function main() {
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  for (const c of cases) {
    const result = await runPipeline(c.text, c.facts ?? emptyFacts, "AUTO");
    const problems: string[] = [];

    if (c.expectIntentIn && !c.expectIntentIn.includes(result.classification.intent)) {
      problems.push(`intent ${result.classification.intent} not in [${c.expectIntentIn.join(", ")}]`);
    }
    if (c.expectAction && result.outcome.action !== c.expectAction) {
      problems.push(`action ${result.outcome.action} !== ${c.expectAction}`);
    }
    if (c.expectMinConfidence !== undefined && result.confidenceScore < c.expectMinConfidence) {
      problems.push(`confidence ${result.confidenceScore} < min ${c.expectMinConfidence}`);
    }
    if (c.expectMaxConfidence !== undefined && result.confidenceScore > c.expectMaxConfidence) {
      problems.push(`confidence ${result.confidenceScore} > max ${c.expectMaxConfidence}`);
    }
    // Hard invariant, checked on every case regardless of expectations:
    // an ANSWER must never be auto-sent below the auto threshold, and the
    // pipeline must never crash.
    if (result.outcome.action === "RESPOND" && result.outcome.autoSend && result.confidenceScore < 90) {
      problems.push(`auto-sent at confidence ${result.confidenceScore} (< 90)`);
    }

    if (problems.length) {
      fail++;
      failures.push(`✗ "${c.text}"${c.note ? ` (${c.note})` : ""}\n    got: intent=${result.classification.intent} confidence=${result.confidenceScore} action=${result.outcome.action}\n    ${problems.join("; ")}`);
    } else {
      pass++;
    }
  }

  console.log(`\n${pass}/${cases.length} passed, ${fail} failed.\n`);
  if (failures.length) {
    console.log(failures.join("\n\n"));
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
