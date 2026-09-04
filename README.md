# AutoMax LV — Test-Drive Booking Platform

A complete, mobile-first test-drive appointment booking website for a car salesperson, plus the full CRM/admin dashboard behind it (Driveline CRM). Customers land on a marketing page, book a test drive in a 5-step wizard (vehicle → contact info → buying questions → date/time → confirm), get an instant SMS/email confirmation with automated 24h/2h reminders, and can reschedule or cancel from a link — no login required. Every booking becomes a lead in the CRM automatically.

**Works fully offline from external services.** No API keys are required to run, demo, or use every feature — including SMS and email. Without Twilio/Resend connected, messages are "simulated": logged to the database (status `SIMULATED`) and printed to the server console, so the whole flow is testable end-to-end with zero accounts. Connect real providers whenever you're ready (see **Connecting real integrations** below).

## Quick Start

```bash
npm install
npm run db:push    # create the SQLite database from the Prisma schema
npm run db:seed    # populate realistic sample dealership + inventory data
npm run dev         # http://localhost:3000
```

Copy `.env.example` to `.env` first (already done if you're working from this repo) — it works as-is for local dev with everything in simulated mode.

- **Public booking site:** `http://localhost:3000/` → `/book` → `/manage/[token]`
- **Admin dashboard (leads, appointments, message log, settings):** `http://localhost:3000/login`

Log in with any of the seeded demo accounts (password for all: `Password123!`):

| Role | Email |
|---|---|
| Salesperson | `sam.carter@driveline-motors.com` |
| Salesperson | `taylor.nguyen@driveline-motors.com` |
| Manager | `jordan.blake@driveline-motors.com` |
| Admin | `alex.rivera@driveline-motors.com` |

To reset the database back to its seeded state at any time:

```bash
npm run db:reset
```

Going live as a single real salesperson instead of the demo team? Run `npx tsx scripts/cleanup-and-rename.ts` — it wipes the demo leads/customers, removes the extra demo accounts, and keeps `alex.rivera@driveline-motors.com` as the one real login (rename the account's display name to your own from **Settings → My Profile** afterward, and set your own password from **Settings → Password**).

## The booking site

| Route | What it is |
|---|---|
| `/` | Landing page — headline, "every buyer welcome" section, featured inventory, CTA |
| `/book` | The 5-step booking wizard (vehicle, contact info, buying questions, schedule, confirm) |
| `/manage/[token]` | Reschedule/cancel page, linked from every confirmation SMS/email (no login — the token itself is the capability) |
| `/api/appointments/[token]/ics` | Downloads a calendar invite for one appointment |
| `/privacy` | Privacy & SMS consent terms, linked from the site footer |

Admin controls for the booking site live under **Settings → Booking & Hours**: working days/hours, appointment length, buffer between appointments, daily breaks, holidays/blackout dates, max appointments per day, how far out customers can book, minimum notice required, which salesperson online bookings assign to, and which reminders are on. **Message Log** (left nav) shows every SMS/email actually sent (or simulated) with delivery status.

## Tech Stack

- **Next.js 16** (App Router, Server Components, Server Actions) — one deployable app, no separate API server needed
- **TypeScript** throughout
- **Prisma + SQLite** — file-based database (`prisma/dev.db`), zero external services; swap the datasource for Postgres/MySQL later with no application code changes
- **NextAuth (Auth.js) v5** — credentials login, JWT sessions, bcrypt password hashing
- **Tailwind CSS v4** — custom design system (see `src/app/globals.css`)
- **Recharts** — reporting charts
- **@dnd-kit** — drag-and-drop pipeline Kanban
- **Twilio REST API** (SMS) and **Resend REST API** (email) via plain `fetch` — no SDK dependency, simulated until connected (see below)

## Architecture

```
src/
  app/                    Routes (App Router). (site)/ is the public booking site (no
                           auth); (app)/ is the authenticated CRM/admin shell; auth pages
                           (login, register, forgot/reset password) live outside both.
  components/              UI, grouped by feature (booking, customers, leads, pipeline,
                           tasks, appointments, vehicles, reports, settings, ai, layout, ui)
  lib/
    actions/                Server Actions — the "backend": every mutation in the app
                           (create lead, log a call, change stage, mark sold, book/
                           reschedule/cancel a test drive, etc.). booking.ts and
                           reminders.ts are unauthenticated by design — the public site
                           calls them directly.
    availability.ts         Test-drive slot engine: working hours/breaks/blackout dates
                           → available "HH:mm" slots for a date, double-booking-safe
    sms/, email/            Provider abstractions (Twilio / Resend via plain fetch) —
                           simulated (logged, not sent) until the relevant env vars are set
    messaging/              SMS/email copy (templates.ts) + the single entry point that
                           decides what to send for a given appointment event (notify.ts)
    queries/                Read-side data access, scoped by role (salesperson sees their
                           own book; manager/admin see the whole team)
    automation/engine.ts   The automation engine: event-driven rules (new lead, stage
                           change, appointment lifecycle, etc.) plus a time-based sweep
                           for rules with no discrete trigger (no-contact-X-days,
                           appointment-tomorrow reminders)
    ai/                     AI Sales Assistant. `provider.ts` defines a swappable
                           AssistantProvider interface; `internal-provider.ts` is a
                           rule-based implementation that reads the CRM's own database
                           and needs no API key. Swap in a real LLM later without
                           touching the UI.
    scoring.ts /
    scoring-engine.ts       0–100 lead scoring: pure math in scoring.ts, wired to real
                           signals (contact recency, appointments, test drives, credit
                           app status, trade-in, purchase timeframe, vehicle
                           availability, interaction count) in scoring-engine.ts
    constants.ts            Canonical value lists for every "fixed choice" field
                           (SQLite has no native enum support, so these are the
                           single source of truth, validated at the application layer)
prisma/
  schema.prisma            Full normalized schema (30+ models)
  seed.ts                  Realistic sample dealership data generator
```

### Design philosophy

The dashboard is built to answer one question on login: **"Who do I need to work right now?"** Metrics are action-first (overdue follow-ups, hot leads, today's appointments), and the Today's Action Center surfaces exactly who to call/text/email next with one-click actions everywhere.

### Automation engine

Rules live in the `AutomationRule` table and are fully configurable from **Automations** in the app (toggle on/off, create custom rules, delete). Each rule matches a trigger event and runs one or more actions (create a task, send a notification, enroll a follow-up sequence). Every firing is logged to `AutomationRun` for full transparency.

Two rule categories, handled differently since this is a stateless web app with no background job runner:
- **Event-driven** (new lead, stage change, appointment created/completed/no-show, test drive completed, vehicle sold, lead lost, follow-up completed) fire immediately from the Server Action that caused them.
- **Time-based** (no contact in X days, appointment is tomorrow) have no discrete triggering event — they're swept on demand via "Run Checks Now" on the Automations page. Wire this to a real cron/scheduled job in production (see below).

### Follow-up sequences

Configurable day-by-day cadences (`FollowUpSequence` / `FollowUpStep`). Enrolling a lead pre-creates every step's task at its scheduled offset (day 0, 1, 2, 4, 7, 14, 30, ...) so nothing depends on a background scheduler running exactly on time.

## Running in production

```bash
npm run build
npm start
```

Set a strong `AUTH_SECRET` (`openssl rand -base64 32`) and a correct `NEXTAUTH_URL` in your environment. `trustHost: true` is set in `src/lib/auth.ts` for single-server self-hosted deployments — if you deploy behind a load balancer/reverse proxy, keep this and ensure `X-Forwarded-Host` is set correctly by your proxy.

For the automation engine's time-based sweep to run without a human clicking "Run Checks Now," call `runTimeBasedAutomationChecks()` (`src/lib/automation/engine.ts`) from a scheduled job (cron, a serverless scheduled function, etc.) — e.g. hourly.

## Live inventory sync (automaxlv.com)

Vehicle inventory in this CRM is meant to be pulled live from **automaxlv.com** rather than entered by hand — it's the single source of truth for what customers can book a test drive for. This reuses the existing `Vehicle` table (a few sync-tracking columns added: `source`, `sourceUrl`, `externalId`, `lastSyncedAt`, `syncStatus`, plus `engine`/`transmission`/`features`) rather than a separate inventory system.

| Piece | Where |
|---|---|
| Fetch + parse automaxlv.com | `src/lib/inventory/automaxlv.ts` |
| Sync orchestration (dedupe by VIN → stock # → site id, create/update/retire, error handling) | `src/lib/inventory/sync.ts` |
| Live "is this vehicle still listed" check, called right before a booking is confirmed | `verifyVehicleStillListed()` in `sync.ts`, wired into `submitBooking()` |
| Admin UI — status, manual "Sync Now", flagged listings, run history | Settings → Inventory Sync (`/settings/inventory-sync`) |
| Scheduled background sync | `GET /api/cron/inventory-sync` (same `CRON_SECRET`/pattern as the reminder cron) |

**Status: built and unit-tested against mocked site data, but never run against the real site** — automaxlv.com was unreachable from the sandbox this was built in (network policy), so `automaxlv.ts`'s parser is written against the general, well-documented `schema.org/Vehicle` JSON-LD pattern most dealer-site platforms embed for SEO/Google Vehicle Listings, not against automaxlv.com's actual markup. The dedupe/update/retire/error-handling logic in `sync.ts` is verified (mocked-fetch test covering create, update, retire-on-removal, flag-on-unparseable, total-failure-leaves-inventory-untouched, and the live pre-booking check).

**First real run needs a human to check the result:** go to Settings → Inventory Sync and click **Sync Now**.
- Vehicles show up correctly → done, schedule the cron and you're live.
- Zero vehicles / a failed run → open `automaxlv.com/inventory/` in a browser, view source on a listing and a vehicle detail page, and adjust `automaxlv.ts` to match (it's written specifically so this is a contained fix, not a rewrite). If AutoMax's website platform vendor offers a proper inventory data feed instead of scraping HTML, that's the more robust option — swap it in without touching anything else.

Once it's working, point a scheduler (same options as the reminder cron — Vercel Cron, cron-job.org, etc.) at `/api/cron/inventory-sync` every 1-4 hours for background sync; that also satisfies "at least once daily".

## Connecting real integrations later

Nothing below is required to use the app — everything works today with SMS/email simulated (logged, not sent). Each is a placeholder row in the `Integration` table (see **Settings → Integrations**, which shows live "Connected"/"Simulated" status) and a seam in the code where a real provider slots in without touching UI:

| Integration | Where it plugs in | Setup |
|---|---|---|
| **SMS (Twilio)** — booking confirmations & 24h/2h test-drive reminders | `src/lib/sms/provider.ts` — sends via Twilio's REST API (plain `fetch`, no SDK) | Create a Twilio account, buy/verify a phone number, set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER`. For real US SMS volume you'll also want an [A2P 10DLC campaign](https://www.twilio.com/en-us/a2p) registered — required by carriers. |
| **Email (Resend)** — same events as SMS | `src/lib/email/provider.ts` — sends via Resend's REST API | Create a Resend account, verify a sending domain, set `RESEND_API_KEY` / `RESEND_FROM_EMAIL`. |
| **Reminder scheduler** — fires the 24h/2h sweep automatically | `src/app/api/cron/reminders/route.ts` (`GET`, header `x-cron-secret: $CRON_SECRET`) calling `sendPendingReminders()` (`src/lib/actions/reminders.ts`) | Point any external scheduler at it every ~15 min — [Vercel Cron](https://vercel.com/docs/cron-jobs), [cron-job.org](https://cron-job.org), or a scheduled GitHub Action. Until this is wired up, use **Run Reminder Checks Now** on Settings → Booking & Hours to fire it manually. |
| AI (OpenAI, etc.) | Implement `AssistantProvider` (`src/lib/ai/provider.ts`) and return it from `getActiveProvider()` when configured |
| Google/Outlook Calendar | Sync layer on top of the `Appointment` model |
| Inventory feed / DMS | Batch importer writing into the `Vehicle` / `Customer` models |

Reminders are idempotent and safe to run as often as you like — each is only ever sent once per appointment, tracked by the presence of a matching `SmsMessage`/`EmailMessage` row (visible on the **Message Log** page).

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


<!-- deploy verification commit -->
