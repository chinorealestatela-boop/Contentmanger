/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_LEAD_SOURCES,
  DEFAULT_LOST_REASONS,
  DEFAULT_PIPELINE_STAGES,
} from "../src/lib/constants";
import { DEFAULT_PERMISSIONS } from "../src/lib/permissions";
import { DEFAULT_BOOKING_SETTINGS } from "../src/lib/availability";

const prisma = new PrismaClient();

// ── helpers ────────────────────────────────────────────────────────────
function daysAgo(n: number, hour = 9, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number, hour = 9, minute = 0) {
  return daysAgo(-n, hour, minute);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function randPhone() {
  const exch = 200 + Math.floor(Math.random() * 700);
  const line = 1000 + Math.floor(Math.random() * 9000);
  return `(555) ${exch}-${line}`;
}
function randVin() {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  let vin = "";
  for (let i = 0; i < 17; i++) vin += chars[Math.floor(Math.random() * chars.length)];
  return vin;
}
function money(n: number) {
  return Math.round(n / 50) * 50;
}

async function main() {
  console.log("🌱 Seeding Automotive Sales CRM…");

  // ── Roles ────────────────────────────────────────────────────────────
  const roleDefs = [
    { name: "SALESPERSON", label: "Salesperson", description: "Manages assigned customers and leads." },
    { name: "MANAGER", label: "Sales Manager", description: "Views team performance and leads." },
    { name: "ADMIN", label: "Administrator", description: "Manages the entire system." },
  ];
  const roles: Record<string, { id: string }> = {};
  for (const r of roleDefs) {
    roles[r.name] = await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: {
        name: r.name,
        label: r.label,
        description: r.description,
        permissions: JSON.stringify(DEFAULT_PERMISSIONS[r.name]),
      },
    });
  }

  // ── Users ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const userDefs = [
    { firstName: "Sam", lastName: "Carter", email: "sam.carter@driveline-motors.com", role: "SALESPERSON", title: "Sales Consultant", color: "#2563eb" },
    { firstName: "Taylor", lastName: "Nguyen", email: "taylor.nguyen@driveline-motors.com", role: "SALESPERSON", title: "Sales Consultant", color: "#0d9488" },
    { firstName: "Jordan", lastName: "Blake", email: "jordan.blake@driveline-motors.com", role: "MANAGER", title: "Sales Manager", color: "#7c3aed" },
    { firstName: "Alex", lastName: "Rivera", email: "alex.rivera@driveline-motors.com", role: "ADMIN", title: "General Manager", color: "#dc2626" },
  ];
  const users: Record<string, { id: string }> = {};
  for (const u of userDefs) {
    users[u.email] = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        passwordHash,
        title: u.title,
        avatarColor: u.color,
        roleId: roles[u.role].id,
        lastLoginAt: daysAgo(0),
      },
    });
  }
  const sam = users["sam.carter@driveline-motors.com"];
  const taylor = users["taylor.nguyen@driveline-motors.com"];
  const jordan = users["jordan.blake@driveline-motors.com"];

  // ── Lead sources ─────────────────────────────────────────────────────
  const sources: Record<string, { id: string }> = {};
  for (let i = 0; i < DEFAULT_LEAD_SOURCES.length; i++) {
    const name = DEFAULT_LEAD_SOURCES[i];
    sources[name] = await prisma.leadSource.upsert({
      where: { name },
      update: {},
      create: { name, order: i },
    });
  }

  // ── Pipeline stages ──────────────────────────────────────────────────
  const stages: Record<string, { id: string }> = {};
  for (const s of DEFAULT_PIPELINE_STAGES) {
    stages[s.name] = await prisma.pipelineStage.upsert({
      where: { name: s.name },
      update: {},
      create: {
        name: s.name,
        order: s.order,
        color: s.color,
        isClosedWon: !!s.isClosedWon,
        isClosedLost: !!s.isClosedLost,
      },
    });
  }

  // ── Lost reasons ─────────────────────────────────────────────────────
  const lostReasons: Record<string, { id: string }> = {};
  for (let i = 0; i < DEFAULT_LOST_REASONS.length; i++) {
    const name = DEFAULT_LOST_REASONS[i];
    lostReasons[name] = await prisma.lostReason.upsert({
      where: { name },
      update: {},
      create: { name, order: i },
    });
  }

  // ── Integrations (all disabled — optional, added later) ─────────────
  const integrationDefs = [
    { provider: "OPENAI", category: "AI" },
    { provider: "TWILIO", category: "SMS" },
    { provider: "RESEND", category: "EMAIL" },
    { provider: "GMAIL", category: "EMAIL" },
    { provider: "OUTLOOK", category: "EMAIL" },
    { provider: "GOOGLE_CALENDAR", category: "CALENDAR" },
    { provider: "DMS", category: "DMS" },
    { provider: "INVENTORY_FEED", category: "INVENTORY" },
  ];
  for (const i of integrationDefs) {
    await prisma.integration.upsert({
      where: { provider: i.provider },
      update: {},
      create: { provider: i.provider, category: i.category, enabled: false },
    });
  }

  // ── Settings ──────────────────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { key: "dealership" },
    update: {},
    create: {
      key: "dealership",
      value: JSON.stringify({
        name: "AutoMax LV",
        address: "3141 Fremont St, Las Vegas, NV 89104",
        phone: "702-325-3898",
        timezone: "America/Los_Angeles",
      }),
    },
  });

  // Public test-drive booking site defaults (working hours, appointment
  // length, reminders, etc.) — see src/lib/availability.ts. Left unseeded
  // deliberately falls back to the same defaults, but seeding it here means
  // Settings → Booking & Hours shows real values immediately in the demo.
  await prisma.setting.upsert({
    where: { key: "booking" },
    update: {},
    create: { key: "booking", value: JSON.stringify(DEFAULT_BOOKING_SETTINGS) },
  });

  // ── Follow-up sequences ──────────────────────────────────────────────
  const newLeadSeq = await prisma.followUpSequence.create({
    data: {
      name: "New Lead — Standard",
      description: "Default cadence for every new lead: fast first response, then a steady drip through 30 days.",
      isDefault: true,
      trigger: "NEW_LEAD",
      steps: {
        create: [
          { dayOffset: 0, type: "CALL", title: "Day 0 — Call new lead", order: 0 },
          { dayOffset: 0, type: "TEXT", title: "Day 0 — Text new lead", order: 1 },
          { dayOffset: 1, type: "CALL", title: "Day 1 — Follow-up call", order: 2 },
          { dayOffset: 2, type: "TEXT", title: "Day 2 — Check-in text", order: 3 },
          { dayOffset: 4, type: "CALL", title: "Day 4 — Follow-up call", order: 4 },
          { dayOffset: 7, type: "FOLLOW_UP", title: "Day 7 — Follow-up", order: 5 },
          { dayOffset: 14, type: "FOLLOW_UP", title: "Day 14 — Re-engagement", order: 6 },
          { dayOffset: 30, type: "FOLLOW_UP", title: "Day 30 — Long-term follow-up", order: 7 },
        ],
      },
    },
  });

  const reactivationSeq = await prisma.followUpSequence.create({
    data: {
      name: "Reactivation — Win-Back",
      description: "Cadence for bringing old or lost customers back into an active conversation.",
      isDefault: true,
      trigger: "REACTIVATION",
      steps: {
        create: [
          { dayOffset: 0, type: "TEXT", title: "Day 0 — Reactivation text", order: 0 },
          { dayOffset: 2, type: "CALL", title: "Day 2 — Reactivation call", order: 1 },
          { dayOffset: 7, type: "EMAIL", title: "Day 7 — Reactivation email", order: 2 },
          { dayOffset: 21, type: "FOLLOW_UP", title: "Day 21 — Final check-in", order: 3 },
        ],
      },
    },
  });

  // ── Automation rules ──────────────────────────────────────────────────
  await prisma.automationRule.createMany({
    data: [
      {
        name: "New lead → start Day 0 follow-up",
        triggerEvent: "NEW_LEAD",
        actions: JSON.stringify([
          { type: "ENROLL_SEQUENCE", sequenceName: "New Lead — Standard" },
          { type: "NOTIFY", notifType: "NEW_LEAD", title: "New lead assigned to you" },
        ]),
        order: 0,
      },
      {
        name: "Lead goes HOT → high-priority task",
        triggerEvent: "HOT_LEAD",
        actions: JSON.stringify([
          { type: "CREATE_TASK", taskType: "CALL", title: "🔥 Hot lead — call immediately", priority: "URGENT", dueInHours: 1 },
          { type: "NOTIFY", notifType: "HOT_LEAD", title: "Lead just went HOT" },
        ]),
        order: 1,
      },
      {
        name: "Appointment created → confirmation task",
        triggerEvent: "APPOINTMENT_CREATED",
        actions: JSON.stringify([{ type: "CREATE_TASK", taskType: "CALL", title: "Confirm upcoming appointment", priority: "HIGH", dueInHours: 2 }]),
        order: 2,
      },
      {
        name: "Appointment tomorrow → reminder",
        triggerEvent: "APPOINTMENT_TOMORROW",
        actions: JSON.stringify([
          { type: "CREATE_TASK", taskType: "TEXT", title: "Send appointment reminder", priority: "HIGH", dueInHours: 4 },
          { type: "NOTIFY", notifType: "APPOINTMENT_TOMORROW", title: "Appointment tomorrow" },
        ]),
        order: 3,
      },
      {
        name: "Appointment completed → follow-up",
        triggerEvent: "APPOINTMENT_COMPLETED",
        actions: JSON.stringify([{ type: "CREATE_TASK", taskType: "FOLLOW_UP", title: "Follow up after visit", priority: "NORMAL", dueInHours: 24 }]),
        order: 4,
      },
      {
        name: "No-show → urgent follow-up",
        triggerEvent: "APPOINTMENT_NO_SHOW",
        actions: JSON.stringify([
          { type: "CREATE_TASK", taskType: "CALL", title: "No-show — urgent follow-up call", priority: "URGENT", dueInHours: 2 },
          { type: "NOTIFY", notifType: "NO_SHOW", title: "Customer no-showed an appointment" },
        ]),
        order: 5,
      },
      {
        name: "No contact in 3 days → task",
        triggerEvent: "NO_CONTACT_X_DAYS",
        conditions: JSON.stringify({ days: 3 }),
        actions: JSON.stringify([{ type: "CREATE_TASK", taskType: "CALL", title: "No contact in 3 days — reach out", priority: "HIGH", dueInHours: 4 }]),
        order: 6,
      },
      {
        name: "Test drive completed → follow-up",
        triggerEvent: "TEST_DRIVE_COMPLETED",
        actions: JSON.stringify([{ type: "CREATE_TASK", taskType: "FOLLOW_UP", title: "Follow up after test drive", priority: "HIGH", dueInHours: 24 }]),
        order: 7,
      },
      {
        name: "Vehicle of interest sold → alert",
        triggerEvent: "VEHICLE_SOLD",
        actions: JSON.stringify([{ type: "NOTIFY", notifType: "VEHICLE_SOLD", title: "A customer's vehicle of interest just sold" }]),
        order: 8,
      },
      {
        name: "Lead lost → schedule reactivation",
        triggerEvent: "LEAD_LOST",
        actions: JSON.stringify([{ type: "CREATE_TASK", taskType: "FOLLOW_UP", title: "Reactivation check-in", priority: "LOW", dueInDays: 45 }]),
        order: 9,
      },
      {
        name: "Follow-up completed → schedule next step",
        triggerEvent: "FOLLOW_UP_COMPLETED",
        actions: JSON.stringify([{ type: "ADVANCE_SEQUENCE" }]),
        order: 10,
      },
    ],
  });

  // ── Vehicle inventory (15) ───────────────────────────────────────────
  const vehicleDefs = [
    { year: 2026, make: "Kestrel", model: "Ranger SUV", trim: "XLT", condition: "NEW", bodyStyle: "SUV", drivetrain: "AWD", mileage: 8, ext: "Alpine White", int: "Black", msrp: 42900, seats: 7 },
    { year: 2026, make: "Kestrel", model: "Ranger SUV", trim: "Limited", condition: "NEW", bodyStyle: "SUV", drivetrain: "AWD", mileage: 5, ext: "Onyx Black", int: "Tan", msrp: 48500, seats: 7 },
    { year: 2025, make: "Voltano", model: "Meridian", trim: "SE", condition: "USED", bodyStyle: "SEDAN", drivetrain: "FWD", mileage: 12450, ext: "Silver Steel", int: "Gray", sell: 24900, seats: 5 },
    { year: 2024, make: "Voltano", model: "Meridian", trim: "SEL", condition: "USED", bodyStyle: "SEDAN", drivetrain: "FWD", mileage: 21830, ext: "Ruby Red", int: "Black", sell: 22400, seats: 5 },
    { year: 2026, make: "Harrow", model: "Trailhand", trim: "Sport", condition: "NEW", bodyStyle: "TRUCK", drivetrain: "4WD", mileage: 3, ext: "Storm Gray", int: "Black", msrp: 51200, seats: 5 },
    { year: 2026, make: "Harrow", model: "Trailhand", trim: "Longhorn", condition: "NEW", bodyStyle: "TRUCK", drivetrain: "4WD", mileage: 10, ext: "Deep Blue", int: "Saddle", msrp: 58900, seats: 6 },
    { year: 2023, make: "Harrow", model: "Trailhand", trim: "XL", condition: "USED", bodyStyle: "TRUCK", drivetrain: "4WD", mileage: 34200, ext: "White", int: "Gray", sell: 39900, seats: 5 },
    { year: 2026, make: "Solace", model: "Aria", trim: "Touring", condition: "NEW", bodyStyle: "SUV", drivetrain: "AWD", mileage: 6, ext: "Pearl White", int: "Beige", msrp: 44300, seats: 7 },
    { year: 2025, make: "Solace", model: "Aria", trim: "Base", condition: "CERTIFIED", bodyStyle: "SUV", drivetrain: "AWD", mileage: 15600, ext: "Black", int: "Black", sell: 36700, seats: 7 },
    { year: 2026, make: "Cobalt", model: "Sprint", trim: "GT", condition: "NEW", bodyStyle: "COUPE", drivetrain: "RWD", mileage: 4, ext: "Racing Yellow", int: "Black", msrp: 39800, seats: 4 },
    { year: 2024, make: "Cobalt", model: "Sprint", trim: "LX", condition: "USED", bodyStyle: "COUPE", drivetrain: "FWD", mileage: 18900, ext: "Blue", int: "Gray", sell: 26400, seats: 4 },
    { year: 2026, make: "Harbor", model: "Voyage", trim: "SE", condition: "NEW", bodyStyle: "VAN", drivetrain: "FWD", mileage: 9, ext: "Silver", int: "Gray", msrp: 37600, seats: 8 },
    { year: 2025, make: "Kestrel", model: "Compass Cross", trim: "SE", condition: "NEW", bodyStyle: "SUV", drivetrain: "AWD", mileage: 2, ext: "Black", int: "Black", msrp: 31200, seats: 5 },
    { year: 2023, make: "Voltano", model: "Skyline", trim: "Premium", condition: "USED", bodyStyle: "SEDAN", drivetrain: "AWD", mileage: 27100, ext: "Champagne", int: "Tan", sell: 28900, seats: 5 },
    { year: 2026, make: "Harrow", model: "Basecamp", trim: "SUV Sport", condition: "NEW", bodyStyle: "SUV", drivetrain: "4WD", mileage: 7, ext: "Forest Green", int: "Black", msrp: 46700, seats: 7 },
  ];

  const vehicles: { id: string; make: string; model: string; bodyStyle: string | null; status: string }[] = [];
  for (let i = 0; i < vehicleDefs.length; i++) {
    const v = vehicleDefs[i];
    const status = i === 2 ? "SOLD" : i === 6 ? "HOLD" : i === 11 ? "IN_TRANSIT" : "AVAILABLE";
    const sellingPrice = v.sell ?? (v.msrp ? v.msrp - 500 : undefined);
    const created = await prisma.vehicle.create({
      data: {
        stockNumber: `DL${(1000 + i).toString()}`,
        vin: randVin(),
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.trim,
        condition: v.condition,
        bodyStyle: v.bodyStyle,
        drivetrain: v.drivetrain,
        mileage: v.mileage,
        exteriorColor: v.ext,
        interiorColor: v.int,
        msrp: v.msrp ?? null,
        sellingPrice: sellingPrice ?? null,
        internetPrice: sellingPrice ? sellingPrice - 300 : null,
        status,
        location: pick(["Front Lot", "Showroom", "Back Lot", "Service Overflow"]),
        seatingCapacity: v.seats,
        description: `${v.year} ${v.make} ${v.model} ${v.trim} — ${v.condition === "NEW" ? "brand new" : "well-maintained"} with ${v.drivetrain} and a clean history.`,
        photos: JSON.stringify([]),
      },
    });
    vehicles.push({ id: created.id, make: v.make, model: v.model, bodyStyle: v.bodyStyle, status });
  }

  // ── Customers + Leads ─────────────────────────────────────────────────
  const firstNames = ["Michael", "Jessica", "David", "Ashley", "Chris", "Amanda", "Brian", "Megan", "Kevin", "Laura", "Jason", "Stephanie", "Ryan", "Nicole", "Eric", "Rachel", "Justin", "Kayla", "Brandon", "Emily", "Marcus", "Devon"];
  const lastNames = ["Thompson", "Martinez", "Johnson", "Lee", "Anderson", "Walker", "Young", "Scott", "Hernandez", "Torres", "Bennett", "Foster", "Bryant", "Chavez", "Reed", "Coleman", "Sullivan", "Ward", "Griffin", "Hayes", "Patterson", "Simmons"];

  type CustomerPlan = {
    temperature: "HOT" | "WARM" | "COLD";
    stage: string;
    status: string;
    score: number;
    timeframe: string;
    lastContactDaysAgo: number;
    nextFollowUpDaysOffset: number | null; // negative = overdue
    financeType: string;
    creditApp: string;
    hasTrade: boolean;
    vehicleIdx: number;
    source: string;
  };

  const plans: CustomerPlan[] = [
    { temperature: "HOT", stage: "Negotiating", status: "ACTIVE", score: 92, timeframe: "IMMEDIATE", lastContactDaysAgo: 0, nextFollowUpDaysOffset: 0, financeType: "FINANCE", creditApp: "APPROVED", hasTrade: true, vehicleIdx: 4, source: "Website" },
    { temperature: "HOT", stage: "Appointment Confirmed", status: "ACTIVE", score: 88, timeframe: "IMMEDIATE", lastContactDaysAgo: 1, nextFollowUpDaysOffset: 0, financeType: "FINANCE", creditApp: "SUBMITTED", hasTrade: false, vehicleIdx: 0, source: "Walk-In" },
    { temperature: "HOT", stage: "Test Drive", status: "ACTIVE", score: 85, timeframe: "THIS_WEEK", lastContactDaysAgo: 0, nextFollowUpDaysOffset: -1, financeType: "CASH", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 7, source: "Referral" },
    { temperature: "HOT", stage: "Credit Application", status: "ACTIVE", score: 83, timeframe: "IMMEDIATE", lastContactDaysAgo: 2, nextFollowUpDaysOffset: -2, financeType: "FINANCE", creditApp: "PENDING", hasTrade: true, vehicleIdx: 5, source: "Autotrader" },
    { temperature: "WARM", stage: "Appointment Set", status: "ACTIVE", score: 72, timeframe: "THIS_WEEK", lastContactDaysAgo: 1, nextFollowUpDaysOffset: 1, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: true, vehicleIdx: 8, source: "Cars.com" },
    { temperature: "WARM", stage: "Engaged", status: "ACTIVE", score: 68, timeframe: "THIS_MONTH", lastContactDaysAgo: 2, nextFollowUpDaysOffset: 0, financeType: "LEASE", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 9, source: "Facebook Marketplace" },
    { temperature: "WARM", stage: "Contacted", status: "ACTIVE", score: 63, timeframe: "THIS_MONTH", lastContactDaysAgo: 3, nextFollowUpDaysOffset: -1, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: true, vehicleIdx: 12, source: "CarGurus" },
    { temperature: "WARM", stage: "Showed", status: "ACTIVE", score: 66, timeframe: "THIS_WEEK", lastContactDaysAgo: 4, nextFollowUpDaysOffset: 2, financeType: "CASH", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 1, source: "Google Ads" },
    { temperature: "WARM", stage: "Engaged", status: "ACTIVE", score: 58, timeframe: "THIS_QUARTER", lastContactDaysAgo: 2, nextFollowUpDaysOffset: 3, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 13, source: "Repeat Customer" },
    { temperature: "WARM", stage: "Contacted", status: "ACTIVE", score: 55, timeframe: "THIS_MONTH", lastContactDaysAgo: 5, nextFollowUpDaysOffset: -3, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: true, vehicleIdx: 14, source: "Third-Party Lead Provider" },
    { temperature: "COLD", stage: "New Lead", status: "ACTIVE", score: 35, timeframe: "THIS_QUARTER", lastContactDaysAgo: 0, nextFollowUpDaysOffset: 0, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 2, source: "Website" },
    { temperature: "COLD", stage: "New Lead", status: "ACTIVE", score: 28, timeframe: "RESEARCHING", lastContactDaysAgo: 0, nextFollowUpDaysOffset: 0, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 3, source: "Cars.com" },
    { temperature: "COLD", stage: "Contacted", status: "ACTIVE", score: 40, timeframe: "THIS_QUARTER", lastContactDaysAgo: 6, nextFollowUpDaysOffset: -4, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 10, source: "Autotrader" },
    { temperature: "COLD", stage: "Contacted", status: "ACTIVE", score: 22, timeframe: "RESEARCHING", lastContactDaysAgo: 8, nextFollowUpDaysOffset: -6, financeType: "CASH", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 11, source: "Trade Show / Event" },
    { temperature: "COLD", stage: "Engaged", status: "ACTIVE", score: 45, timeframe: "THIS_QUARTER", lastContactDaysAgo: 3, nextFollowUpDaysOffset: 5, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: true, vehicleIdx: 0, source: "Phone Up" },
    { temperature: "COLD", stage: "New Lead", status: "ACTIVE", score: 18, timeframe: "RESEARCHING", lastContactDaysAgo: 1, nextFollowUpDaysOffset: 1, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 1, source: "Website" },
    { temperature: "COLD", stage: "Lost", status: "LOST", score: 15, timeframe: "RESEARCHING", lastContactDaysAgo: 22, nextFollowUpDaysOffset: null, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 2, source: "Autotrader" },
    { temperature: "COLD", stage: "Lost", status: "LOST", score: 12, timeframe: "RESEARCHING", lastContactDaysAgo: 45, nextFollowUpDaysOffset: null, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 3, source: "CarGurus" },
    { temperature: "COLD", stage: "Lost", status: "LOST", score: 10, timeframe: "RESEARCHING", lastContactDaysAgo: 70, nextFollowUpDaysOffset: null, financeType: "FINANCE", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 12, source: "Facebook Marketplace" },
    { temperature: "COLD", stage: "Lost", status: "LOST", score: 8, timeframe: "RESEARCHING", lastContactDaysAgo: 120, nextFollowUpDaysOffset: null, financeType: "CASH", creditApp: "NOT_STARTED", hasTrade: false, vehicleIdx: 13, source: "Referral" },
  ];

  const lostReasonNames = Object.keys(lostReasons);
  const salesReps = [sam, sam, sam, taylor, taylor, jordan];
  let activityCount = 0;

  async function logActivity(customerId: string, leadId: string | null, type: string, description: string, actorId: string | null, createdAt: Date) {
    activityCount++;
    await prisma.activity.create({
      data: { customerId, leadId, type, description, actorId, createdAt },
    });
  }

  const createdCustomers: { id: string; name: string; ownerId: string }[] = [];
  const createdLeads: { id: string; customerId: string; temperature: string; stageName: string }[] = [];

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const firstName = firstNames[i];
    const lastName = lastNames[i];
    const owner = salesReps[i % salesReps.length];
    const vehicle = vehicles[plan.vehicleIdx];

    const customer = await prisma.customer.create({
      data: {
        firstName,
        lastName,
        phone: randPhone(),
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        address: `${100 + i * 7} ${pick(["Maple", "Oak", "Cedar", "Birch", "Elm", "Pine"])} St`,
        city: pick(["Riverbend", "Fairview", "Oakdale", "Millbrook", "Ashton"]),
        state: "TX",
        zip: `750${(10 + i).toString().slice(-2)}`,
        preferredContactMethod: pick(["PHONE", "TEXT", "EMAIL"]),
        bestContactTime: pick(["MORNING", "AFTERNOON", "EVENING", "ANYTIME"]),
        ownerId: owner.id,
        createdAt: daysAgo(plan.lastContactDaysAgo + Math.floor(Math.random() * 10) + 1),
      },
    });
    createdCustomers.push({ id: customer.id, name: `${firstName} ${lastName}`, ownerId: owner.id });

    const isLost = plan.status === "LOST";
    const lostReasonName = isLost ? pick(lostReasonNames) : null;

    const lead = await prisma.lead.create({
      data: {
        customerId: customer.id,
        sourceId: sources[plan.source]?.id,
        assigneeId: owner.id,
        stageId: stages[plan.stage].id,
        stageEnteredAt: daysAgo(Math.min(plan.lastContactDaysAgo, 5)),
        status: plan.status,
        temperature: plan.temperature,
        score: plan.score,
        purchaseTimeframe: plan.timeframe,
        dateReceived: daysAgo(plan.lastContactDaysAgo + Math.floor(Math.random() * 10) + 1),
        financeType: plan.financeType,
        desiredPayment: plan.financeType !== "CASH" ? money(350 + Math.random() * 350) : null,
        downPayment: plan.financeType !== "CASH" ? money(1000 + Math.random() * 4000) : null,
        creditAppStatus: plan.creditApp,
        hasCoBuyer: Math.random() > 0.75,
        prefBodyStyle: vehicle.bodyStyle,
        prefMaxPrice: money(25000 + Math.random() * 30000),
        prefDrivetrain: pick(["FWD", "AWD", "4WD"]),
        prefThirdRow: Math.random() > 0.6,
        prefColor: pick(["White", "Black", "Silver", "Blue", "Red", "No preference"]),
        customerNeeds: pick([
          "Needs reliable daily commuter with good fuel economy.",
          "Growing family — needs more cargo and passenger space.",
          "Wants something more capable for towing a small trailer.",
          "Looking to upgrade from an older vehicle with rising repair costs.",
          "Wants a fun weekend car with a bit more style.",
        ]),
        customerWants: pick([
          "Would like heated seats and a sunroof if possible.",
          "Prefers a specific exterior color but flexible on trim.",
          "Wants the latest safety tech / adaptive cruise.",
          "Interested in a low-mileage certified option.",
        ]),
        objections: plan.temperature === "COLD" ? pick(["Price is higher than expected.", "Wants to shop around first.", "Not ready to commit yet.", ""]) : null,
        preferences: "Prefers text for quick updates, calls for anything detailed.",
        salesNotes: `Met via ${plan.source}. ${plan.temperature === "HOT" ? "Highly engaged, moving fast." : plan.temperature === "WARM" ? "Engaged, needs consistent follow-up." : "Early stage, nurturing."}`,
        lastContactedAt: daysAgo(plan.lastContactDaysAgo),
        nextFollowUpAt: plan.nextFollowUpDaysOffset === null ? null : daysFromNow(plan.nextFollowUpDaysOffset, pick([9, 10, 11, 13, 14, 15, 16])),
        lostReasonId: lostReasonName ? lostReasons[lostReasonName].id : null,
        lostAt: isLost ? daysAgo(plan.lastContactDaysAgo) : null,
        lostNotes: isLost ? "No longer responding to outreach." : null,
      },
    });
    createdLeads.push({ id: lead.id, customerId: customer.id, temperature: plan.temperature, stageName: plan.stage });

    await prisma.leadScoreEvent.create({
      data: { leadId: lead.id, points: plan.score, reason: "Initial seed score" },
    });

    await prisma.customerVehicle.create({
      data: {
        customerId: customer.id,
        leadId: lead.id,
        vehicleId: vehicle.id,
        isPrimary: true,
        interestLevel: plan.stage === "Sold" ? "PURCHASED" : plan.temperature === "HOT" ? "STRONG" : "INTERESTED",
      },
    });

    await logActivity(customer.id, lead.id, "LEAD_CREATED", `Lead created from ${plan.source}.`, owner.id, daysAgo(plan.lastContactDaysAgo + 5));
    await logActivity(customer.id, lead.id, "STAGE_CHANGE", `Stage set to ${plan.stage}.`, owner.id, daysAgo(plan.lastContactDaysAgo));

    // Trade-in for customers with one
    if (plan.hasTrade) {
      const payoff = money(4000 + Math.random() * 12000);
      const est = money(6000 + Math.random() * 15000);
      await prisma.tradeIn.create({
        data: {
          customerId: customer.id,
          year: 2015 + Math.floor(Math.random() * 8),
          make: pick(["Voltano", "Kestrel", "Harrow", "Cobalt"]),
          model: pick(["Meridian", "Ranger SUV", "Trailhand", "Sprint"]),
          trim: pick(["Base", "SE", "LX", "Sport"]),
          vin: randVin(),
          mileage: 40000 + Math.floor(Math.random() * 80000),
          payoff,
          estimatedValue: est,
          desiredValue: est + money(500 + Math.random() * 1000),
          appraisalStatus: pick(["PENDING", "APPRAISED", "ACCEPTED"]),
          notes: est > payoff ? "Positive equity — good trade candidate." : "Negative equity — will need to roll into new payment.",
        },
      });
    }

    // Communications — a handful per active lead
    if (!isLost) {
      const commCount = 2 + Math.floor(Math.random() * 3);
      for (let c = 0; c < commCount; c++) {
        const daysBack = Math.max(0, plan.lastContactDaysAgo + c);
        const type = pick(["CALL", "TEXT", "EMAIL", "VOICEMAIL"]);
        const summary = pick([
          "Discussed vehicle options and pricing.",
          "Confirmed appointment details.",
          "Answered questions about financing.",
          "Left a voicemail checking in.",
          "Sent follow-up with vehicle info.",
          "Discussed trade-in value.",
        ]);
        const occurredAt = daysAgo(daysBack, 9 + c, 15);
        await prisma.communication.create({
          data: { customerId: customer.id, type, direction: Math.random() > 0.3 ? "OUTBOUND" : "INBOUND", summary, actorId: owner.id, occurredAt },
        });
        await logActivity(customer.id, lead.id, "COMMUNICATION_LOGGED", `${type} logged: ${summary}`, owner.id, occurredAt);
      }
    }

    // Notes
    await prisma.note.create({
      data: {
        customerId: customer.id,
        leadId: lead.id,
        body: plan.temperature === "HOT" ? "Ready to move — keep momentum, don't let this go cold." : "Continue nurturing per standard cadence.",
        authorId: owner.id,
        createdAt: daysAgo(plan.lastContactDaysAgo),
      },
    });

    // Offers for negotiating customers
    if (plan.stage === "Negotiating" || plan.stage === "Credit Application") {
      await prisma.offer.create({
        data: {
          customerId: customer.id,
          vehicleId: vehicle.id,
          offerPrice: money((vehicle as unknown as { sellingPrice?: number }).sellingPrice ?? 35000),
          monthlyPayment: money(420 + Math.random() * 200),
          term: pick([48, 60, 72]),
          downPayment: money(2000 + Math.random() * 3000),
          status: pick(["PENDING", "COUNTERED"]),
          notes: "Working numbers with the desk.",
        },
      });
    }

    // Sequence enrollment for active, non-lost leads
    if (!isLost) {
      await prisma.followUpEnrollment.create({
        data: {
          customerId: customer.id,
          leadId: lead.id,
          sequenceId: newLeadSeq.id,
          currentStepIndex: Math.min(3, Math.floor(Math.random() * 5)),
          status: "ACTIVE",
        },
      });
    } else {
      await prisma.followUpEnrollment.create({
        data: {
          customerId: customer.id,
          leadId: lead.id,
          sequenceId: reactivationSeq.id,
          currentStepIndex: 0,
          status: "CANCELLED",
        },
      });
    }
  }

  // ── A couple of SOLD deals for reporting/dashboard realism ──────────
  const soldPlans = [
    { firstName: "Patricia", lastName: "Nguyen", vehicleIdx: 2, price: 24200, finance: "FINANCE" },
    { firstName: "Daniel", lastName: "Ortiz", vehicleIdx: 8, price: 36200, finance: "LEASE" },
  ];
  for (const sp of soldPlans) {
    const owner = pick([sam, taylor]);
    const vehicle = vehicles[sp.vehicleIdx];
    const customer = await prisma.customer.create({
      data: {
        firstName: sp.firstName,
        lastName: sp.lastName,
        phone: randPhone(),
        email: `${sp.firstName.toLowerCase()}.${sp.lastName.toLowerCase()}@example.com`,
        address: `${400 + Math.floor(Math.random() * 200)} Willow Ave`,
        city: "Riverbend",
        state: "TX",
        zip: "75012",
        preferredContactMethod: "PHONE",
        ownerId: owner.id,
        createdAt: daysAgo(21),
      },
    });
    const lead = await prisma.lead.create({
      data: {
        customerId: customer.id,
        sourceId: sources["Referral"].id,
        assigneeId: owner.id,
        stageId: stages["Sold"].id,
        status: "SOLD",
        temperature: "HOT",
        score: 100,
        purchaseTimeframe: "IMMEDIATE",
        dateReceived: daysAgo(21),
        financeType: sp.finance,
        creditAppStatus: sp.finance === "CASH" ? "NOT_STARTED" : "APPROVED",
        lastContactedAt: daysAgo(1),
        soldAt: daysAgo(1),
        salesNotes: "Deal closed — delivered vehicle.",
      },
    });
    await prisma.customerVehicle.create({
      data: { customerId: customer.id, leadId: lead.id, vehicleId: vehicle.id, isPrimary: true, interestLevel: "PURCHASED" },
    });
    await prisma.sale.create({
      data: {
        customerId: customer.id,
        leadId: lead.id,
        vehicleId: vehicle.id,
        salePrice: sp.price,
        financeType: sp.finance,
        saleDate: daysAgo(1),
        salespersonId: owner.id,
        notes: "Smooth close, customer very satisfied.",
      },
    });
    await logActivity(customer.id, lead.id, "SOLD", `Deal closed on ${vehicle.make} ${vehicle.model}.`, owner.id, daysAgo(1));
  }

  // ── Appointments (10) ────────────────────────────────────────────────
  const apptPlans = [
    { customerIdx: 0, type: "TEST_DRIVE", status: "CONFIRMED", dayOffset: 0, time: "14:00" },
    { customerIdx: 1, type: "SHOWROOM_VISIT", status: "CONFIRMED", dayOffset: 0, time: "16:30" },
    { customerIdx: 2, type: "CREDIT_APPLICATION", status: "SCHEDULED", dayOffset: 1, time: "10:00" },
    { customerIdx: 3, type: "TRADE_APPRAISAL", status: "SCHEDULED", dayOffset: 1, time: "13:00" },
    { customerIdx: 4, type: "SHOWROOM_VISIT", status: "SCHEDULED", dayOffset: 2, time: "11:00" },
    { customerIdx: 5, type: "TEST_DRIVE", status: "SCHEDULED", dayOffset: 3, time: "15:00" },
    { customerIdx: 6, type: "SHOWROOM_VISIT", status: "SHOWED", dayOffset: -2, time: "10:30" },
    { customerIdx: 7, type: "TEST_DRIVE", status: "NO_SHOW", dayOffset: -1, time: "17:00" },
    { customerIdx: 8, type: "VEHICLE_DELIVERY", status: "COMPLETED", dayOffset: -4, time: "12:00" },
    { customerIdx: 9, type: "FOLLOW_UP", status: "CANCELLED", dayOffset: -3, time: "09:30" },
  ];
  for (const ap of apptPlans) {
    const cust = createdCustomers[ap.customerIdx];
    const lead = createdLeads[ap.customerIdx];
    const vehicle = vehicles[plans[ap.customerIdx].vehicleIdx];
    const appt = await prisma.appointment.create({
      data: {
        customerId: cust.id,
        vehicleId: vehicle.id,
        salespersonId: cust.ownerId,
        date: daysFromNow(ap.dayOffset, 0, 0),
        time: ap.time,
        type: ap.type,
        status: ap.status,
        notes: ap.status === "NO_SHOW" ? "Customer did not show. Attempting to reschedule." : "Standard appointment.",
      },
    });
    await logActivity(cust.id, lead.id, "APPOINTMENT", `${ap.type.replace("_", " ")} appointment ${ap.status.toLowerCase()} for ${ap.time}.`, cust.ownerId, daysFromNow(Math.min(ap.dayOffset, 0)));

    if (ap.type === "TEST_DRIVE" && (ap.status === "SHOWED" || ap.status === "COMPLETED")) {
      await prisma.testDrive.create({
        data: {
          customerId: cust.id,
          vehicleId: vehicle.id,
          appointmentId: appt.id,
          salespersonId: cust.ownerId,
          date: daysFromNow(ap.dayOffset),
          startTime: ap.time,
          endTime: "15:00",
          customerReaction: "POSITIVE",
          notes: "Loved the ride quality and tech features.",
          nextStep: "Send pricing worksheet and follow up tomorrow.",
        },
      });
    }
  }

  // A few extra completed test drives beyond the appointment set (for pipeline realism)
  const extraTestDriveIdxs = [2, 3, 5];
  for (const idx of extraTestDriveIdxs) {
    const cust = createdCustomers[idx];
    const vehicle = vehicles[plans[idx].vehicleIdx];
    await prisma.testDrive.create({
      data: {
        customerId: cust.id,
        vehicleId: vehicle.id,
        salespersonId: cust.ownerId,
        date: daysAgo(2),
        startTime: "13:00",
        endTime: "13:30",
        customerReaction: pick(["POSITIVE", "NEUTRAL"]),
        objections: pick(["Payment a bit higher than hoped.", "", "Wants to compare with one more model."]),
        notes: "Test drive completed, customer engaged well with the vehicle.",
        nextStep: "Follow up with numbers.",
      },
    });
  }

  // ── Tasks (10+) ───────────────────────────────────────────────────────
  const taskPlans = [
    { idx: 2, title: "Call — vehicle sold, needs alternative", type: "CALL", priority: "URGENT", dueOffset: -2 },
    { idx: 3, title: "Follow up on credit application status", type: "CREDIT", priority: "URGENT", dueOffset: -2 },
    { idx: 6, title: "Check in — no response in days", type: "CALL", priority: "HIGH", dueOffset: -1 },
    { idx: 9, title: "Send follow-up text with pricing", type: "TEXT", priority: "HIGH", dueOffset: -3 },
    { idx: 0, title: "Confirm 2pm test drive today", type: "TEXT", priority: "URGENT", dueOffset: 0 },
    { idx: 1, title: "Prep paperwork for showroom visit", type: "OTHER", priority: "HIGH", dueOffset: 0 },
    { idx: 5, title: "Call to confirm Thursday test drive", type: "CALL", priority: "NORMAL", dueOffset: 1 },
    { idx: 4, title: "Send new inventory matches", type: "EMAIL", priority: "NORMAL", dueOffset: 1 },
    { idx: 8, title: "Follow up on trade-in decision", type: "TRADE", priority: "NORMAL", dueOffset: 3 },
    { idx: 7, title: "Reschedule missed test drive", type: "APPOINTMENT", priority: "HIGH", dueOffset: 0 },
    { idx: 10, title: "Welcome call for new lead", type: "CALL", priority: "NORMAL", dueOffset: -5, status: "COMPLETED" },
    { idx: 11, title: "Send intro email", type: "EMAIL", priority: "LOW", dueOffset: -6, status: "COMPLETED" },
  ];
  for (const tp of taskPlans) {
    const cust = createdCustomers[tp.idx];
    const lead = createdLeads[tp.idx];
    await prisma.task.create({
      data: {
        customerId: cust.id,
        leadId: lead.id,
        title: tp.title,
        type: tp.type,
        priority: tp.priority,
        dueDate: daysFromNow(tp.dueOffset, 0, 0),
        dueTime: pick(["09:00", "10:30", "13:00", "15:30", "17:00"]),
        status: tp.status ?? "PENDING",
        assigneeId: cust.ownerId,
        source: "MANUAL",
        completedAt: tp.status === "COMPLETED" ? daysFromNow(tp.dueOffset) : null,
      },
    });
  }

  // ── Notifications for Sam (primary demo login) ───────────────────────
  const notifPlans = [
    { type: "HOT_LEAD", title: "Lead just went HOT", body: `${createdCustomers[0].name} is showing strong buying signals.` },
    { type: "OVERDUE_FOLLOW_UP", title: "Overdue follow-up", body: `${createdCustomers[2].name} has an overdue follow-up.` },
    { type: "APPOINTMENT_TOMORROW", title: "Appointment tomorrow", body: `${createdCustomers[4].name} has an appointment tomorrow at 11:00 AM.` },
    { type: "NO_SHOW", title: "No-show recorded", body: `${createdCustomers[7].name} did not show for their test drive.` },
    { type: "NEW_LEAD", title: "New lead assigned", body: `${createdCustomers[15].name} was just assigned to you.` },
  ];
  for (const n of notifPlans) {
    await prisma.notification.create({
      data: { userId: sam.id, type: n.type, title: n.title, body: n.body },
    });
  }

  console.log(`✅ Seed complete: ${createdCustomers.length + soldPlans.length} customers, ${createdLeads.length + soldPlans.length} leads, ${vehicles.length} vehicles, ${apptPlans.length} appointments, ${taskPlans.length} tasks, ${activityCount} activity entries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
