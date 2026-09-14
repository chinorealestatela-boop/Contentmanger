# Stratos Exotics & Lifestyle — Operations Platform

The operating system for Stratos Exotics & Lifestyle: a complete CRM and operations platform for a luxury/exotic vehicle rental and chauffeured transportation company serving Los Angeles & Southern California. Lead → conversation → quote → deposit → booking → driver assignment → live trip → completion → payment → review → repeat client, with as little manual work as possible.

**Works fully offline from external services.** No API keys are required to run, demo, or use every feature in this app. External integrations (AI, SMS, email, payments, GPS/telematics, flight tracking, calendar) are modeled and ready to wire up later, but nothing is required to use the CRM day-to-day.

## Quick Start

```bash
npm install
npm run db:push    # create the SQLite database from the Prisma schema
npm run db:seed    # populate realistic sample fleet/client/booking data
npm run dev         # http://localhost:3000
```

Log in with any of the seeded demo accounts (password for all: `Password123!`):

| Role | Email |
|---|---|
| Owner | `chino.realestatela@gmail.com` |
| Admin | `alexandra.reyes@stratoslux.com` |
| Manager | `jordan.vance@stratoslux.com` |
| Dispatcher | `priya.anand@stratoslux.com` |
| Concierge / Sales | `sofia.lindqvist@stratoslux.com` |
| Chauffeur | `marcus.bell@stratoslux.com` (lands on the mobile driver console at `/driver`) |

To reset the database back to its seeded state at any time:

```bash
npm run db:reset
```

## Tech Stack

- **Next.js 16** (App Router, Server Components, Server Actions) — one deployable app, no separate API server needed
- **TypeScript** throughout
- **Prisma + SQLite** — file-based database (`prisma/dev.db`), zero external services; swap the datasource for Postgres/MySQL later with no application code changes (see `scripts/generate-postgres-schema.mjs`, used automatically on Vercel builds)
- **NextAuth (Auth.js) v5** — credentials login, JWT sessions, bcrypt password hashing
- **Tailwind CSS v4** — a custom glassmorphic luxury design system (see `src/app/globals.css`)
- **Recharts** — analytics charts
- **@dnd-kit** — drag-and-drop lead pipeline and Operations Board

## Design language

Glassmorphism over a deep charcoal/black base, a single restrained champagne-gold accent, thin translucent borders, soft blur, and a serif display face (Cormorant Garamond) for headings against a clean sans for UI text — built to feel like a private-aviation concierge system, not a generic SaaS admin panel.

## Architecture

```
src/
  app/                    Routes (App Router). (app)/ is the authenticated shell;
                           auth pages (login, register, forgot/reset password) live outside it.
                           /driver is the mobile-first chauffeur console.
  components/              UI, grouped by feature (leads, pipeline, customers, bookings,
                           quotes, vehicles, drivers, driver, operations, map, calendar,
                           payments, templates, sequences, automations, reports, settings,
                           ai, actions, layout, ui)
  lib/
    actions/                Server Actions — the "backend": every mutation in the app
                           (create lead, send quote, assign driver, run a trip through
                           its lifecycle, record a payment, etc.)
    queries/                Read-side data access, scoped by role (concierge/sales see
                           their own book; manager/admin/owner see the whole company)
    automation/engine.ts   The automation engine: event-driven rules (new lead, VIP
                           flag, quote sent, booking confirmed, reminders, payments,
                           maintenance due) plus a time-based sweep for rules with no
                           discrete trigger (no-contact-X-hours, 24h/2h reservation
                           reminders, maintenance due soon)
    integrations/           The seams where real providers plug in later:
                           messaging.ts (Twilio/SendGrid/Resend), payments.ts (Stripe),
                           gps.ts (telematics), flights.ts (flight tracking). Every one
                           of these is fully functional today without a real provider —
                           see "Connecting real integrations" below.
    ai/                     provider.ts defines a swappable AssistantProvider interface;
                           internal-provider.ts is a rule-based AI Executive Assistant
                           that reads the CRM's own database and needs no API key.
                           lead-extraction.ts is the rule-based "AI Lead Assistant" that
                           parses a raw inquiry into structured trip fields.
    scoring.ts /
    scoring-engine.ts       0–100 lead priority score: pure math in scoring.ts, wired to
                           real signals (recency of contact, trip urgency, estimated
                           value, client tier, vehicle tier, quote sent) in
                           scoring-engine.ts. Crossing the VIP threshold auto-flags the
                           lead and fires the HIGH_VALUE_LEAD automation.
    pricing.ts               Shared pricing math (base rate, chauffeur fee, mileage,
                           fees, discount, tax, deposit) used by both the Quote Builder
                           and the Booking form so numbers always agree.
    constants.ts             Canonical value lists for every "fixed choice" field
                           (SQLite has no native enum support, so these are the
                           single source of truth, validated at the application layer)
prisma/
  schema.prisma            Full normalized schema (Users/Roles, Customers, Leads,
                           Vehicles + Maintenance + GPS pings, Drivers, Services,
                           Locations, Quotes, Bookings, Trips, Payments, Tasks,
                           Communications, Notes, Documents, FollowUp sequences,
                           AutomationRule/Run, MessageTemplate, Notification, Setting,
                           Integration — 30+ models)
  seed.ts                  Realistic sample data generator for a luxury fleet
```

