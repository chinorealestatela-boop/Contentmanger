// Canonical value lists for every "fixed choice" field in the CRM.
// SQLite has no native enum support, so these are validated/typed here at
// the application layer instead of in the database schema.

export type Option<T extends string = string> = {
  value: T;
  label: string;
  color?: string; // tailwind-ish hex used for badges/pills
};

// ── Roles ──────────────────────────────────────────────────────────────
export const ROLES = ["SALESPERSON", "MANAGER", "ADMIN"] as const;
export type RoleName = (typeof ROLES)[number];

// ── Lead temperature ──────────────────────────────────────────────────
export const TEMPERATURES: Option[] = [
  { value: "HOT", label: "Hot", color: "#dc2626" },
  { value: "WARM", label: "Warm", color: "#ea580c" },
  { value: "COLD", label: "Cold", color: "#2563eb" },
];
export type Temperature = "HOT" | "WARM" | "COLD";

// ── Lead status ────────────────────────────────────────────────────────
export const LEAD_STATUSES: Option[] = [
  { value: "ACTIVE", label: "Active", color: "#16a34a" },
  { value: "ON_HOLD", label: "On Hold", color: "#a16207" },
  { value: "SOLD", label: "Sold", color: "#7c3aed" },
  { value: "LOST", label: "Lost", color: "#64748b" },
];

// ── Purchase timeframe ────────────────────────────────────────────────
export const PURCHASE_TIMEFRAMES: Option[] = [
  { value: "IMMEDIATE", label: "Immediate (0-3 days)" },
  { value: "THIS_WEEK", label: "This Week" },
  { value: "THIS_MONTH", label: "This Month" },
  { value: "THIS_QUARTER", label: "This Quarter" },
  { value: "RESEARCHING", label: "Just Researching" },
];

// ── Contact method ────────────────────────────────────────────────────
export const CONTACT_METHODS: Option[] = [
  { value: "PHONE", label: "Phone Call" },
  { value: "TEXT", label: "Text" },
  { value: "EMAIL", label: "Email" },
];

export const CONTACT_TIMES: Option[] = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "EVENING", label: "Evening" },
  { value: "ANYTIME", label: "Anytime" },
];

// ── Financing ──────────────────────────────────────────────────────────
export const FINANCE_TYPES: Option[] = [
  { value: "CASH", label: "Cash" },
  { value: "FINANCE", label: "Finance" },
  { value: "LEASE", label: "Lease" },
];

export const CREDIT_APP_STATUSES: Option[] = [
  { value: "NOT_STARTED", label: "Not Started", color: "#64748b" },
  { value: "PENDING", label: "Pending", color: "#a16207" },
  { value: "SUBMITTED", label: "Submitted", color: "#2563eb" },
  { value: "APPROVED", label: "Approved", color: "#16a34a" },
  { value: "DECLINED", label: "Declined", color: "#dc2626" },
];

// ── Vehicles ───────────────────────────────────────────────────────────
export const VEHICLE_CONDITIONS: Option[] = [
  { value: "NEW", label: "New" },
  { value: "USED", label: "Used" },
  { value: "CERTIFIED", label: "Certified Pre-Owned" },
];

export const VEHICLE_STATUSES: Option[] = [
  { value: "AVAILABLE", label: "Available", color: "#16a34a" },
  { value: "HOLD", label: "On Hold", color: "#a16207" },
  { value: "SOLD", label: "Sold", color: "#7c3aed" },
  { value: "IN_TRANSIT", label: "In Transit", color: "#2563eb" },
  { value: "UNAVAILABLE", label: "Unavailable", color: "#64748b" },
];

export const BODY_STYLES: Option[] = [
  { value: "SEDAN", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "TRUCK", label: "Truck" },
  { value: "COUPE", label: "Coupe" },
  { value: "VAN", label: "Minivan" },
  { value: "CONVERTIBLE", label: "Convertible" },
  { value: "HATCHBACK", label: "Hatchback" },
  { value: "WAGON", label: "Wagon" },
];

export const DRIVETRAINS: Option[] = [
  { value: "FWD", label: "FWD" },
  { value: "RWD", label: "RWD" },
  { value: "AWD", label: "AWD" },
  { value: "4WD", label: "4WD" },
];

export const INTEREST_LEVELS: Option[] = [
  { value: "INTERESTED", label: "Interested" },
  { value: "STRONG", label: "Strong Interest" },
  { value: "PURCHASED", label: "Purchased" },
  { value: "PASSED", label: "Passed" },
];

// ── Trade-ins ──────────────────────────────────────────────────────────
export const APPRAISAL_STATUSES: Option[] = [
  { value: "PENDING", label: "Pending", color: "#a16207" },
  { value: "APPRAISED", label: "Appraised", color: "#2563eb" },
  { value: "ACCEPTED", label: "Accepted", color: "#16a34a" },
  { value: "DECLINED", label: "Declined", color: "#dc2626" },
];

