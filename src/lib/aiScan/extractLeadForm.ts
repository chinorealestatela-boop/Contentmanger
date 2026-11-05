// AI Lead Scanner — reads a photo of a physical dealership lead form and
// extracts it into the shape the CRM's own lead-intake fields already use
// (see src/lib/actions/leads.ts's intakeSchema), so the review screen can
// hand the result straight to createLead with no separate mapping step.
//
// There is deliberately no "simulated" fallback the way src/lib/sms/
// provider.ts has one for Twilio: simulating SMS just logs a message that
// never had real content to get wrong, but simulating OCR would mean
// inventing a customer's name, phone number, or payment amount, which is
// exactly what this feature must never do (see "never automatically
// invent missing information" in the feature spec). Without
// ANTHROPIC_API_KEY configured, every call fails closed with a clear
// "not configured" result instead.
//
// The field-mapping "template" isn't a rigid set of pixel coordinates —
// coordinates break the moment the photo is rotated, cropped differently,
// or lit differently, which the spec explicitly requires this feature to
// tolerate. Instead the template lives in this prompt: a precise
// description of the dealership's actual form layout (filled in once we
// have a reference photo of it — see the TODO below) that a vision model
// uses the same way a person would, which is robust to exactly the kind
// of variation (rotation, lighting, handwriting, camera/phone) a fixed
// coordinate grid is not.

import Anthropic from "@anthropic-ai/sdk";

export function isAiScanConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export type PickPaymentExtract = {
  amount: number | null;
  dueDate: string | null; // ISO yyyy-mm-dd
  kind: "DEPOSIT" | "REMAINING_DOWN_PAYMENT" | "OTHER" | null;
  description: string | null;
};

export type ExtractedLeadForm = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  preferredContactMethod: "PHONE" | "TEXT" | "EMAIL" | null;

  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleTrim: string | null;
  vehicleStockNumber: string | null;

  financeType: "CASH" | "FINANCE" | "LEASE" | null;
  desiredPayment: number | null;
  downPayment: number | null;

  hasTrade: boolean;
  tradeYear: number | null;
  tradeMake: string | null;
  tradeModel: string | null;

  initialPaymentToday: number | null;
  pickPayments: PickPaymentExtract[];

  salespersonName: string | null;
  appointmentDate: string | null; // ISO yyyy-mm-dd
  appointmentTime: string | null; // HH:mm, 24h

  salesNotes: string | null;
  otherCheckedOptions: string[]; // any checkbox/selection the model noticed that doesn't map to a field above, verbatim as printed on the form

  lowConfidenceFields: string[]; // keys from this same object the model wasn't confident about
  imageQuality: "ok" | "blurry" | "incomplete" | "unreadable";
  qualityNotes: string | null;
};

export type ExtractResult = { ok: true; data: ExtractedLeadForm } | { ok: false; error: string };

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_extracted_lead_form",
  description: "Record every field read off the dealership lead form photo, exactly as instructed.",
  input_schema: {
    type: "object",
    properties: {
      firstName: { type: ["string", "null"] },
      lastName: { type: ["string", "null"] },
      phone: { type: ["string", "null"], description: "Digits only or standard formatting, as written." },
      email: { type: ["string", "null"] },
      address: { type: ["string", "null"] },
      city: { type: ["string", "null"] },
      state: { type: ["string", "null"] },
      zip: { type: ["string", "null"] },
      preferredContactMethod: { type: ["string", "null"], enum: ["PHONE", "TEXT", "EMAIL", null] },

      vehicleYear: { type: ["integer", "null"] },
      vehicleMake: { type: ["string", "null"] },
      vehicleModel: { type: ["string", "null"] },
      vehicleTrim: { type: ["string", "null"] },
      vehicleStockNumber: { type: ["string", "null"] },

      financeType: { type: ["string", "null"], enum: ["CASH", "FINANCE", "LEASE", null] },
      desiredPayment: { type: ["number", "null"] },
      downPayment: { type: ["number", "null"] },

      hasTrade: { type: "boolean" },
      tradeYear: { type: ["integer", "null"] },
      tradeMake: { type: ["string", "null"] },
      tradeModel: { type: ["string", "null"] },

      initialPaymentToday: { type: ["number", "null"], description: "Amount collected today/upfront, if the form distinguishes it from a future payment." },
      pickPayments: {
        type: "array",
        description: "One entry per distinct future payment amount + due date written on the form. Empty array if none.",
        items: {
          type: "object",
          properties: {
            amount: { type: ["number", "null"] },
            dueDate: { type: ["string", "null"], description: "ISO yyyy-mm-dd. Null if a date is written but you cannot confidently resolve it." },
            kind: { type: ["string", "null"], enum: ["DEPOSIT", "REMAINING_DOWN_PAYMENT", "OTHER", null] },
            description: { type: ["string", "null"], description: "Any handwritten note tied to this specific payment." },
          },
          required: ["amount", "dueDate", "kind", "description"],
        },
      },

      salespersonName: { type: ["string", "null"] },
      appointmentDate: { type: ["string", "null"], description: "ISO yyyy-mm-dd" },
      appointmentTime: { type: ["string", "null"], description: "24h HH:mm" },

      salesNotes: { type: ["string", "null"], description: "Any handwritten comments/notes on the form not already captured in a specific field above." },
      otherCheckedOptions: { type: "array", items: { type: "string" }, description: "Any checkbox or multiple-choice option on the form that is marked/selected and doesn't correspond to a field above, written verbatim." },

      lowConfidenceFields: { type: "array", items: { type: "string" }, description: "Property names from this same object where the handwriting was ambiguous or you are not confident in the value you gave. Do not include a field here if you left it null — null already means 'not found'." },
      imageQuality: { type: "string", enum: ["ok", "blurry", "incomplete", "unreadable"] },
      qualityNotes: { type: ["string", "null"], description: "If imageQuality isn't 'ok', briefly say why (e.g. 'bottom third of the form is cut off', 'flash glare over the payment section')." },
    },
    required: [
      "firstName", "lastName", "phone", "email", "address", "city", "state", "zip", "preferredContactMethod",
      "vehicleYear", "vehicleMake", "vehicleModel", "vehicleTrim", "vehicleStockNumber",
      "financeType", "desiredPayment", "downPayment",
      "hasTrade", "tradeYear", "tradeMake", "tradeModel",
      "initialPaymentToday", "pickPayments",
      "salespersonName", "appointmentDate", "appointmentTime",
      "salesNotes", "otherCheckedOptions",
      "lowConfidenceFields", "imageQuality", "qualityNotes",
    ],
  },
};

