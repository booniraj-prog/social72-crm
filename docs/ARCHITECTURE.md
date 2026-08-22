# Social72 CRM — Architecture and implementation plan

Status: **awaiting approval**. No application runtime code until Phase 1 is approved.

## 1. Spec analysis (what this system actually is)

Social72 is **one operating company**, not a self-serve multi-tenant SaaS. Clients (schools, developers) are **customers of Social72**. Users are Social72 staff (plus a future client portal).

The CRM is a **lead operations system**: marketing generates volume; BPO converts it. The product succeeds if:

- Every lead has an owner, status, temperature, last activity, and next action.
- Executives can work a lead in under two minutes from a calling workspace.
- Management can see funnel leakage, overdue follow-ups, CPL/ROI, and BPO ranking without Excel.

Two industry verticals share a **core lead** and differ by **extension tables + configurable pipelines**. New industries add a pipeline config and a details table, not a fork of the app.

## 2. Recommended technology stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | One language across UI, API, jobs, types for lead/campaign models |
| App | Next.js 15 App Router | Server-first CRM screens, Route Handlers for REST, fast Phase 1 |
| UI | React 19, Tailwind CSS, shadcn/ui | SaaS density, accessible tables/dialogs, mobile-responsive |
| Data tables | TanStack Table | Filters, saved views, bulk assign |
| Server state | TanStack Query | Lists, dashboards, calling workspace freshness |
| Validation | Zod | Shared request/form/import schemas |
| Database | PostgreSQL 16 | Relational CRM, constraints, indexes, JSONB for UTMs/settings |
| ORM | Prisma | Migrations, typed queries, transactions for merge/import |
| Auth | Better Auth | Email/password + sessions, RBAC-ready, no vendor lock-in |
| Jobs | Redis + BullMQ | SLA timers, notifications, inactivity (Phase 9); Redis present from Phase 1 |
| Charts | Recharts | Dashboard/report charts; PDF later via server render |
| Import/export | ExcelJS, papaparse, PDF via `@react-pdf/renderer` | CSV/XLSX/PDF as specified |
| Logging | pino | Structured logs, request IDs |
| Local runtime | Docker Compose (Postgres + Redis) | Repeatable dev/prod-like data layer |
| Hosting (Phase 10) | Node host + managed Postgres + Redis (e.g. Railway, Render, or VPS) | Decide at production; app stays 12-factor |

**Not chosen now:** NestJS split (extra ops for a single product team), MongoDB (weak for funnel/ROI joins), Clerk (cost/lock-in), GraphQL (REST matches spec modules).

**Telephony, Meta Lead Ads, WhatsApp, SMS:** integration ports only (webhooks, `call_logs.provider_*` columns). No vendor SDKs in Phase 1.

