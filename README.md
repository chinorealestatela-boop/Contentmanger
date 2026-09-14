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

### TikTok AI Assistant

A confidence-gated messaging assistant for TikTok DMs, under **TikTok AI** in the sidebar (`/tiktok`). Its guiding rule: **no response beats a wrong response** — every inbound message is understood, classified, and scored for confidence before the AI is even allowed to attempt a reply, and it never states a price, payment, credit, or policy fact it can't verify against the CRM's own Vehicle data or the Training Center.

Architecture (`src/lib/tiktok/`), each piece independently testable and swappable:

| Module | Responsibility |
|---|---|
| `normalize.ts` / `entities.ts` | Expand slang/shorthand, extract dollar amounts, vehicle mentions, vague referents, hard triggers (anger, legal threats, "let me talk to a human") |
| `intent-engine.ts` | Classifies into the intent taxonomy (`TIKTOK_INTENTS` in `src/lib/constants.ts`) — rule-based today, swappable for an LLM later |
| `understanding-engine.ts` | Builds a plain-English paraphrase of what the AI thinks the customer means, and what's missing to answer confidently |
| `confidence-engine.ts` | 0-100 score; capped (never boosted) by ambiguity — a well-matched pattern on an unresolved "how much for it" still can't clear the auto-send bar |
| `knowledge-base.ts` | The only source of truth the AI is allowed to state facts from — real inventory (`Vehicle` table) and Training Center entries, never invented |
| `voice-engine.ts` | "Chino Voice" style guidance from Training Center voice examples/preferred phrases/do-not-say list |
| `response-generator.ts` | Produces an answer, a clarifying question, an escalation, or silence — never a guess |
| `safety-guard.ts` | Blocks any draft with an unverified dollar amount/percentage/approval claim, or a banned phrase, before it can be sent |
| `pipeline.ts` | Orchestrates all of the above per spec's "accuracy over speed" hierarchy |
| `connector.ts` | Swappable messaging provider — see below |

The Inbox, conversation threads, Human Review queue, Training Center, and Settings are all under `/tiktok`. Draft/Auto/Off modes are configurable globally and per-conversation.

**TikTok integration.** TikTok does not offer a public API for reading/sending a creator's own DMs — only approved TikTok Business Messaging partners get one, via an application through TikTok for Developers. This app does not scrape TikTok or automate the consumer app to work around that. Until real API access is granted:

- Inbound messages are logged manually from the Inbox ("Log a TikTok DM") or a conversation ("Log another message").
- AI replies that clear the confidence bar are marked "ready to send" for the salesperson to copy into TikTok by hand.

`src/lib/tiktok/connector.ts` (outbound) and `src/app/api/tiktok/webhook/route.ts` (inbound) are the two seams a real TikTok Business Messaging integration plugs into later — same pattern as the AI Sales Assistant's `AssistantProvider` seam — with no changes needed to the pipeline, database, or UI. The same architecture is designed to support Instagram, Messenger, SMS, or website chat as additional connectors down the line.

Run `npx tsx scripts/tiktok-ai-eval.ts` to see the rule-based engine's classification/confidence/escalation decisions against 100+ realistic slang/typo/ambiguous examples.

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
| TikTok Business Messaging API | Implement `MessagingConnector` (`src/lib/tiktok/connector.ts`) for outbound, POST to `src/app/api/tiktok/webhook/route.ts` for inbound — see "TikTok AI Assistant" above |

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
