# Portfolio Pulse

Monthly portfolio reporting for BNH. Portfolio Managers file one update per portfolio per month; the Chief of Staff sees every update aggregated in a single view.

**Live:** _add deployed URL_

| Role              | Email              | Password        |
| ----------------- | ------------------ | --------------- |
| Chief of Staff    | `cos@bnh.demo`     | `bnh-demo-2026` |
| Portfolio Manager | `tunde@bnh.demo`   | `bnh-demo-2026` |
| Portfolio Manager | `ngozi@bnh.demo`   | `bnh-demo-2026` |
| Portfolio Manager | `ibrahim@bnh.demo` | `bnh-demo-2026` |

The sign-in page has one-click buttons for these accounts.

## What it does

- **Portfolio Managers** (`/submit`) see only the portfolios they manage and file a monthly update: portfolio, reporting month, cash position (NGN), RAG status and the main execution blocker. Resubmitting for the same portfolio and month amends that update, and the form says so before you submit.
- **The Chief of Staff** (`/dashboard`) sees headline figures for the latest month (aggregate cash, how many portfolios have reported and which are still outstanding, RAG mix, and which portfolios are red), then every submission grouped by month with monthly cash subtotals. Submissions can be filtered by RAG status and month, and red items are listed first.
- **Access is by role.** Each page and server action checks the session role. A PM can't open the dashboard, the CoS can't submit, and a PM can't submit for a portfolio they don't own, even with a hand-crafted request.

## Stack

| Choice                                                | Why                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Next.js 16 (React 19, App Router, Server Actions)** | One deployable unit. Pages read the database directly in Server Components, and the form posts to a typed Server Action, so there's no hand-written REST layer to keep in sync.                                                                                                                                                            |
| **SQLite via libSQL + Drizzle ORM**                   | SQLite fits this data: small and relational. Locally it's a plain `local.db` file; in production it's [Turso](https://turso.tech) (hosted libSQL), because serverless hosts like Vercel have no persistent disk. Same driver and same SQL in both. Drizzle keeps the schema in TypeScript with inferred types and no code-generation step. |
| **Zod**                                               | One validation schema, enforced on the server.                                                                                                                                                                                                                                                                                             |
| **jose + bcryptjs**                                   | A small stateless session: a signed HS256 JWT in an `httpOnly`, `sameSite=lax` cookie, with bcrypt password hashes. Easy to read and audit compared with a full auth framework for two roles.                                                                                                                                              |
| **Tailwind CSS v4**                                   | Design tokens (paper, ink, navy, brass and the RAG colours) are defined once in `globals.css`.                                                                                                                                                                                                                                             |

## Data model

```
users ─────────┐
  id, email*, name, password_hash, role (portfolio_manager | chief_of_staff)
               │ 1
               │
               │ n
portfolios ────┘
  id, name*, manager_id → users
               │ 1
               │
               │ n
monthly_updates
  id, portfolio_id → portfolios, reporting_month ("YYYY-MM"),
  cash_position_kobo (integer), rag_status (green | amber | red),
  execution_blocker, submitted_by_id → users, submitted_at, updated_at
  UNIQUE (portfolio_id, reporting_month)
```

Key decisions:

- **Portfolios are a table, not free text.** Updates reference a portfolio by ID, so a typo can't split one portfolio's history in two, ownership drives authorisation, and the dashboard can list portfolios that _haven't_ reported.
- **One update per portfolio per month**, enforced by a unique index. A resubmission is an upsert, so amending never creates a duplicate.
- **Money is stored as integer kobo.** User input is parsed to kobo with string arithmetic (`parseNairaToKobo`), so no amount passes through a floating-point value.
- **The reporting month is stored as `YYYY-MM`.** It sorts correctly as text, has no time-zone ambiguity, and future months are rejected using Lagos time.

## Running locally

Requires Node 20+.

```bash
npm install
cp .env.example .env        # then set SESSION_SECRET (command is in the file)
npm run db:push             # create tables in local.db
npm run db:seed             # demo users, portfolios and three months of history
npm run dev
```

## Deploying (Vercel + Turso)

```bash
turso db create portfolio-pulse
turso db show portfolio-pulse --url          # -> DATABASE_URL
turso db tokens create portfolio-pulse       # -> DATABASE_AUTH_TOKEN

# Create tables and seed the production DB from your machine
DATABASE_URL=... DATABASE_AUTH_TOKEN=... npm run db:push
DATABASE_URL=... DATABASE_AUTH_TOKEN=... npm run db:seed
```

Import the repo into Vercel and set `DATABASE_URL`, `DATABASE_AUTH_TOKEN` and `SESSION_SECRET` as environment variables.

## Project layout

```
src/
  app/
    login/              sign-in page, login/logout actions
    (app)/layout.tsx    authenticated shell
    (app)/submit/       PM form + server action
    (app)/dashboard/    CoS aggregate view + filters
  components/           Wordmark, RagBadge
  db/                   schema, client, seed
  lib/                  auth (sessions, role guards), validation, formatting
```