## 3. System architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (desktop-first, responsive)                        │
│  App Router pages + calling workspace                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS, cookie session
┌───────────────────────────▼─────────────────────────────────┐
│  Next.js                                                    │
│  • RSC pages (RBAC-gated layouts)                           │
│  • REST Route Handlers /api/*                               │
│  • Domain modules (leads, campaigns, calling, reports)      │
│  • Scope layer: every query filtered by user permissions    │
└──────┬────────────────┬────────────────┬────────────────────┘
       │                │                │
       ▼                ▼                ▼
 PostgreSQL         Redis            Object files
 (system of         (sessions        (imports, exports,
  record)            cache, jobs)     PDFs — local disk
                                      now, S3 later)
       │
       ▼
 BullMQ workers (same repo, separate process from Phase 9)
```

**Isolation model:** application-level tenant filter on `client_id` (and assignment/team), not Postgres RLS in Phase 1. Super Admin bypasses filters. Executives never receive unscoped list queries.

**Integration-ready ports:** inbound webhook endpoint, outbound job queue, `external_id` / `provider` columns on leads, calls, campaigns.

## 4. Database architecture

See `database-schema.sql` for DDL.

### Tenancy

- **No `organizations` table in v1.** Social72 is the only operator.
- `clients` are the isolation boundary for marketing/BPO data.
- Duplicate detection is **per client** on mobile (primary) and email (secondary). The same person may exist under two Social72 clients.

### Industry extensibility

- `industries` + `pipelines` + `pipeline_stages` (configurable, not hardcoded).
- `leads` is industry-agnostic.
- `education_details` and `real_estate_details` are 1:1 optional extensions.
- `projects` / `properties` support real estate inventory without stuffing JSON into leads.

### Configurable workflow

- `lead_statuses` (name, color, is_final, is_active).
- `status_transitions` (allowed next statuses).
- Seed default statuses from the spec; admins can edit later.
- Kanban columns map to pipeline stages, which reference statuses.

### Timeline vs audit

- `activities` = human-readable lead timeline (created, assigned, call, status, visit).
- `audit_logs` = security/compliance (who, old/new JSON, action, entity).
- Call-specific data lives in `call_logs`; a row in `activities` points at it.

### Money and marketing

- Amounts: `NUMERIC(14,2)`, currency `INR` in settings (not per-row in v1).
- `campaigns` store budget/spend and cached counters; live KPIs computed from leads + `marketing_spend` lines.
- Expected revenue = expected_value × probability / 100 (stored and recomputed on change).

## 5. Folder structure (after Phase 1 scaffold)

```
Digital Marketing CRM/
  docs/
    SPEC.md
    ARCHITECTURE.md
    database-schema.sql
  prisma/
    schema.prisma
    seed.ts
  docker-compose.yml
  src/
    app/
      (auth)/login/page.tsx
      (app)/
        layout.tsx                 # nav: Dashboard, Leads, Calling, …
        dashboard/page.tsx
        leads/page.tsx
        leads/[id]/page.tsx
        calling/page.tsx
        follow-ups/page.tsx
        campaigns/page.tsx
        clients/page.tsx
        reports/page.tsx
        bpo/page.tsx
        education/page.tsx
        real-estate/page.tsx
        users/page.tsx
        settings/page.tsx
      api/
        auth/[...all]/route.ts
        users/route.ts
        clients/route.ts
        campaigns/route.ts
        leads/route.ts
        leads/[id]/route.ts
        dashboard/route.ts
        …
    modules/
      auth/                        # session, permissions
      users/
      clients/
      campaigns/
      leads/
      calling/
      followups/
      education/
      real-estate/
      dashboard/
      reports/
      imports/
      notifications/
      scoring/
      sla/
    lib/
      db.ts
      rbac.ts
      scope.ts                     # Prisma where-clauses from session
      validation.ts
      logger.ts
    components/
      ui/                          # shadcn
      layout/
      leads/
      charts/
    types/
  workers/                         # BullMQ (Phase 9)
```

Domain code lives in `src/modules/*`, not in Route Handlers. Handlers validate, authorize, call the module.

## 6. API architecture

REST, JSON, versionless `/api` until a breaking change requires `/api/v2`.

| Prefix | Responsibility |
| --- | --- |
| `POST /api/auth/*` | Better Auth (login, logout, session) |
| `/api/users` | CRUD users, roles, teams (admin/manager) |
| `/api/clients` | Client CRUD |
| `/api/campaigns` | Campaigns, spend, performance rollup |
| `/api/leads` | List (paginated, filtered), create, import preview |
| `/api/leads/:id` | Get/update, assign, status, temperature |
| `/api/leads/:id/activities` | Timeline |
| `/api/leads/:id/calls` | Call logs + dispositions |
| `/api/leads/:id/followups` | Follow-ups |
| `/api/leads/:id/notes` | Notes |
| `/api/leads/:id/tasks` | Tasks |
| `/api/search` | Global search |
| `/api/dashboard` | KPI + chart payloads (filter querystring) |
| `/api/bpo` | Executive leaderboard |
| `/api/reports/:type` | Report JSON; `?format=xlsx\|csv\|pdf` |
| `/api/import` | Upload, map, validate, commit |
| `/api/export` | Generic export jobs |
| `/api/settings` | Statuses, dispositions, scoring, SLA (admin) |

**Conventions**

- Pagination: `cursor` or `page` + `pageSize` (default 50, max 200).
- Errors: `{ error: { code, message, details? } }` with 4xx/5xx.
- Mutations in transactions; merge/import never partial-commit silently (import may commit valid rows and return rejected set — as specified).
- All list endpoints apply `scope.ts` before query.

## 7. Frontend architecture

- **Layouts:** `(auth)` vs `(app)` with role-based nav (hide routes the role cannot use; still enforce on server).
- **Calling workspace:** single page, lead context panel, no full navigation for core actions (status, disposition, note, follow-up).
- **Lead detail:** three columns — identity/qualification | timeline | actions.
- **Lists:** URL search params as source of truth for filters (shareable + saved filters stored per user).
- **Charts:** fetch aggregated series from `/api/dashboard`, never aggregate large lead dumps in the browser.
- **Forms:** Zod + React Hook Form.
- **Density:** desktop tables first; stacked cards on small screens.

## 8. Authentication and authorization

**Authentication**

- Email + password, httpOnly secure cookies, SameSite=Lax, CSRF via origin check (Better Auth).
- Passwords hashed by the auth library (scrypt/argon2 — do not roll custom).
- Session in DB (or signed cookie + server session table) so Super Admin can revoke.
- Idle timeout configurable in settings (default 8 hours for BPO floor PCs).

**Authorization (RBAC)**

Permissions are fine-grained (`lead.read`, `lead.assign`, `report.export`, …). Roles are bundles. Users have one primary role in v1 (simpler than many-to-many until needed).

| Role | Scope rule |
| --- | --- |
| Super Admin | Unscoped |
| CRM Manager | `campaign_id IN managed_campaigns` OR all clients if flagged |
| Team Leader | `assigned_user_id IN team_member_ids` OR unassigned in team queues |
| BPO Executive | `assigned_user_id = self` |
| Marketing Manager | Campaigns they own/create; leads of those campaigns (read); import |
| Client (future) | `client_id = self.client_id`, reports only |

**Never** send another client’s lead over the wire. Tests will include negative cases (executive fetching `/api/leads/:otherId` → 404, not 403, to avoid enumeration).

## 9. Development roadmap

| Phase | Scope | Outcome |
| --- | --- | --- |
| **1** | Foundation: Docker Postgres/Redis, Prisma schema (core tables), Better Auth, users/roles, clients, app shell nav | Login, create users, CRUD clients |
| **2** | Lead CRUD, assign, status, temperature, search, filters, lead detail | Core CRM record |
| **3** | Calling workspace, call logs, dispositions, notes, follow-ups, timeline | BPO can work a lead |
| **4** | Education fields, campus visits, admission-oriented pipeline seed | Education vertical |
| **5** | Real estate fields, projects/properties, site visits, booking/registration | RE vertical |
| **6** | Campaigns, sources, UTM, spend, campaign KPIs | Marketing loop |
| **7** | Dashboard KPIs, funnel, charts, BPO + campaign dashboards | 60-second management view |
| **8** | Reports module, Excel/CSV/PDF, client-facing report | Shareable reporting |
| **9** | SLA, notifications, scoring engine, inactivity, escalations | No neglected leads |
| **10** | Tests, hardening, backups, deploy | Production |

Phase 1 **does not** include calling, dashboards, or vertical fields beyond schema stubs if they are in the same Prisma file (tables may exist unused).

## 10. Dependencies (Phase 1 vs later)

**Phase 1:** Next.js, React, Tailwind, shadcn, Prisma, PostgreSQL, Better Auth, Zod, pino, Docker.

**Later:** TanStack Table/Query, Recharts, ExcelJS, papaparse, react-pdf, BullMQ, ioredis, date-fns-tz.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Spec is 10 phases; building everything at once will stall | Strict phase gates; schema designed once, features incrementally |
| Dirty marketing CSVs | Import preview, validation, duplicate detect before commit |
| Dashboard queries at volume | Indexes on list/filter columns; pre-aggregate later if needed |
| Configurable workflows vs hardcoded UI | Seed defaults; UI reads statuses from API |
| Click-to-call without a PBX | `tel:` + manual duration in v1; provider columns ready |
| Duplicate merge losing history | Merge copies activities/calls onto survivor in a transaction |
| Executive data leakage | Central `scope.ts`; 404 on unauthorized IDs; tests |

## 12. Assumptions (non-blocking)

1. Single Social72 operator; no agency-of-agencies tenancy in v1.
2. UI language English; currency INR; timezone `Asia/Kolkata`.
3. Phone numbers stored E.164; India `+91` default in the importer.
4. Duplicates scoped per `client_id` on mobile (unique) and email (non-unique index).
5. One primary role per user in v1.
6. Client portal role is schema-ready, UI later.
7. No live telephony, Meta, or WhatsApp until after Phase 10 unless requested.
8. Soft-delete leads (`deleted_at`); audit retains history.
9. Windows + PowerShell is the primary dev environment.

## 13. Essential question

**Approve this stack, isolation model, and Phase 1 scope** (auth, users, roles, clients, navigation, Prisma schema). After approval, implementation starts with Phase 1 only.