// TODO once the dealership's actual lead-form photo is provided: replace
// this generic description with a precise walkthrough of that exact
// form's sections/labels (e.g. "the top-right box labeled 'Down Today $'
// is the initial payment; the line below labeled 'Balance Due by' followed
// by a blank and a date is the one future Pick Payment this form
// supports"). A specific, correct description of the real layout will beat
// this generic one on accuracy every time — this is the "permanent
// field-mapping configuration" the feature spec asks for, expressed as
// prompt instructions a vision model can apply despite rotation/lighting/
// handwriting variation, rather than as pixel coordinates that break under
// exactly that variation.
const SYSTEM_PROMPT = `You read photos of handwritten/printed dealership car-lead intake forms and extract their fields into structured data for a CRM.

Rules, in order of importance:
1. Never invent or guess a value. If a field is blank, illegible, or not present on the form, its value is null (or false for hasTrade, or [] for the array fields) — not a plausible-sounding guess.
2. If you can read a field but aren't confident you read it correctly (ambiguous handwriting, a smudged digit, a date that could be two different months), still report your best reading as the value, but add that field's name to lowConfidenceFields so a human can double-check it. Do not leave it null just because you're unsure — null specifically means "nothing is there."
3. Dollar amounts: strip "$" and commas, return a plain number.
4. Dates: resolve to ISO yyyy-mm-dd. If the form only gives a day/month without a year, assume the nearest future occurrence of that date relative to today. If you truly cannot resolve a date (e.g. only "next month" is written with no specific day), leave dueDate/appointmentDate null and explain in qualityNotes or the payment's description instead of guessing a date.
5. Future payments ("Pick Payments"): a form may describe one or several separate future amounts, each with its own due date — e.g. "$500 today, $1,500 due 12/5" is ONE pick payment ($1,500 due 12/5; the $500 goes in initialPaymentToday, not in pickPayments since it's collected today, not a future obligation). "$750 due 11/20 and $750 due 12/20" is TWO pick payments. Only include an entry in pickPayments for an amount that is genuinely still owed in the future — never duplicate the initial/upfront amount into this array.
6. Phone numbers: report digits as written; don't reformat beyond removing obvious handwriting artifacts.
7. imageQuality: "ok" unless something about the photo itself (not the form's content) is the problem — out of focus, part of the form cut off from frame, or glare/shadow making a section genuinely unreadable. A form that's simply mostly blank (customer didn't fill in every field) is still "ok" — that's a form-content fact, not an image-quality problem.

The dealership's lead form is a single page with printed field labels and handwritten customer/deal information filled in next to or below each label (checkboxes for some multiple-choice fields). Read it the way a person would: find each printed label, then read whatever is written in its associated blank, regardless of the photo's rotation, lighting, or the handwriting style.`;

export async function extractLeadFormFromImage(params: { base64: string; mediaType: string }): Promise<ExtractResult> {
  if (!isAiScanConfigured()) {
    return { ok: false, error: "AI Lead Scanner isn't configured yet — an admin needs to set ANTHROPIC_API_KEY for this dealership's CRM." };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: params.mediaType as "image/jpeg" | "image/png" | "image/webp", data: params.base64 } },
            { type: "text", text: "Extract every field from this dealership lead form photo per your instructions." },
          ],
        },
      ],
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `AI scan failed: ${err.message}` : "AI scan failed — please try again." };
  }

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === EXTRACTION_TOOL.name);
  if (!toolUse) {
    return { ok: false, error: "AI scan didn't return readable results — please try again." };
  }

  return { ok: true, data: toolUse.input as ExtractedLeadForm };
}
