// Canonical value lists for every "fixed choice" field in the CRM.
// SQLite has no native enum support, so these are validated/typed here at
// the application layer instead of in the database schema.

export type Option<T extends string = string> = {
  value: T;
  label: string;
  color?: string; // hex used for badges/pills/status dots
};

// ── Roles ──────────────────────────────────────────────────────────────
export const ROLES = ["OWNER", "ADMIN", "MANAGER", "DISPATCHER", "SALES", "DRIVER"] as const;
export type RoleName = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleName, string> = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  MANAGER: "Manager",
  DISPATCHER: "Dispatcher",
  SALES: "Concierge / Sales",
  DRIVER: "Chauffeur",
};

// ── Customer tiers ────────────────────────────────────────────────────
export const CUSTOMER_TIERS: Option[] = [
  { value: "STANDARD", label: "Standard", color: "#8a8a8a" },
  { value: "VIP", label: "VIP", color: "#c9a24b" },
  { value: "VVIP", label: "VVIP", color: "#e8c874" },
  { value: "CORPORATE", label: "Corporate", color: "#7fa8c9" },
];

// ── Contact method ────────────────────────────────────────────────────
export const CONTACT_METHODS: Option[] = [
  { value: "PHONE", label: "Phone Call" },
  { value: "TEXT", label: "Text Message" },
  { value: "EMAIL", label: "Email" },
];

// ── Lead sources ──────────────────────────────────────────────────────
export const DEFAULT_LEAD_SOURCES = [
  "Website",
  "Instagram",
  "TikTok",
  "Facebook",
  "Google",
  "Referral",
  "Phone Call",
  "Text Message",
  "Repeat Client",
  "Corporate Client",
  "Other",
];

// ── Lead status ────────────────────────────────────────────────────────
export const LEAD_STATUSES: Option[] = [
  { value: "ACTIVE", label: "Active", color: "#3fae6a" },
  { value: "ON_HOLD", label: "On Hold", color: "#c9a24b" },
  { value: "BOOKED", label: "Booked", color: "#7fa8c9" },
  { value: "LOST", label: "Lost", color: "#8a8a8a" },
];

// ── Pipeline (seeded, editable in Settings) ─────────────────────────────
export const DEFAULT_PIPELINE_STAGES: { name: string; order: number; color: string; isClosedWon?: boolean; isClosedLost?: boolean }[] = [
  { name: "New Lead", order: 0, color: "#7fa8c9" },
  { name: "Contacted", order: 1, color: "#6fb0c9" },
  { name: "Qualified", order: 2, color: "#5fbfa8" },
  { name: "Quote Sent", order: 3, color: "#c9a24b" },
  { name: "Follow-Up", order: 4, color: "#d4b05e" },
  { name: "Deposit Requested", order: 5, color: "#e0955a" },
  { name: "Booked", order: 6, color: "#3fae6a", isClosedWon: true },
  { name: "Completed", order: 7, color: "#3f8f5a", isClosedWon: true },
  { name: "Lost", order: 8, color: "#8a8a8a", isClosedLost: true },
];

export const DEFAULT_LOST_REASONS = [
  "Booked With Competitor",
  "Price / Budget",
  "Vehicle Unavailable",
  "Date/Time Unavailable",
  "No Response",
  "Changed Plans",
  "Duplicate Inquiry",
  "Other",
];

// ── Service types ─────────────────────────────────────────────────────
export const SERVICE_TYPES: Option[] = [
  { value: "AIRPORT_TRANSFER", label: "Airport Transfer" },
  { value: "CHAUFFEURED_TRANSPORTATION", label: "Chauffeured Transportation" },
  { value: "SELF_DRIVE_RENTAL", label: "Self-Drive Rental" },
  { value: "POINT_TO_POINT", label: "Point-to-Point Transportation" },
  { value: "HOURLY_SERVICE", label: "Hourly Service" },
  { value: "CORPORATE_TRANSPORTATION", label: "Corporate Transportation" },
  { value: "WEDDINGS", label: "Weddings" },
  { value: "VIP_NIGHT_OUT", label: "VIP Night Out" },
  { value: "EVENTS", label: "Events" },
  { value: "CALIFORNIA_TRANSPORTATION", label: "California Transportation" },
  { value: "LONG_DISTANCE", label: "Long-Distance Transportation" },
  { value: "LIFESTYLE_CONCIERGE", label: "Lifestyle / Concierge Services" },
];

