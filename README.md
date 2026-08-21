# Driveline CRM

A complete, modern automotive sales CRM built for a single car-dealership salesperson's daily workflow — capture leads, respond fast, follow up consistently, book appointments, track deals, and never let a customer go cold.

**Works fully offline from external services.** No API keys are required to run, demo, or use every feature in this app. External integrations (AI, SMS, email, calendar, inventory feeds, DMS) are modeled and ready to wire up later, but nothing is required for v1.

## Quick Start

```bash
npm install
npm run db:push    # create the SQLite database from the Prisma schema
npm run db:seed    # populate realistic sample dealership data
npm run dev         # http://localhost:3000
```

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

## Tech Stack

- **Next.js 16** (App Router, Server Components, Server Actions) — one deployable app, no separate API server needed
- **TypeScript** throughout
- **Prisma + SQLite** — file-based database (`prisma/dev.db`), zero external services; swap the datasource for Postgres/MySQL later with no application code changes
- **NextAuth (Auth.js) v5** — credentials login, JWT sessions, bcrypt password hashing
- **Tailwind CSS v4** — custom design system (see `src/app/globals.css`)
- **Recharts** — reporting charts
- **@dnd-kit** — drag-and-drop pipeline Kanban

## Architecture

```
src/
  app/                    Routes (App Router). (app)/ is the authenticated shell;
                           auth pages (login, register, forgot/reset password) live outside it.
  components/              UI, grouped by feature (customers, leads, pipeline, tasks,
                           appointments, vehicles, reports, settings, ai, actions, layout, ui)
  lib/
    actions/                Server Actions — the "backend": every mutation in the app
                           (create lead, log a call, change stage, mark sold, etc.)
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

## Connecting real integrations later

Nothing below is required to use the app. Each is a placeholder row in the `Integration` table (see **Settings → Integrations**) and a seam in the code where a real provider slots in without touching UI:

| Integration | Where it plugs in |
|---|---|
| AI (OpenAI, etc.) | Implement `AssistantProvider` (`src/lib/ai/provider.ts`) and return it from `getActiveProvider()` when configured |
| SMS (Twilio) | Extend `logCommunication`/Quick Actions to send instead of just log |
| Email | Same shape as SMS |
| Google/Outlook Calendar | Sync layer on top of the `Appointment` model |
| Inventory feed / DMS | Batch importer writing into the `Vehicle` / `Customer` models |

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