// ── Appointments / Calendar events ────────────────────────────────────
// This list also drives the Calendar tab's event-type badges/icons (see
// src/components/calendar/eventMeta.ts for the icon+color mapping).
export const APPOINTMENT_TYPES: Option[] = [
  { value: "CUSTOMER_CALL", label: "Customer Call", color: "#2563eb" },
  { value: "FOLLOW_UP_CALL", label: "Follow-Up Call", color: "#0891b2" },
  { value: "TEST_DRIVE", label: "Test Drive", color: "#ea580c" },
  { value: "DEALERSHIP_APPOINTMENT", label: "Dealership Appointment", color: "#7c3aed" },
  { value: "VEHICLE_WALKAROUND", label: "Vehicle Walkaround", color: "#0d9488" },
  { value: "FINANCING_DISCUSSION", label: "Financing Discussion", color: "#a16207" },
  { value: "TRADE_IN_EVALUATION", label: "Trade-In Evaluation", color: "#16a34a" },
  { value: "SALES_APPOINTMENT", label: "Sales Appointment", color: "#db2777" },
  { value: "DELIVERY", label: "Delivery", color: "#4f46e5" },
  { value: "OTHER", label: "Other", color: "#64748b" },
];

export const APPOINTMENT_STATUSES: Option[] = [
  { value: "SCHEDULED", label: "Scheduled", color: "#2563eb" },
  { value: "CONFIRMED", label: "Confirmed", color: "#0d9488" },
  { value: "SHOWED", label: "Showed", color: "#16a34a" },
  { value: "NO_SHOW", label: "No-Show", color: "#dc2626" },
  { value: "CANCELLED", label: "Cancelled", color: "#64748b" },
  { value: "COMPLETED", label: "Completed", color: "#7c3aed" },
];

// ── Follow-ups ─────────────────────────────────────────────────────────
export const FOLLOWUP_STATUSES: Option[] = [
  { value: "SCHEDULED", label: "Scheduled", color: "#2563eb" },
  { value: "COMPLETED", label: "Completed", color: "#16a34a" },
  { value: "RESCHEDULED", label: "Rescheduled", color: "#a16207" },
  { value: "CANCELLED", label: "Cancelled", color: "#64748b" },
  { value: "MISSED", label: "Missed", color: "#dc2626" },
];

// Not a stored status — SCHEDULED + followUpDate == today. Included here
// only so status filter dropdowns can offer it as a value.
export const FOLLOWUP_STATUS_FILTERS: Option[] = [
  { value: "ALL", label: "All" },
  ...FOLLOWUP_STATUSES,
  { value: "DUE_TODAY", label: "Due Today", color: "#ea580c" },
];