// ── Vehicles / Fleet ──────────────────────────────────────────────────
export const VEHICLE_TYPES: Option[] = [
  { value: "ROLLS_ROYCE", label: "Rolls-Royce" },
  { value: "BENTLEY", label: "Bentley" },
  { value: "MAYBACH", label: "Maybach" },
  { value: "MERCEDES_SPRINTER", label: "Mercedes Sprinter" },
  { value: "CADILLAC_ESCALADE", label: "Cadillac Escalade" },
  { value: "LAMBORGHINI", label: "Lamborghini" },
  { value: "EXOTIC", label: "Exotic / Supercar" },
  { value: "SEDAN", label: "Luxury Sedan" },
  { value: "SUV", label: "Luxury SUV" },
  { value: "OTHER", label: "Other" },
];

export const VEHICLE_AVAILABILITY: Option[] = [
  { value: "AVAILABLE", label: "Available", color: "#3fae6a" },
  { value: "RESERVED", label: "Reserved", color: "#c9a24b" },
  { value: "ON_TRIP", label: "On Trip", color: "#e0955a" },
  { value: "MAINTENANCE", label: "Maintenance", color: "#c9605c" },
  { value: "OFFLINE", label: "Offline", color: "#6a6a6a" },
];

export const MAINTENANCE_TYPES: Option[] = [
  { value: "SERVICE", label: "Scheduled Service" },
  { value: "REPAIR", label: "Repair" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "DETAIL", label: "Detail" },
  { value: "TIRE", label: "Tires" },
  { value: "OIL_CHANGE", label: "Oil Change" },
  { value: "OTHER", label: "Other" },
];

export const MAINTENANCE_STATUSES: Option[] = [
  { value: "SCHEDULED", label: "Scheduled", color: "#c9a24b" },
  { value: "IN_PROGRESS", label: "In Progress", color: "#7fa8c9" },
  { value: "COMPLETED", label: "Completed", color: "#3fae6a" },
  { value: "CANCELLED", label: "Cancelled", color: "#6a6a6a" },
];

// ── Drivers / Chauffeurs ─────────────────────────────────────────────
export const DRIVER_STATUSES: Option[] = [
  { value: "AVAILABLE", label: "Available", color: "#3fae6a" },
  { value: "ASSIGNED", label: "Assigned", color: "#7fa8c9" },
  { value: "EN_ROUTE", label: "En Route", color: "#c9a24b" },
  { value: "WITH_CLIENT", label: "With Client", color: "#d4855e" },
  { value: "COMPLETED", label: "Completed", color: "#8a8a8a" },
  { value: "OFF_DUTY", label: "Off Duty", color: "#5a5a5a" },
];

// ── Bookings ───────────────────────────────────────────────────────────
export const BOOKING_STATUSES: Option[] = [
  { value: "RESERVED", label: "Reserved", color: "#8a8a8a" },
  { value: "CONFIRMED", label: "Confirmed", color: "#7fa8c9" },
  { value: "DRIVER_ASSIGNED", label: "Driver Assigned", color: "#6fb0c9" },
  { value: "EN_ROUTE", label: "En Route", color: "#c9a24b" },
  { value: "PASSENGER_PICKED_UP", label: "Passenger Picked Up", color: "#d4855e" },
  { value: "COMPLETED", label: "Completed", color: "#3fae6a" },
  { value: "CANCELLED", label: "Cancelled", color: "#8a4a4a" },
];

export const PAYMENT_STATUSES: Option[] = [
  { value: "PAYMENT_PENDING", label: "Payment Pending", color: "#c9605c" },
  { value: "DEPOSIT_PAID", label: "Deposit Paid", color: "#c9a24b" },
  { value: "PAID_IN_FULL", label: "Paid in Full", color: "#3fae6a" },
  { value: "REFUNDED", label: "Refunded", color: "#7fa8c9" },
  { value: "FAILED", label: "Failed", color: "#8a4a4a" },
];

// Operations Board columns (trip execution lifecycle)
export const OPS_STAGES: Option[] = [
  { value: "UPCOMING", label: "Upcoming", color: "#8a8a8a" },
  { value: "DRIVER_ASSIGNED", label: "Driver Assigned", color: "#7fa8c9" },
  { value: "DRIVER_EN_ROUTE", label: "Driver En Route", color: "#6fb0c9" },
  { value: "ARRIVED", label: "Arrived", color: "#c9a24b" },
  { value: "PASSENGER_ONBOARD", label: "Passenger Onboard", color: "#d4855e" },
  { value: "IN_TRANSIT", label: "In Transit", color: "#c98a5e" },
  { value: "COMPLETED", label: "Completed", color: "#3fae6a" },
];