### Design philosophy

The dashboard answers "what's happening with Stratos today" the moment the owner logs in: today's operations timeline (every reservation moving through the fleet, in order), VIP/high-value leads, revenue today/week/month, fleet and driver availability, and outstanding payments — all one screen, one click deep to act.

### Automation engine

Rules live in the `AutomationRule` table and are fully configurable from **Automations** (toggle on/off, create custom rules, delete). Each rule matches a trigger event and runs one or more actions (create a task, send a templated message, notify staff, enroll a follow-up sequence). Every firing is logged to `AutomationRun` for full transparency.

Two rule categories, handled differently since this is a stateless web app with no background job runner:
- **Event-driven** (new lead, VIP flag, stage change, quote sent, booking confirmed, trip completed, payment received/failed) fire immediately from the Server Action that caused them.
- **Time-based** (no contact in X hours, 24h/2h reservation reminders, maintenance due soon) have no discrete triggering event — they're swept on demand via "Run Checks Now" on the Automations page. Wire this to a real cron/scheduled job in production (see below).

### Follow-up sequences

Configurable cadences (`FollowUpSequence` / `FollowUpStep`), each step an SMS, email, call task, or generic task at a minute offset from enrollment (0, 120, 960, 2880, …). A new lead is enrolled automatically; the sequence stops the moment the lead responds (an inbound communication is logged) or books (see `stopFollowUpsForLead` in `src/lib/automation/engine.ts`).

### AI Lead Assistant & AI Executive Assistant

Two distinct AI surfaces, both rule-based and API-key-free by default:

- **AI Lead Assistant** (`src/lib/ai/lead-extraction.ts`) — parses a raw inquiry ("Hey I need a Sprinter for 8 people from LAX to Malibu Friday around 7pm") into service type, vehicle, passenger count, pickup/dropoff, date/time, and self-drive vs. chauffeured, flagging what's still missing. Runs automatically when a lead carries a raw inquiry, and re-runnable from the lead detail page's "Parse With AI" button.
- **AI Executive Assistant** (`src/lib/ai/internal-provider.ts`, exposed at `/assistant` and the slide-over panel everywhere) — answers natural-language questions by querying the CRM's own database directly: uncontacted leads today, vehicle availability, revenue by vehicle, who needs a follow-up, tomorrow's schedule, unpaid balances, closest vehicle to a landmark, and drafts messages.

## Running in production

```bash
npm run build
npm start
```

Set a strong `AUTH_SECRET` (`openssl rand -base64 32`) and a correct `NEXTAUTH_URL` in your environment. `trustHost: true` is set in `src/lib/auth.ts` for single-server self-hosted deployments — if you deploy behind a load balancer/reverse proxy, keep this and ensure `X-Forwarded-Host` is set correctly by your proxy.

For the automation engine's time-based sweep to run without a human clicking "Run Checks Now," call `runTimeBasedAutomationChecks()` (`src/lib/automation/engine.ts`) from a scheduled job (cron, a serverless scheduled function, etc.) — e.g. hourly.

## Connecting real integrations later

Nothing below is required to use the app. Each is a placeholder row in the `Integration` table (see **Settings → Integrations**) and a seam in the code where a real provider slots in without touching UI:

| Integration | Where it plugs in |
|---|---|
| SMS (Twilio) | `src/lib/integrations/messaging.ts` — every automated send already logs a real Communication; connect Twilio to actually deliver it |
| Email (SendGrid / Resend) | Same file, same seam |
| Payments (Stripe) | `src/lib/integrations/payments.ts` — deposit/balance/refund flow works end-to-end today with internal payment links; connect Stripe to process real cards |
| GPS / Telematics | `src/lib/integrations/gps.ts` — the Live Map reads `VehicleGpsPing`; point a real provider's webhook/poller at `recordGpsPing()` |
| Flight Tracking | `src/lib/integrations/flights.ts` — staff-entered flight status today; connect an API to auto-update and notify the assigned chauffeur |
| Google Calendar | Sync layer on top of the `Booking` model |
| AI (OpenAI, Anthropic, etc.) | Implement `AssistantProvider` (`src/lib/ai/provider.ts`) and return it from `getActiveProvider()` when configured |

## Website lead integration

`POST /api/leads/inbound` is the public webhook the Stratos Exotics marketing site (or any "Reserve Now" form) posts to — it creates the client and lead, runs the AI extraction on any free-text notes, and fires the same `NEW_LEAD` automation as an in-app entry. See `src/app/api/leads/inbound/route.ts`. Set `WEBSITE_LEAD_WEBHOOK_SECRET` in production and have the website send it back as `x-webhook-secret`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:push` | Sync the Prisma schema to the SQLite database |
| `npm run db:seed` | Populate sample data |
| `npm run db:reset` | Wipe and reseed the database |
| `npm run db:studio` | Open Prisma Studio to browse the database |
| `npm run lint` | ESLint |
