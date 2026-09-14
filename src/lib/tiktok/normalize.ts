// Slang / abbreviation / texting-shorthand normalizer. This is the first
// stage of the Understanding Engine (spec section 1): expand common
// shorthand so the intent patterns in intent-engine.ts match reliably,
// without needing an LLM call for every message.
//
// Deliberately conservative — every entry here is unambiguous in a
// car-sales DM context. Numeric extraction (dollar amounts) happens on the
// *raw* text in entities.ts, before this runs, so replacing "4"→"for" and
// "2"→"to" here never affects amount parsing.

const SLANG_MAP: Record<string, string> = {
  u: "you",
  ur: "your",
  urs: "yours",
  r: "are",
  y: "why",
  yall: "you all",
  "y'all": "you all",
  cuz: "because",
  cus: "because",
  bc: "because",
  bcuz: "because",
  b4: "before",
  gonna: "going to",
  wanna: "want to",
  gotta: "got to",
  tryna: "trying to",
  finna: "about to",
  gimme: "give me",
  lemme: "let me",
  rn: "right now",
  asap: "as soon as possible",
  thx: "thanks",
  ty: "thanks",
  pls: "please",
  plz: "please",
  msg: "message",
  avail: "available",
  appt: "appointment",
  apt: "appointment",
  hrs: "hours",
  mo: "month",
  "mo.": "month",
  dwn: "down",
  pymt: "payment",
  pymnt: "payment",
  wat: "what",
  wut: "what",
  wats: "what's",
  sumthin: "something",
  sum: "some",
  sup: "what's up",
  wassup: "what's up",
  prolly: "probably",
  lil: "little",
  def: "definitely",
  abt: "about",
  "w/": "with",
  "w/o": "without",
  "4": "for",
  "2": "to",
};

export function normalizeText(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const tokens = lower.split(/(\s+)/);
  const expanded = tokens.map((tok) => {
    const stripped = tok.replace(/^[^\w'/]+|[^\w'/]+$/g, "");
    if (!stripped) return tok;
    const replacement = SLANG_MAP[stripped];
    if (!replacement) return tok;
    return tok.replace(stripped, replacement);
  });
  return expanded.join("").replace(/\s+/g, " ").trim();
}