// Stored as reminderOffsetMinutes (minutes before the follow-up time).
// "CUSTOM" isn't a stored value — the UI swaps in a number input when
// selected and stores whatever minute count the user enters.
export const FOLLOWUP_REMINDER_OPTIONS: Option[] = [
  { value: "NONE", label: "No reminder" },
  { value: "0", label: "At the scheduled time" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
  { value: "CUSTOM", label: "Custom…" },
];

// ── Tasks ──────────────────────────────────────────────────────────────
export const TASK_TYPES: Option[] = [
  { value: "CALL", label: "Call" },
  { value: "TEXT", label: "Text" },
  { value: "EMAIL", label: "Email" },
  { value: "FOLLOW_UP", label: "Follow-Up" },
  { value: "APPOINTMENT", label: "Appointment" },
  { value: "TRADE", label: "Trade" },
  { value: "CREDIT", label: "Credit" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "OTHER", label: "Other" },
];

export const TASK_PRIORITIES: Option[] = [
  { value: "LOW", label: "Low", color: "#64748b" },
  { value: "NORMAL", label: "Normal", color: "#2563eb" },
  { value: "HIGH", label: "High", color: "#ea580c" },
  { value: "URGENT", label: "Urgent", color: "#dc2626" },
];

export const TASK_STATUSES: Option[] = [
  { value: "PENDING", label: "Pending", color: "#a16207" },
  { value: "COMPLETED", label: "Completed", color: "#16a34a" },
  { value: "SNOOZED", label: "Snoozed", color: "#64748b" },
  { value: "CANCELLED", label: "Cancelled", color: "#94a3b8" },
];

// ── Communications ────────────────────────────────────────────────────
export const COMMUNICATION_TYPES: Option[] = [
  { value: "CALL", label: "Call" },
  { value: "TEXT", label: "Text" },
  { value: "EMAIL", label: "Email" },
  { value: "VOICEMAIL", label: "Voicemail" },
  { value: "IN_PERSON", label: "In-Person" },
  { value: "OTHER", label: "Other" },
];

// ── Offers ─────────────────────────────────────────────────────────────
export const OFFER_STATUSES: Option[] = [
  { value: "PENDING", label: "Pending", color: "#a16207" },
  { value: "COUNTERED", label: "Countered", color: "#2563eb" },
  { value: "ACCEPTED", label: "Accepted", color: "#16a34a" },
  { value: "REJECTED", label: "Rejected", color: "#dc2626" },
];

// ── Test Drives ────────────────────────────────────────────────────────
export const CUSTOMER_REACTIONS: Option[] = [
  { value: "POSITIVE", label: "Positive", color: "#16a34a" },
  { value: "NEUTRAL", label: "Neutral", color: "#a16207" },
  { value: "NEGATIVE", label: "Negative", color: "#dc2626" },
];

// ── Default pipeline stages (seeded, editable in Settings) ─────────────
export const DEFAULT_PIPELINE_STAGES: { name: string; order: number; color: string; isClosedWon?: boolean; isClosedLost?: boolean }[] = [
  { name: "New Lead", order: 0, color: "#2563eb" },
  { name: "Contacted", order: 1, color: "#0891b2" },
  { name: "Engaged", order: 2, color: "#0d9488" },
  { name: "Appointment Set", order: 3, color: "#7c3aed" },
  { name: "Appointment Confirmed", order: 4, color: "#8b5cf6" },
  { name: "Showed", order: 5, color: "#d946ef" },
  { name: "Test Drive", order: 6, color: "#ea580c" },
  { name: "Negotiating", order: 7, color: "#f59e0b" },
  { name: "Credit Application", order: 8, color: "#eab308" },
  { name: "Pending Delivery", order: 9, color: "#84cc16" },
  { name: "Sold", order: 10, color: "#16a34a", isClosedWon: true },
  { name: "Lost", order: 11, color: "#64748b", isClosedLost: true },
];

// ── Default lead sources ────────────────────────────────────────────────
export const DEFAULT_LEAD_SOURCES = [
  "Walk-In",
  "Phone Up",
  "Website",
  "Autotrader",
  "Cars.com",
  "CarGurus",
  "Facebook Marketplace",
  "Google Ads",
  "Referral",
  "Repeat Customer",
  "Third-Party Lead Provider",
  "Trade Show / Event",
];

// ── Default lost reasons ────────────────────────────────────────────────
export const DEFAULT_LOST_REASONS = [
  "Bought Elsewhere",
  "Price",
  "Payment",
  "Credit",
  "No Response",
  "Vehicle Unavailable",
  "Trade",
  "Waiting",
  "Changed Mind",
  "Other",
];

// ── Notification types ──────────────────────────────────────────────────
export const NOTIFICATION_TYPES: Option[] = [
  { value: "NEW_LEAD", label: "New Lead" },
  { value: "HOT_LEAD", label: "Hot Lead" },
  { value: "OVERDUE_FOLLOW_UP", label: "Overdue Follow-Up" },
  { value: "FOLLOW_UP_REMINDER", label: "Follow-Up Reminder" },
  { value: "APPOINTMENT", label: "Appointment" },
  { value: "APPOINTMENT_TOMORROW", label: "Appointment Tomorrow" },
  { value: "NO_SHOW", label: "No-Show" },
  { value: "CUSTOMER_ACTIVITY", label: "Customer Activity" },
  { value: "VEHICLE_SOLD", label: "Vehicle Sold" },
  { value: "IMPORTANT_TASK", label: "Important Task" },
  { value: "AUTOMATION", label: "Automation" },
];

// ── Helpers ───────────────────────────────────────────────────────────
export function optionLabel(options: Option[], value: string | null | undefined): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

export function optionColor(options: Option[], value: string | null | undefined): string {
  if (!value) return "#64748b";
  return options.find((o) => o.value === value)?.color ?? "#64748b";
}

export const TRIGGER_EVENTS: Option[] = [
  { value: "NEW_LEAD", label: "New lead is created" },
  { value: "STAGE_CHANGE", label: "Lead changes pipeline stage" },
  { value: "HOT_LEAD", label: "Lead becomes HOT" },
  { value: "APPOINTMENT_CREATED", label: "Appointment is created" },
  { value: "APPOINTMENT_TOMORROW", label: "Appointment is tomorrow" },
  { value: "APPOINTMENT_NO_SHOW", label: "Appointment is a no-show" },
  { value: "APPOINTMENT_COMPLETED", label: "Appointment is completed" },
  { value: "NO_CONTACT_X_DAYS", label: "No contact for X days" },
  { value: "TEST_DRIVE_COMPLETED", label: "Test drive is completed" },
  { value: "VEHICLE_SOLD", label: "Customer's vehicle of interest is sold" },
  { value: "LEAD_LOST", label: "Lead becomes LOST" },
  { value: "FOLLOW_UP_COMPLETED", label: "Follow-up task is completed" },
];

export const REACTIVATION_WINDOWS: Option[] = [
  { value: "30", label: "30 Days" },
  { value: "60", label: "60 Days" },
  { value: "90", label: "90 Days" },
  { value: "180", label: "6 Months" },
  { value: "365", label: "12 Months" },
];