export const FLIGHT_STATUSES: Option[] = [
  { value: "ON_TIME", label: "On Time", color: "#3fae6a" },
  { value: "DELAYED", label: "Delayed", color: "#c9a24b" },
  { value: "LANDED", label: "Landed", color: "#7fa8c9" },
  { value: "CANCELLED", label: "Cancelled", color: "#8a4a4a" },
];

// ── Quotes ─────────────────────────────────────────────────────────────
export const QUOTE_STATUSES: Option[] = [
  { value: "DRAFT", label: "Draft", color: "#8a8a8a" },
  { value: "SENT", label: "Sent", color: "#7fa8c9" },
  { value: "VIEWED", label: "Viewed", color: "#6fb0c9" },
  { value: "ACCEPTED", label: "Accepted", color: "#3fae6a" },
  { value: "DECLINED", label: "Declined", color: "#8a4a4a" },
  { value: "EXPIRED", label: "Expired", color: "#5a5a5a" },
  { value: "CONVERTED", label: "Converted to Booking", color: "#c9a24b" },
];

// ── Payments (ledger) ────────────────────────────────────────────────
export const PAYMENT_TYPES: Option[] = [
  { value: "DEPOSIT", label: "Deposit" },
  { value: "BALANCE", label: "Balance" },
  { value: "FULL", label: "Paid in Full" },
  { value: "REFUND", label: "Refund" },
];

export const PAYMENT_METHODS: Option[] = [
  { value: "CARD", label: "Card" },
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check" },
  { value: "WIRE", label: "Wire Transfer" },
  { value: "OTHER", label: "Other" },
];

export const PAYMENT_RECORD_STATUSES: Option[] = [
  { value: "PENDING", label: "Pending", color: "#c9a24b" },
  { value: "SUCCEEDED", label: "Succeeded", color: "#3fae6a" },
  { value: "FAILED", label: "Failed", color: "#8a4a4a" },
  { value: "REFUNDED", label: "Refunded", color: "#7fa8c9" },
];

// ── Tasks ──────────────────────────────────────────────────────────────
export const TASK_TYPES: Option[] = [
  { value: "CALL", label: "Call Lead" },
  { value: "FOLLOW_UP", label: "Follow Up" },
  { value: "SEND_QUOTE", label: "Send Quote" },
  { value: "COLLECT_DEPOSIT", label: "Collect Deposit" },
  { value: "ASSIGN_DRIVER", label: "Assign Driver" },
  { value: "CONFIRM_FLIGHT", label: "Confirm Flight" },
  { value: "PREPARE_VEHICLE", label: "Prepare Vehicle" },
  { value: "SEND_REMINDER", label: "Send Customer Reminder" },
  { value: "COLLECT_BALANCE", label: "Collect Remaining Balance" },
  { value: "REQUEST_REVIEW", label: "Request Review" },
  { value: "OTHER", label: "Other" },
];

export const TASK_PRIORITIES: Option[] = [
  { value: "LOW", label: "Low", color: "#8a8a8a" },
  { value: "NORMAL", label: "Normal", color: "#7fa8c9" },
  { value: "HIGH", label: "High", color: "#c9a24b" },
  { value: "URGENT", label: "Urgent", color: "#c9605c" },
];

