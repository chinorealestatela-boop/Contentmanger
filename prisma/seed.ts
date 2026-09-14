import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_LEAD_SOURCES,
  DEFAULT_LOST_REASONS,
  DEFAULT_PIPELINE_STAGES,
  INTEGRATION_PROVIDERS,
} from "../src/lib/constants";
import { DEFAULT_PERMISSIONS } from "../src/lib/permissions";
import { computePricing } from "../src/lib/pricing";

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
function todayAt(hour: number, minute = 0) {
  return daysAgo(0, hour, minute);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randPhone() {
  const exch = 200 + Math.floor(Math.random() * 700);
  const line = 1000 + Math.floor(Math.random() * 9000);
  return `(310) ${exch}-${line}`;
}
function randVin() {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  let vin = "";
  for (let i = 0; i < 17; i++) vin += chars[Math.floor(Math.random() * chars.length)];
  return vin;
}
let bookingSeq = 1000;
function nextBookingNumber() {
  bookingSeq += 1;
  return `SX-${bookingSeq}`;
}
let quoteSeq = 5000;
function nextQuoteNumber() {
  quoteSeq += 1;
  return `Q-${quoteSeq}`;
}

async function main() {
  console.log("🌱 Seeding Stratos Exotics & Lifestyle CRM…");

  // ── Roles ────────────────────────────────────────────────────────────
  const roleDefs = [
    { name: "OWNER", label: "Owner", description: "Full access to every part of the business." },
    { name: "ADMIN", label: "Administrator", description: "Manages the entire system." },
    { name: "MANAGER", label: "Manager", description: "Oversees operations, fleet, and staff." },
    { name: "DISPATCHER", label: "Dispatcher", description: "Assigns drivers and vehicles, manages live trips." },
    { name: "SALES", label: "Concierge / Sales", description: "Manages assigned leads, quotes, and bookings." },
    { name: "DRIVER", label: "Chauffeur", description: "Executes assigned trips from the mobile driver view." },
  ];
  const roles: Record<string, { id: string }> = {};
  for (const r of roleDefs) {
    roles[r.name] = await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: { name: r.name, label: r.label, description: r.description, permissions: JSON.stringify(DEFAULT_PERMISSIONS[r.name]) },
    });
  }

  // ── Employees / Users ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const userDefs = [
    { firstName: "Gene", lastName: "Stratos", email: "chino.realestatela@gmail.com", role: "OWNER", title: "Founder & Owner", color: "#c9a24b" },
    { firstName: "Alexandra", lastName: "Reyes", email: "alexandra.reyes@stratoslux.com", role: "ADMIN", title: "Operations Director", color: "#7fa8c9" },
    { firstName: "Jordan", lastName: "Vance", email: "jordan.vance@stratoslux.com", role: "MANAGER", title: "General Manager", color: "#5cb890" },
    { firstName: "Priya", lastName: "Anand", email: "priya.anand@stratoslux.com", role: "DISPATCHER", title: "Dispatch Lead", color: "#d98a6a" },
    { firstName: "Sofia", lastName: "Lindqvist", email: "sofia.lindqvist@stratoslux.com", role: "SALES", title: "Concierge Manager", color: "#a98fc9" },
    { firstName: "Noah", lastName: "Bennett", email: "noah.bennett@stratoslux.com", role: "SALES", title: "Concierge Specialist", color: "#7fa8c9" },
    { firstName: "Marcus", lastName: "Bell", email: "marcus.bell@stratoslux.com", role: "DRIVER", title: "Lead Chauffeur", color: "#c9a24b" },
    { firstName: "Daniel", lastName: "Cho", email: "daniel.cho@stratoslux.com", role: "DRIVER", title: "Chauffeur", color: "#7fa8c9" },
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
        phone: randPhone(),
      },
    });
  }
  const owner = users["chino.realestatela@gmail.com"];
  const sofia = users["sofia.lindqvist@stratoslux.com"];
  const noah = users["noah.bennett@stratoslux.com"];
  const priya = users["priya.anand@stratoslux.com"];
  const jordan = users["jordan.vance@stratoslux.com"];

  // ── Drivers (chauffeur profiles) ───────────────────────────────────────
  const driverDefs = [
    { firstName: "Marcus", lastName: "Bell", userEmail: "marcus.bell@stratoslux.com", status: "AVAILABLE", rating: 4.98, trips: 412 },
    { firstName: "Daniel", lastName: "Cho", userEmail: "daniel.cho@stratoslux.com", status: "AVAILABLE", rating: 4.95, trips: 356 },
    { firstName: "Emilio", lastName: "Torres", userEmail: null, status: "OFF_DUTY", rating: 4.9, trips: 201 },
    { firstName: "Naomi", lastName: "Park", userEmail: null, status: "AVAILABLE", rating: 4.99, trips: 289 },
  ];
  const drivers: Record<string, { id: string }> = {};
  for (const d of driverDefs) {
    const existing = await prisma.driver.findFirst({ where: { firstName: d.firstName, lastName: d.lastName } });
    drivers[d.firstName] =
      existing ??
      (await prisma.driver.create({
        data: {
          firstName: d.firstName,
          lastName: d.lastName,
          userId: d.userEmail ? users[d.userEmail].id : null,
          phone: randPhone(),
          email: d.userEmail,
          licenseNumber: `CDL-${Math.floor(1000000 + Math.random() * 9000000)}`,
          licenseExpiresAt: daysFromNow(400),
          certifications: JSON.stringify(["Defensive Driving", "VIP Protection Basics", "First Aid/CPR"]),
          status: d.status,
          currentLocation: "Los Angeles, CA",
          rating: d.rating,
          completedTrips: d.trips,
        },
      }));
  }

  // ── Fleet ────────────────────────────────────────────────────────────
  const vehicleDefs = [
    { fleetNumber: "SX-01", name: "Rolls-Royce Cullinan — Black Badge", make: "Rolls-Royce", model: "Cullinan", year: 2024, type: "ROLLS_ROYCE", color: "Diamond Black", seats: 4, hourly: 495, daily: 3200, deposit: 1500, driver: "Marcus" },
    { fleetNumber: "SX-02", name: "Rolls-Royce Phantom", make: "Rolls-Royce", model: "Phantom", year: 2023, type: "ROLLS_ROYCE", color: "Arctic White", seats: 4, hourly: 525, daily: 3400, deposit: 1500, driver: null },
    { fleetNumber: "SX-03", name: "Rolls-Royce Ghost", make: "Rolls-Royce", model: "Ghost", year: 2024, type: "ROLLS_ROYCE", color: "Jet Black", seats: 4, hourly: 460, daily: 3000, deposit: 1500, driver: null },
    { fleetNumber: "SX-04", name: "Maybach Sprinter — VIP Class", make: "Mercedes-Maybach", model: "Sprinter", year: 2024, type: "MAYBACH", color: "Obsidian Black", seats: 10, hourly: 350, daily: 2600, deposit: 1200, driver: "Marcus" },
    { fleetNumber: "SX-05", name: "Mercedes Sprinter — Executive", make: "Mercedes-Benz", model: "Sprinter", year: 2023, type: "MERCEDES_SPRINTER", color: "Iridium Silver", seats: 14, hourly: 195, daily: 1450, deposit: 800, driver: null },
    { fleetNumber: "SX-06", name: "Cadillac Escalade — Platinum", make: "Cadillac", model: "Escalade", year: 2024, type: "CADILLAC_ESCALADE", color: "Black Raven", seats: 6, hourly: 165, daily: 1150, deposit: 600, driver: "Daniel" },
    { fleetNumber: "SX-07", name: "Cadillac Escalade — Sport", make: "Cadillac", model: "Escalade", year: 2023, type: "CADILLAC_ESCALADE", color: "Satin Steel Grey", seats: 6, hourly: 165, daily: 1150, deposit: 600, driver: null },
    { fleetNumber: "SX-08", name: "Lamborghini Urus", make: "Lamborghini", model: "Urus", year: 2024, type: "LAMBORGHINI", color: "Giallo Auge", seats: 4, hourly: 425, daily: 2800, deposit: 2000, driver: null },
    { fleetNumber: "SX-09", name: "Bentley Bentayga", make: "Bentley", model: "Bentayga", year: 2023, type: "BENTLEY", color: "Onyx", seats: 4, hourly: 375, daily: 2500, deposit: 1500, driver: null },
    { fleetNumber: "SX-10", name: "Bentley Flying Spur", make: "Bentley", model: "Flying Spur", year: 2024, type: "BENTLEY", color: "Glacier White", seats: 4, hourly: 385, daily: 2550, deposit: 1500, driver: null },
  ];
  const vehicles: Record<string, { id: string }> = {};
  const vehicleHourlyRates: Record<string, number> = {};
  for (const v of vehicleDefs) {
    vehicleHourlyRates[v.fleetNumber] = v.hourly;
    const existing = await prisma.vehicle.findUnique({ where: { fleetNumber: v.fleetNumber } });
    vehicles[v.fleetNumber] =
      existing ??
      (await prisma.vehicle.create({
        data: {
          fleetNumber: v.fleetNumber,
          name: v.name,
          make: v.make,
          model: v.model,
          year: v.year,
          vin: randVin(),
          licensePlate: `${v.fleetNumber.replace("SX-", "8LUX")}`,
          vehicleType: v.type,
          color: v.color,
          seatingCapacity: v.seats,
          currentMileage: 2000 + Math.floor(Math.random() * 12000),
          availability: "AVAILABLE",
          currentLocation: "Stratos Garage — Downtown LA",
          homeBase: "Stratos Garage — Downtown LA",
          assignedDriverId: v.driver ? drivers[v.driver].id : null,
          hourlyRate: v.hourly,
          dailyRate: v.daily,
          depositRequirement: v.deposit,
          insuranceProvider: "Chubb Private Client",
          insurancePolicyNo: `CPC-${Math.floor(100000 + Math.random() * 900000)}`,
          insuranceExpiresAt: daysFromNow(200),
          registrationExpiresAt: daysFromNow(280),
          notes: "Detailed and inspected before every reservation.",
        },
      }));
  }

  // Live GPS pings (near LA landmarks) so the fleet map + AI "closest to LAX" query have data
  const gpsSpots: { key: string; lat: number; lng: number; label: string }[] = [
    { key: "SX-01", lat: 34.0736, lng: -118.4004, label: "Near Beverly Hills" },
    { key: "SX-02", lat: 34.0522, lng: -118.2437, label: "Stratos Garage — Downtown LA" },
    { key: "SX-03", lat: 33.9825, lng: -118.4695, label: "Near Marina del Rey" },
    { key: "SX-04", lat: 33.9416, lng: -118.4085, label: "Near LAX" },
    { key: "SX-05", lat: 34.1808, lng: -118.309, label: "Near Burbank Airport" },
    { key: "SX-06", lat: 34.0195, lng: -118.4912, label: "Near Santa Monica" },
    { key: "SX-07", lat: 34.0522, lng: -118.2437, label: "Stratos Garage — Downtown LA" },
    { key: "SX-08", lat: 34.0736, lng: -118.4004, label: "Near Beverly Hills" },
    { key: "SX-09", lat: 34.0259, lng: -118.7798, label: "Near Malibu" },
    { key: "SX-10", lat: 34.0522, lng: -118.2437, label: "Stratos Garage — Downtown LA" },
  ];
  for (const g of gpsSpots) {
    await prisma.vehicleGpsPing.create({
      data: { vehicleId: vehicles[g.key].id, lat: g.lat, lng: g.lng, heading: Math.random() * 360, speedMph: Math.random() * 45, label: g.label },
    });
  }

  // Maintenance records
  await prisma.maintenanceRecord.createMany({
    data: [
      { vehicleId: vehicles["SX-01"].id, type: "DETAIL", description: "Full interior/exterior detail before weekend bookings", status: "SCHEDULED", scheduledDate: daysFromNow(2) },
      { vehicleId: vehicles["SX-04"].id, type: "SERVICE", description: "30,000-mile scheduled service", status: "SCHEDULED", scheduledDate: daysFromNow(5) },
      { vehicleId: vehicles["SX-06"].id, type: "TIRE", description: "Rotate & inspect tires", status: "COMPLETED", completedDate: daysAgo(10), cost: 240, vendor: "Beverly Hills Tire Co." },
      { vehicleId: vehicles["SX-08"].id, type: "INSPECTION", description: "Annual CA smog + safety inspection", status: "SCHEDULED", scheduledDate: daysFromNow(14) },
    ],
  });

  // ── Pipeline / Sources / Lost reasons ───────────────────────────────────
  const stages: Record<string, { id: string }> = {};
  for (const s of DEFAULT_PIPELINE_STAGES) {
    stages[s.name] = await prisma.pipelineStage.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, order: s.order, color: s.color, isClosedWon: !!s.isClosedWon, isClosedLost: !!s.isClosedLost },
    });
  }
  const sources: Record<string, { id: string }> = {};
  for (let i = 0; i < DEFAULT_LEAD_SOURCES.length; i++) {
    const name = DEFAULT_LEAD_SOURCES[i];
    sources[name] = await prisma.leadSource.upsert({ where: { name }, update: {}, create: { name, order: i } });
  }
  for (let i = 0; i < DEFAULT_LOST_REASONS.length; i++) {
    const name = DEFAULT_LOST_REASONS[i];
    await prisma.lostReason.upsert({ where: { name }, update: {}, create: { name, order: i } });
  }

  // ── Services & Locations ────────────────────────────────────────────
  const serviceDefs: { name: string; rate: number }[] = [
    { name: "Airport Transfer", rate: 195 },
    { name: "Chauffeured Transportation", rate: 165 },
    { name: "Self-Drive Rental", rate: 850 },
    { name: "Point-to-Point Transportation", rate: 175 },
    { name: "Hourly Service", rate: 195 },
    { name: "Corporate Transportation", rate: 175 },
    { name: "Weddings", rate: 495 },
    { name: "VIP Night Out", rate: 350 },
    { name: "Events", rate: 275 },
    { name: "California Transportation", rate: 225 },
    { name: "Long-Distance Transportation", rate: 650 },
    { name: "Lifestyle / Concierge Services", rate: 300 },
  ];
  for (let i = 0; i < serviceDefs.length; i++) {
    const s = serviceDefs[i];
    await prisma.service.upsert({ where: { name: s.name }, update: {}, create: { name: s.name, baseRate: s.rate, order: i } });
  }
  const locationDefs: { name: string; address: string; type: string }[] = [
    { name: "LAX — Los Angeles International Airport", address: "1 World Way, Los Angeles, CA 90045", type: "AIRPORT" },
    { name: "Burbank Airport (BUR)", address: "2627 N Hollywood Way, Burbank, CA 91505", type: "AIRPORT" },
    { name: "The Peninsula Beverly Hills", address: "9882 S Santa Monica Blvd, Beverly Hills, CA 90212", type: "HOTEL" },
    { name: "Malibu Beach House", address: "Malibu, CA 90265", type: "RESIDENCE" },
    { name: "SoFi Stadium", address: "1001 Stadium Dr, Inglewood, CA 90301", type: "VENUE" },
    { name: "Downtown LA Convention Center", address: "1201 S Figueroa St, Los Angeles, CA 90015", type: "VENUE" },
    { name: "Private Residence — Bel Air", address: "Bel Air, CA 90077", type: "RESIDENCE" },
  ];
  for (const l of locationDefs) {
    const existing = await prisma.location.findFirst({ where: { name: l.name } });
    if (!existing) await prisma.location.create({ data: l });
  }

  // ── Customers ──────────────────────────────────────────────────────────
  const customerDefs = [
    { firstName: "Victor", lastName: "Ashcombe", tier: "VVIP", company: null, owner: sofia },
    { firstName: "Isabella", lastName: "Marchetti", tier: "VVIP", company: null, owner: sofia },
    { firstName: "Grant", lastName: "Whitfield", tier: "VIP", company: null, owner: noah },
    { firstName: "Chloe", lastName: "Nakamura", tier: "VIP", company: null, owner: sofia },
    { firstName: "Marcus", lastName: "Delgado", tier: "VIP", company: null, owner: noah },
    { firstName: "Amara", lastName: "Okafor", tier: "STANDARD", company: null, owner: noah },
    { firstName: "Liam", lastName: "Sorensen", tier: "STANDARD", company: null, owner: sofia },
    { firstName: "Priscilla", lastName: "Huang", tier: "STANDARD", company: null, owner: noah },
    { firstName: "Ethan", lastName: "Brightwater", tier: "STANDARD", company: null, owner: sofia },
    { firstName: "Devon", lastName: "Kessler", tier: "CORPORATE", company: "ABC Executive Group", owner: sofia },
    { firstName: "Renata", lastName: "Silva", tier: "CORPORATE", company: "Meridian Capital Partners", owner: noah },
    { firstName: "Harrison", lastName: "Blackwood", tier: "STANDARD", company: null, owner: noah },
    { firstName: "Yuki", lastName: "Tanaka", tier: "VIP", company: null, owner: sofia },
    { firstName: "Selena", lastName: "Vance", tier: "STANDARD", company: null, owner: noah },
  ];
  const customers: Record<string, { id: string }> = {};
  for (const c of customerDefs) {
    const key = `${c.firstName} ${c.lastName}`;
    const existing = await prisma.customer.findFirst({ where: { firstName: c.firstName, lastName: c.lastName } });
    customers[key] =
      existing ??
      (await prisma.customer.create({
        data: {
          firstName: c.firstName,
          lastName: c.lastName,
          phone: randPhone(),
          email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@example.com`,
          company: c.company,
          city: "Los Angeles",
          state: "CA",
          tier: c.tier,
          preferredContactMethod: pick(["PHONE", "TEXT", "EMAIL"]),
          ownerId: c.owner.id,
          referralSource: pick(DEFAULT_LEAD_SOURCES),
          specialRequests: c.tier === "VVIP" ? "Always stock chilled Dom Pérignon; requires meet & greet sign." : undefined,
        },
      }));
  }

  // ── Leads across the pipeline ───────────────────────────────────────
  type LeadDef = {
    customer: string;
    stage: string;
    source: string;
    service: string;
    pickup: string;
    dropoff: string;
    passengers: number;
    vehicle?: string;
    isVip?: boolean;
    days: number; // days from now for serviceDate
    rawInquiry?: string;
    aiSummary?: string;
  };
  const leadDefs: LeadDef[] = [
    {
      customer: "Amara Okafor",
      stage: "New Lead",
      source: "Website",
      service: "Airport Transfer",
      pickup: "LAX",
      dropoff: "Malibu",
      passengers: 8,
      vehicle: "Mercedes Sprinter",
      days: 3,
      rawInquiry: "Hey I need a Sprinter for 8 people from LAX to Malibu Friday around 7pm.",
      aiSummary: "Airport transfer · Mercedes Sprinter · 8 passengers · LAX → Malibu · Friday 7:00 PM. Awaiting staff pricing & availability confirmation.",
    },
    { customer: "Liam Sorensen", stage: "New Lead", source: "Instagram", service: "VIP Night Out", pickup: "The Peninsula Beverly Hills", dropoff: "Downtown LA", passengers: 4, vehicle: "Rolls-Royce Cullinan", days: 6 },
    { customer: "Priscilla Huang", stage: "Contacted", source: "Google", service: "Hourly Service", pickup: "Beverly Hills", dropoff: "Multiple stops", passengers: 3, days: 5 },
    { customer: "Ethan Brightwater", stage: "Contacted", source: "Referral", service: "Point-to-Point Transportation", pickup: "Bel Air", dropoff: "SoFi Stadium", passengers: 2, days: 8 },
    { customer: "Harrison Blackwood", stage: "Qualified", source: "TikTok", service: "Self-Drive Rental", pickup: "Stratos Garage", dropoff: "—", passengers: 1, vehicle: "Lamborghini Urus", days: 10 },
    { customer: "Selena Vance", stage: "Qualified", source: "Facebook", service: "Events", pickup: "Malibu Beach House", dropoff: "Malibu Beach House", passengers: 6, days: 12 },
    { customer: "Yuki Tanaka", stage: "Quote Sent", source: "Repeat Client", service: "Weddings", pickup: "Private Residence — Bel Air", dropoff: "The Peninsula Beverly Hills", passengers: 4, vehicle: "Rolls-Royce Phantom", isVip: true, days: 21 },
    { customer: "Devon Kessler", stage: "Quote Sent", source: "Corporate Client", service: "Corporate Transportation", pickup: "LAX", dropoff: "Downtown LA Convention Center", passengers: 6, vehicle: "Cadillac Escalade", days: 4 },
    { customer: "Grant Whitfield", stage: "Follow-Up", source: "Phone Call", service: "Long-Distance Transportation", pickup: "Beverly Hills", dropoff: "Napa Valley", passengers: 2, isVip: true, days: 18 },
    { customer: "Chloe Nakamura", stage: "Follow-Up", source: "Text Message", service: "Lifestyle / Concierge Services", pickup: "The Peninsula Beverly Hills", dropoff: "Rodeo Drive", passengers: 1, isVip: true, days: 7 },
    { customer: "Isabella Marchetti", stage: "Deposit Requested", source: "Referral", service: "VIP Night Out", pickup: "Bel Air", dropoff: "West Hollywood", passengers: 5, vehicle: "Rolls-Royce Cullinan", isVip: true, days: 9 },
    { customer: "Marcus Delgado", stage: "Deposit Requested", source: "Website", service: "California Transportation", pickup: "Beverly Hills", dropoff: "Santa Barbara", passengers: 3, isVip: true, days: 15 },
    { customer: "Renata Silva", stage: "Booked", source: "Corporate Client", service: "Corporate Transportation", pickup: "Burbank Airport (BUR)", dropoff: "Downtown LA", passengers: 4, vehicle: "Cadillac Escalade", days: 1 },
  ];

  for (const l of leadDefs) {
    const cust = customers[l.customer];
    const existing = await prisma.lead.findFirst({ where: { customerId: cust.id, serviceRequested: l.service } });
    if (existing) continue;
    await prisma.lead.create({
      data: {
        customerId: cust.id,
        sourceId: sources[l.source]?.id,
        assigneeId: pick([sofia, noah]).id,
        stageId: stages[l.stage].id,
        serviceRequested: l.service,
        pickupLocation: l.pickup,
        dropoffLocation: l.dropoff,
        serviceDate: daysFromNow(l.days),
        pickupTime: pick(["09:00", "11:30", "14:00", "17:00", "19:00"]),
        passengers: l.passengers,
        vehicleRequested: l.vehicle,
        chauffeurRequested: l.service !== "Self-Drive Rental",
        estimatedHours: 3,
        estimatedPrice: 900 + Math.random() * 2500,
        isVip: !!l.isVip,
        score: l.isVip ? 82 + Math.floor(Math.random() * 15) : 30 + Math.floor(Math.random() * 50),
        rawInquiry: l.rawInquiry,
        aiSummary: l.aiSummary,
        lastContactedAt: l.stage === "New Lead" ? null : daysAgo(1),
        nextFollowUpAt: ["New Lead", "Contacted", "Qualified", "Follow-Up"].includes(l.stage) ? daysFromNow(1) : null,
        notes: l.isVip ? "High-value client — white-glove handling required." : undefined,
      },
    });
  }

  // ── Bookings — today's operations timeline (matches dashboard example) ──
  async function createBooking(opts: {
    customer: string;
    vehicleKey: string;
    driverKey?: string;
    service: string;
    pickup: string;
    dropoff: string;
    date: Date;
    pickupTime: string;
    endTime?: string;
    passengers: number;
    bookingStatus: string;
    opsStage: string;
    paymentStatus: string;
    hours?: number;
    flight?: { number: string; airline: string; airport: string; arrival: Date; status: string };
    specialInstructions?: string;
  }) {
    const cust = customers[opts.customer];
    const vehicle = vehicles[opts.vehicleKey];
    const driver = opts.driverKey ? drivers[opts.driverKey] : null;
    const hourly = 250;
    const hours = opts.hours ?? 3;
    const pricing = computePricing({
      baseRate: hourly * hours,
      driverFee: driver ? 45 * hours : 0,
      mileageFee: 80,
      additionalFees: 0,
      discount: 0,
    });
    const depositPaid = opts.paymentStatus !== "PAYMENT_PENDING";
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: nextBookingNumber(),
        customerId: cust.id,
        vehicleId: vehicle.id,
        driverId: driver?.id,
        serviceType: opts.service,
        pickupAddress: opts.pickup,
        dropoffAddress: opts.dropoff,
        date: opts.date,
        pickupTime: opts.pickupTime,
        endTime: opts.endTime,
        passengers: opts.passengers,
        flightNumber: opts.flight?.number,
        flightAirline: opts.flight?.airline,
        flightAirport: opts.flight?.airport,
        flightArrivalTime: opts.flight?.arrival,
        flightStatus: opts.flight?.status,
        specialInstructions: opts.specialInstructions,
        amenities: JSON.stringify(["Bottled Water", "Wi-Fi Hotspot"]),
        baseRate: pricing.baseRate,
        driverFee: pricing.driverFee,
        mileageFee: pricing.mileageFee,
        additionalFees: pricing.additionalFees,
        taxAmount: pricing.taxAmount,
        totalPrice: pricing.totalPrice,
        deposit: depositPaid ? pricing.depositAmount : 0,
        remainingBalance: opts.paymentStatus === "PAID_IN_FULL" ? 0 : pricing.totalPrice - (depositPaid ? pricing.depositAmount : 0),
        paymentStatus: opts.paymentStatus,
        bookingStatus: opts.bookingStatus,
        opsStage: opts.opsStage,
      },
    });
    if (driver) {
      await prisma.trip.create({
        data: {
          bookingId: booking.id,
          status:
            opts.opsStage === "COMPLETED" ? "COMPLETED" : opts.opsStage === "IN_TRANSIT" || opts.opsStage === "PASSENGER_ONBOARD" ? "IN_TRANSIT" : opts.opsStage === "ARRIVED" ? "ARRIVED" : opts.opsStage === "DRIVER_EN_ROUTE" ? "DRIVER_EN_ROUTE" : "SCHEDULED",
        },
      });
    }
    if (depositPaid) {
      await prisma.payment.create({
        data: {
          customerId: cust.id,
          bookingId: booking.id,
          amount: opts.paymentStatus === "PAID_IN_FULL" ? pricing.totalPrice : pricing.depositAmount,
          type: opts.paymentStatus === "PAID_IN_FULL" ? "FULL" : "DEPOSIT",
          method: "CARD",
          status: "SUCCEEDED",
          processedAt: daysAgo(1),
        },
      });
    }
    return booking;
  }

  // Today's operations (exact spec example)
  await createBooking({
    customer: "Victor Ashcombe",
    vehicleKey: "SX-04",
    driverKey: "Marcus",
    service: "Airport Transfer",
    pickup: "LAX",
    dropoff: "Malibu",
    date: todayAt(8),
    pickupTime: "08:00",
    endTime: "09:30",
    passengers: 6,
    bookingStatus: "CONFIRMED",
    opsStage: "DRIVER_ASSIGNED",
    paymentStatus: "DEPOSIT_PAID",
    hours: 2,
    flight: { number: "AA 118", airline: "American Airlines", airport: "LAX", arrival: todayAt(7, 30), status: "LANDED" },
  });
  await createBooking({
    customer: "Devon Kessler",
    vehicleKey: "SX-06",
    driverKey: "Daniel",
    service: "Corporate Transportation",
    pickup: "Burbank Airport (BUR)",
    dropoff: "Downtown LA",
    date: todayAt(11, 30),
    pickupTime: "11:30",
    endTime: "13:00",
    passengers: 4,
    bookingStatus: "EN_ROUTE",
    opsStage: "DRIVER_EN_ROUTE",
    paymentStatus: "PAID_IN_FULL",
    hours: 2,
  });
  await createBooking({
    customer: "Isabella Marchetti",
    vehicleKey: "SX-01",
    driverKey: "Marcus",
    service: "VIP Night Out",
    pickup: "Bel Air",
    dropoff: "West Hollywood",
    date: todayAt(19),
    pickupTime: "19:00",
    endTime: "23:00",
    passengers: 5,
    bookingStatus: "CONFIRMED",
    opsStage: "UPCOMING",
    paymentStatus: "DEPOSIT_PAID",
    hours: 4,
    specialInstructions: "VVIP — champagne service, red carpet, meet & greet sign with party name.",
  });

  // A few more today + this week for realistic volume
  await createBooking({ customer: "Renata Silva", vehicleKey: "SX-07", driverKey: undefined, service: "Corporate Transportation", pickup: "Downtown LA", dropoff: "LAX", date: daysFromNow(1), pickupTime: "06:00", passengers: 3, bookingStatus: "RESERVED", opsStage: "UPCOMING", paymentStatus: "PAYMENT_PENDING" });
  await createBooking({ customer: "Grant Whitfield", vehicleKey: "SX-09", driverKey: undefined, service: "Long-Distance Transportation", pickup: "Beverly Hills", dropoff: "Napa Valley", date: daysFromNow(3), pickupTime: "07:00", passengers: 2, bookingStatus: "CONFIRMED", opsStage: "UPCOMING", paymentStatus: "DEPOSIT_PAID", hours: 6 });
  await createBooking({ customer: "Chloe Nakamura", vehicleKey: "SX-10", driverKey: undefined, service: "Lifestyle / Concierge Services", pickup: "The Peninsula Beverly Hills", dropoff: "Rodeo Drive", date: daysFromNow(2), pickupTime: "15:00", passengers: 1, bookingStatus: "CONFIRMED", opsStage: "UPCOMING", paymentStatus: "DEPOSIT_PAID" });

  // Completed trips this month/last month (revenue & repeat-customer history)
  for (let i = 1; i <= 10; i++) {
    const cust = pick(Object.keys(customers));
    const vkey = pick(Object.keys(vehicles));
    await createBooking({
      customer: cust,
      vehicleKey: vkey,
      driverKey: pick(["Marcus", "Daniel", undefined, undefined]),
      service: pick(serviceDefs.map((s) => s.name)),
      pickup: pick(locationDefs.map((l) => l.name)),
      dropoff: pick(locationDefs.map((l) => l.name)),
      date: daysAgo(2 + i * 2),
      pickupTime: pick(["09:00", "12:00", "16:00", "19:00"]),
      passengers: 1 + Math.floor(Math.random() * 7),
      bookingStatus: "COMPLETED",
      opsStage: "COMPLETED",
      paymentStatus: "PAID_IN_FULL",
      hours: 2 + Math.floor(Math.random() * 4),
    });
  }

  // ── Quotes ─────────────────────────────────────────────────────────────
  const quoteDefs = [
    { customer: "Yuki Tanaka", vehicleKey: "SX-02", service: "Weddings", status: "SENT", hours: 8 },
    { customer: "Devon Kessler", vehicleKey: "SX-06", service: "Corporate Transportation", status: "VIEWED", hours: 3 },
    { customer: "Marcus Delgado", vehicleKey: "SX-08", service: "California Transportation", status: "ACCEPTED", hours: 10 },
    { customer: "Liam Sorensen", vehicleKey: "SX-01", service: "VIP Night Out", status: "DRAFT", hours: 4 },
  ];
  for (const q of quoteDefs) {
    const cust = customers[q.customer];
    const vehicle = vehicles[q.vehicleKey];
    const hourlyRate = vehicleHourlyRates[q.vehicleKey] ?? 300;
    const pricing = computePricing({ baseRate: hourlyRate * q.hours, driverFee: 45 * q.hours, mileageFee: 90 });
    await prisma.quote.create({
      data: {
        quoteNumber: nextQuoteNumber(),
        customerId: cust.id,
        vehicleId: vehicle.id,
        serviceType: q.service,
        hours: q.hours,
        baseRate: pricing.baseRate,
        driverFee: pricing.driverFee,
        mileageFee: pricing.mileageFee,
        taxAmount: pricing.taxAmount,
        subtotal: pricing.subtotal,
        totalPrice: pricing.totalPrice,
        depositAmount: pricing.depositAmount,
        status: q.status,
        validUntil: daysFromNow(14),
        termsText:
          "50% deposit due at booking; remaining balance due 48 hours before service. Cancellations within 72 hours are non-refundable. Gratuity not included.",
        sentAt: q.status !== "DRAFT" ? daysAgo(2) : null,
        createdById: sofia.id,
      },
    });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────
  const taskDefs = [
    { title: "Call Amara Okafor re: Sprinter LAX → Malibu", type: "CALL", priority: "URGENT", due: daysFromNow(0), assignee: sofia },
    { title: "Send quote to Devon Kessler (Corporate Transportation)", type: "SEND_QUOTE", priority: "HIGH", due: daysFromNow(0), assignee: sofia },
    { title: "Collect deposit — Isabella Marchetti VIP Night Out", type: "COLLECT_DEPOSIT", priority: "HIGH", due: daysFromNow(0), assignee: sofia },
    { title: "Assign driver — Renata Silva airport run", type: "ASSIGN_DRIVER", priority: "NORMAL", due: daysFromNow(1), assignee: priya },
    { title: "Confirm flight AA 118 — Victor Ashcombe", type: "CONFIRM_FLIGHT", priority: "NORMAL", due: daysFromNow(0), assignee: priya },
    { title: "Prepare Rolls-Royce Cullinan for tonight's VIP Night Out", type: "PREPARE_VEHICLE", priority: "HIGH", due: daysFromNow(0), assignee: priya },
    { title: "Send reminder — Grant Whitfield Napa trip", type: "SEND_REMINDER", priority: "NORMAL", due: daysFromNow(2), assignee: noah },
    { title: "Collect remaining balance — Chloe Nakamura", type: "COLLECT_BALANCE", priority: "NORMAL", due: daysFromNow(1), assignee: sofia },
    { title: "Request review — completed wedding package", type: "REQUEST_REVIEW", priority: "LOW", due: daysAgo(-1), assignee: noah },
    { title: "Follow up — Priscilla Huang hourly service quote", type: "FOLLOW_UP", priority: "NORMAL", due: daysAgo(1), assignee: noah },
  ];
  for (const t of taskDefs) {
    await prisma.task.create({
      data: { title: t.title, type: t.type, priority: t.priority, dueDate: t.due, assigneeId: t.assignee.id, status: "PENDING" },
    });
  }

  // ── Message templates ───────────────────────────────────────────────
  const templateDefs = [
    { key: "LEAD_CONFIRMATION", name: "New Inquiry Confirmation", channel: "SMS", body: "Thank you for contacting Stratos Exotics & Lifestyle. A concierge specialist will reach out shortly to confirm your reservation details." },
    { key: "QUOTE_SENT", name: "Quote Sent", channel: "EMAIL", subject: "Your Stratos Exotics Quote", body: "Your personalized quote is ready to review. Tap the link to view pricing, trip details, and accept your reservation." },
    { key: "BOOKING_CONFIRMED", name: "Booking Confirmed", channel: "SMS", body: "You're confirmed! Your chauffeur and vehicle details will be sent 24 hours before your reservation. — Stratos Exotics" },
    { key: "DEPOSIT_REQUEST", name: "Deposit Request", channel: "EMAIL", subject: "Secure Your Reservation", body: "To secure your reservation, please submit your deposit using the secure payment link below." },
    { key: "DRIVER_ASSIGNED", name: "Chauffeur Assigned", channel: "SMS", body: "Your chauffeur {{driverName}} has been assigned and will arrive at {{pickupTime}}. Vehicle: {{vehicleName}}." },
    { key: "REMINDER_24H", name: "24-Hour Reminder", channel: "SMS", body: "Reminder: your Stratos Exotics reservation is tomorrow at {{pickupTime}}. Reply here with any changes." },
    { key: "REMINDER_2H", name: "2-Hour Reminder", channel: "SMS", body: "Your chauffeur is preparing for your {{pickupTime}} pickup at {{pickupLocation}}. See you soon!" },
    { key: "THANK_YOU_REVIEW", name: "Thank You + Review Request", channel: "EMAIL", subject: "Thank You From Stratos Exotics", body: "It was a pleasure serving you. We'd love to hear about your experience — leave us a review when you have a moment." },
  ];
  for (const t of templateDefs) {
    await prisma.messageTemplate.upsert({ where: { key: t.key }, update: {}, create: t });
  }

  // ── Automation rules ───────────────────────────────────────────────
  const automationDefs = [
    { name: "Instant new-lead confirmation", trigger: "NEW_LEAD", actions: [{ type: "SEND_MESSAGE", templateKey: "LEAD_CONFIRMATION" }, { type: "CREATE_TASK", taskType: "CALL", title: "Call new lead within 15 minutes" }] },
    { name: "Flag & notify on VIP lead", trigger: "HIGH_VALUE_LEAD", actions: [{ type: "NOTIFY_STAFF", notifyType: "HIGH_VALUE_LEAD" }] },
    { name: "Booking confirmation", trigger: "BOOKING_CONFIRMED", actions: [{ type: "SEND_MESSAGE", templateKey: "BOOKING_CONFIRMED" }] },
    { name: "24-hour reservation reminder", trigger: "REMINDER_24H", actions: [{ type: "SEND_MESSAGE", templateKey: "REMINDER_24H" }] },
    { name: "2-hour reservation reminder", trigger: "REMINDER_2H", actions: [{ type: "SEND_MESSAGE", templateKey: "REMINDER_2H" }] },
    { name: "Post-trip thank-you & review request", trigger: "TRIP_COMPLETED", actions: [{ type: "SEND_MESSAGE", templateKey: "THANK_YOU_REVIEW" }, { type: "CREATE_TASK", taskType: "REQUEST_REVIEW", title: "Follow up on review request" }] },
    { name: "No response — escalate task", trigger: "NO_CONTACT_X_HOURS", conditions: { hours: 4 }, actions: [{ type: "CREATE_TASK", taskType: "FOLLOW_UP", title: "Lead has not been contacted — follow up now" }] },
    { name: "Payment received confirmation", trigger: "PAYMENT_RECEIVED", actions: [{ type: "NOTIFY_STAFF", notifyType: "PAYMENT_RECEIVED" }] },
    { name: "Payment failed alert", trigger: "PAYMENT_FAILED", actions: [{ type: "NOTIFY_STAFF", notifyType: "PAYMENT_FAILED" }] },
    { name: "Maintenance due alert", trigger: "MAINTENANCE_DUE", actions: [{ type: "NOTIFY_STAFF", notifyType: "MAINTENANCE_DUE" }] },
  ];
  for (const a of automationDefs) {
    const existing = await prisma.automationRule.findFirst({ where: { name: a.name } });
    if (!existing) {
      await prisma.automationRule.create({
        data: { name: a.name, triggerEvent: a.trigger, conditions: a.conditions ? JSON.stringify(a.conditions) : null, actions: JSON.stringify(a.actions), active: true },
      });
    }
  }

  // ── Follow-up sequence ─────────────────────────────────────────────
  let sequence = await prisma.followUpSequence.findFirst({ where: { name: "New Inquiry Response" } });
  if (!sequence) {
    sequence = await prisma.followUpSequence.create({
      data: { name: "New Inquiry Response", description: "Default cadence for a brand-new lead until they respond or book.", trigger: "NEW_LEAD", isDefault: true },
    });
    const steps: { offsetMinutes: number; channel: string; title: string; body: string }[] = [
      { offsetMinutes: 0, channel: "SMS", title: "Instant thank-you", body: "Thank you for contacting Stratos Exotics & Lifestyle. A concierge specialist will be in touch shortly." },
      { offsetMinutes: 120, channel: "CALL", title: "First follow-up call", body: "Call if no response within 2 hours." },
      { offsetMinutes: 960, channel: "SMS", title: "Next-morning follow-up", body: "Just checking in — happy to help you lock in your vehicle and chauffeur." },
      { offsetMinutes: 2880, channel: "EMAIL", title: "24-hour follow-up", body: "Following up one more time — let us know if your plans have changed." },
    ];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await prisma.followUpStep.create({ data: { sequenceId: sequence.id, offsetMinutes: s.offsetMinutes, channel: s.channel, title: s.title, messageBody: s.body, order: i } });
    }
  }

  // ── Notifications ──────────────────────────────────────────────────
  const notifDefs = [
    { user: owner, type: "HIGH_VALUE_LEAD", title: "VIP lead: Isabella Marchetti", body: "VIP Night Out request — deposit requested." },
    { user: sofia, type: "NEW_LEAD", title: "New lead from Website", body: "Amara Okafor — Airport Transfer inquiry." },
    { user: priya, type: "FOLLOW_UP_DUE", title: "Follow-up due today", body: "3 leads need a follow-up today." },
    { user: owner, type: "PAYMENT_RECEIVED", title: "Payment received", body: "Deposit received from Victor Ashcombe — $645.00" },
    { user: jordan, type: "MAINTENANCE_DUE", title: "Maintenance scheduled", body: "Rolls-Royce Cullinan detail scheduled in 2 days." },
  ];
  for (const n of notifDefs) {
    await prisma.notification.create({ data: { userId: n.user.id, type: n.type, title: n.title, body: n.body, link: "/dashboard" } });
  }

  // ── Integrations (disabled placeholders) ────────────────────────────
  for (const i of INTEGRATION_PROVIDERS) {
    await prisma.integration.upsert({ where: { provider: i.provider }, update: {}, create: { provider: i.provider, category: i.category, enabled: false } });
  }

  // ── Company settings ─────────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { key: "company" },
    update: {},
    create: {
      key: "company",
      value: JSON.stringify({
        name: "Stratos Exotics & Lifestyle",
        website: "https://www.stratoslux.com",
        phone: "(310) 555-0199",
        email: "concierge@stratoslux.com",
        address: "8500 Sunset Blvd, West Hollywood, CA 90069",
        serviceArea: "Los Angeles & Southern California",
        cancellationPolicy: "Cancellations within 72 hours of service are non-refundable. Deposits are transferable to a future date within 90 days.",
        bookingPolicy: "All reservations require a valid ID and signed rental agreement. A security deposit hold may apply for self-drive rentals.",
        termsAndConditions: "By booking with Stratos Exotics & Lifestyle, the client agrees to our standard rental and chauffeur service terms, available upon request.",
        depositPercent: 30,
        taxRate: 9.75,
      }),
    },
  });

  console.log("✅ Seed complete.");
  console.log("   Owner login: chino.realestatela@gmail.com / Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