export const TASK_STATUSES: Option[] = [
  { value: "PENDING", label: "Pending", color: "#c9a24b" },
  { value: "COMPLETED", label: "Completed", color: "#3fae6a" },
  { value: "SNOOZED", label: "Snoozed", color: "#8a8a8a" },
  { value: "CANCELLED", label: "Cancelled", color: "#5a5a5a" },
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

// ── Follow-ups ─────────────────────────────────────────────────────────
export const FOLLOWUP_STATUSES: Option[] = [
  { value: "SCHEDULED", label: "Scheduled", color: "#7fa8c9" },
  { value: "COMPLETED", label: "Completed", color: "#3fae6a" },
  { value: "RESCHEDULED", label: "Rescheduled", color: "#c9a24b" },
  { value: "CANCELLED", label: "Cancelled", color: "#5a5a5a" },
  { value: "MISSED", label: "Missed", color: "#c9605c" },
];

export const FOLLOWUP_STATUS_FILTERS: Option[] = [
  { value: "ALL", label: "All" },
  ...FOLLOWUP_STATUSES,
  { value: "DUE_TODAY", label: "Due Today", color: "#e0955a" },
];

export const FOLLOWUP_REMINDER_OPTIONS: Option[] = [
  { value: "NONE", label: "No reminder" },
  { value: "0", label: "At the scheduled time" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
  { value: "CUSTOM", label: "Custom…" },
];

// ── Documents ──────────────────────────────────────────────────────────
export const DOCUMENT_TYPES: Option[] = [
  { value: "ID", label: "ID" },
  { value: "LICENSE", label: "License" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "REGISTRATION", label: "Registration" },
  { value: "CONTRACT", label: "Contract / Agreement" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "OTHER", label: "Other" },
];

// ── Automation triggers ──────────────────────────────────────────────
export const TRIGGER_EVENTS: Option[] = [
  { value: "NEW_LEAD", label: "New lead is created" },
  { value: "HIGH_VALUE_LEAD", label: "Lead is flagged VIP / high-value" },
  { value: "STAGE_CHANGE", label: "Lead changes pipeline stage" },
  { value: "QUOTE_SENT", label: "Quote is sent" },
  { value: "BOOKING_CONFIRMED", label: "Booking is confirmed" },
  { value: "REMINDER_24H", label: "24 hours before reservation" },
  { value: "REMINDER_2H", label: "2 hours before reservation" },
  { value: "TRIP_COMPLETED", label: "Trip is completed" },
  { value: "NO_CONTACT_X_HOURS", label: "No contact for X hours" },
  { value: "PAYMENT_RECEIVED", label: "Payment is received" },
  { value: "PAYMENT_FAILED", label: "Payment fails" },
  { value: "MAINTENANCE_DUE", label: "Vehicle maintenance is due" },
];

// ── Notification types ──────────────────────────────────────────────────
export const NOTIFICATION_TYPES: Option[] = [
  { value: "NEW_LEAD", label: "New Lead" },
  { value: "HIGH_VALUE_LEAD", label: "High-Value Lead" },
  { value: "NEW_BOOKING", label: "New Booking" },
  { value: "PAYMENT_RECEIVED", label: "Payment Received" },
  { value: "PAYMENT_FAILED", label: "Payment Failed" },
  { value: "DRIVER_LATE", label: "Driver Late" },
  { value: "VEHICLE_UNAVAILABLE", label: "Vehicle Unavailable" },
  { value: "BOOKING_CONFLICT", label: "Booking Conflict" },
  { value: "CUSTOMER_RESPONDED", label: "Customer Responded" },
  { value: "FOLLOW_UP_DUE", label: "Follow-Up Due" },
  { value: "MAINTENANCE_DUE", label: "Maintenance Due" },
];

// ── Amenities (quote / booking add-ons) ─────────────────────────────────
export const AMENITY_OPTIONS = [
  "Champagne Service",
  "Bottled Water",
  "Red Carpet",
  "Child Safety Seat",
  "Wi-Fi Hotspot",
  "Privacy Partition",
  "Decorations (Wedding/Event)",
  "Meet & Greet Sign",
  "Extra Stop",
  "Luggage Assistance",
];

// ── Integrations ──────────────────────────────────────────────────────
export const INTEGRATION_PROVIDERS: { provider: string; category: string; label: string }[] = [
  { provider: "TWILIO", category: "SMS", label: "Twilio (SMS)" },
  { provider: "SENDGRID", category: "EMAIL", label: "SendGrid (Email)" },
  { provider: "RESEND", category: "EMAIL", label: "Resend (Email)" },
  { provider: "STRIPE", category: "PAYMENTS", label: "Stripe (Payments)" },
  { provider: "GOOGLE_CALENDAR", category: "CALENDAR", label: "Google Calendar" },
  { provider: "GPS_TELEMATICS", category: "GPS", label: "GPS / Telematics Provider" },
  { provider: "FLIGHT_TRACKING", category: "FLIGHTS", label: "Flight Tracking API" },
  { provider: "OPENAI", category: "AI", label: "AI Provider (LLM)" },
];

// ── Helpers ───────────────────────────────────────────────────────────
export function optionLabel(options: Option[], value: string | null | undefined): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

export function optionColor(options: Option[], value: string | null | undefined): string {
  if (!value) return "#8a8a8a";
  return options.find((o) => o.value === value)?.color ?? "#8a8a8a";
}
