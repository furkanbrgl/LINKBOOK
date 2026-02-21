# Linkbook v1 — As-built project structure (pilot-ready)

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Supabase (Postgres/Auth/RLS/RPC) + Luxon + Zod + Tailwind v4 + shadcn/ui + Radix UI

**Infra:** Vercel (app + API + cron) + Upstash Redis (rate limiting via `@upstash/ratelimit`)

**Messaging:** `notification_outbox` table + cron worker + DEV email provider (Postmark/Resend optional via `EMAIL_PROVIDER` env)

---

## 1) High-level capabilities (what works end-to-end)

### Customer

* **Public booking page:** `/[shopSlug]` — SSR shell loads shop/services/staff; `BookingWizard` handles slot selection and submission
* **Availability lookup:** `GET /api/availability?shop=&staffId=&serviceId=&date=` — RPC-based, timezone-correct (uses `rpc_get_availability`)
* **Create booking:** `POST /api/bookings`
  * Customer upsert by `(shop_id, phone_e164)`
  * Booking insert with no-double-book exclusion constraint
  * Manage token created (hash stored in `manage_tokens`)
  * Outbox enqueue (`BOOKING_CONFIRMED`)
* **Manage booking:** `/m/[token]`
  * View booking details (token resolved via `resolveManageToken`)
  * Cancel booking (idempotent) → outbox enqueue (`BOOKING_CANCELLED`)
  * Reschedule booking (same staff) → outbox enqueue (`BOOKING_UPDATED`)
* **Abuse protection:**
  * Rate limiting on availability (60/min), bookings (10/min), manage page (30/min), manage cancel/reschedule (10/min)
  * Honeypot field blocks bots

### Owner (shop operator)

* **Login:** `/login` — Supabase email/password
* **Logout:** `POST /api/auth/logout`
* **Protected owner routes:** `(owner)` route group guarded by `requireOwner()` (cookie-based)
* **Dashboard day view:** `/dashboard`
  * Bookings grouped by staff; blocks shown in schedule
  * Owner actions: cancel, move, walk-in, block time
  * `DayPicker` for date navigation
* **Settings:** `/settings` + tabs (staff, services, hours)
  * General shop config: name, slug, timezone, phone, address
  * Reminder settings: enable + `reminder_next_day_send_time_local`
  * Staff CRUD: create/rename/toggle active/delete with safety
  * Services CRUD: create/update duration/price/toggle active/delete with safety
  * Working hours per staff (weekly grid via `HoursEditor`)
* **Onboarding:** `/onboarding`
  * Checklist completion status (`getOwnerOnboardingStatus`)
  * Public link + copy + WhatsApp share + QR code

### Admin

* **Admin gate:** `requireAdmin()` — uses `profiles.is_admin` (cookie-based session)
* **Admin outbox viewer:** `/admin/outbox`
  * Server-side Supabase query (no fetch to API) to avoid cookie drop on absolute URL
  * Filters: status, event_type, shop slug (querystring form)
  * Table: created_at, shop, event_type, status, attempts, next_attempt_at, sent_at, booking_id, recipient email, last_error
  * **"Retry now"** button (client component `OutboxRetryButton`) → `POST /api/admin/outbox/retry` → sets `status=pending`, `next_attempt_at=now()`, `last_error=null`; `router.refresh()` on success
* **Admin shops:** `/admin/shops` — basic placeholder

### Background jobs

* **Cron route:** `POST /api/cron/send-reminders` — `x-cron-secret` header required
  * Generates `REMINDER_NEXT_DAY` outbox rows (idempotent by `booking:id:reminder_next_day:YYYY-MM-DD`)
  * Sends pending outbox items in batches with backoff
  * Uses `issueManageToken` to include manage link in reminder emails
* **Email provider:** `EMAIL_PROVIDER=dev` logs to stdout; Postmark/Resend optional

### Test gates (Day 7)

* **Concurrency booking test:** `concurrency-booking-test.mjs` — 10 parallel posts → exactly 1 success, rest 409
* **Smoke scenario scripts** (run via `npm run test:smoke`):
  * `scenario-book-confirm-outbox.mjs` — book → assert outbox has `BOOKING_CONFIRMED`
  * `scenario-manage-cancel-outbox.mjs` — create booking, cancel via manage token → assert booking cancelled and outbox has `BOOKING_CANCELLED`
  * `scenario-cron-reminder-dedupe.mjs` — create booking for tomorrow, run cron twice → assert exactly one `REMINDER_NEXT_DAY` row (dedupe)
  * `security-rate-limit-availability-test.mjs` — hit availability >60 times → assert 429
* **Optional/manual:**
  * `scenario-owner-cancel-outbox.mjs` — documents manual check (owner cancel requires session)
  * `security-rls-crossshop-test.mjs` — DB check via `pg` + `DATABASE_URL`; verifies `relrowsecurity=true` on key tables

---

## 2) Repo layout

```
linkbook/
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── components.json           # shadcn/ui config
├── .env.local                # local env (not committed)
├── sql/
│   ├── 001_schema.sql        # core schema (tables + triggers)
│   ├── 002_rls.sql           # RLS policies
│   ├── 003_indexes_constraints.sql
│   ├── 004_rpc_get_availability.sql
│   ├── 006_perf_indexes.sql  # extra perf indexes (blocks/outbox)
│   └── seed.sql              # demo shop seed
├── scripts/
│   ├── _helpers.mjs          # supabaseAdmin, postJson, getJson, assert, sleep
│   ├── concurrency-booking-test.mjs
│   ├── scenario-book-confirm-outbox.mjs
│   ├── scenario-manage-cancel-outbox.mjs
│   ├── scenario-owner-cancel-outbox.mjs   # stub (manual validation)
│   ├── scenario-cron-reminder-dedupe.mjs
│   ├── security-rate-limit-availability-test.mjs
│   └── security-rls-crossshop-test.mjs    # pg + DATABASE_URL
└── src/
    ├── middleware.ts         # Supabase session refresh (SSR cookies)
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx          # placeholder home
    │   ├── login/
    │   │   └── page.tsx
    │   ├── (public)/
    │   │   ├── [shopSlug]/
    │   │   │   ├── page.tsx
    │   │   │   └── BookingWizard.tsx
    │   │   └── m/[token]/
    │   │       ├── page.tsx
    │   │       └── ManageActions.tsx
    │   ├── (owner)/
    │   │   ├── layout.tsx    # requireOwner gate
    │   │   ├── dashboard/
    │   │   │   ├── page.tsx
    │   │   │   ├── DayPicker.tsx
    │   │   │   ├── OwnerActions.tsx
    │   │   │   └── LogoutButton.tsx
    │   │   ├── onboarding/
    │   │   │   ├── page.tsx
    │   │   │   └── OnboardingShareCard.tsx
    │   │   └── settings/
    │   │       ├── layout.tsx
    │   │       ├── page.tsx
    │   │       ├── SettingsNav.tsx
    │   │       ├── ShopSettingsForm.tsx
    │   │       ├── staff/
    │   │       │   ├── page.tsx
    │   │       │   └── StaffEditor.tsx
    │   │       ├── services/
    │   │       │   ├── page.tsx
    │   │       │   └── ServicesEditor.tsx
    │   │       └── hours/
    │   │           ├── page.tsx
    │   │           └── HoursEditor.tsx
    │   ├── admin/
    │   │   ├── outbox/
    │   │   │   ├── page.tsx       # server-side query, filters, table
    │   │   │   └── OutboxRetryButton.tsx   # client component
    │   │   └── shops/
    │   │       └── page.tsx
    │   └── api/
    │       ├── availability/route.ts
    │       ├── auth/logout/route.ts
    │       ├── bookings/route.ts
    │       ├── manage/
    │       │   ├── cancel/route.ts
    │       │   └── reschedule/route.ts
    │       ├── owner/
    │       │   ├── bookings/route.ts
    │       │   ├── cancel/route.ts
    │       │   ├── move/route.ts
    │       │   ├── walkin/route.ts
    │       │   ├── block/route.ts
    │       │   ├── hours/route.ts
    │       │   ├── settings/shop/route.ts
    │       │   ├── staff/create|update|delete/route.ts
    │       │   └── services/create|update|delete/route.ts
    │       ├── cron/send-reminders/route.ts
    │       ├── admin/outbox/
    │       │   ├── route.ts       # GET list (admin-only API)
    │       │   └── retry/route.ts # POST retry (admin-only)
    │       └── debug/
    │           ├── owner/route.ts
    │           ├── admin/route.ts   # auth state: user, profile is_admin
    │           ├── tz/route.ts
    │           └── rls-check/route.ts
    └── lib/
        ├── auth/
        │   ├── requireOwner.ts      # requireOwner + requireOwnerSingleShop
        │   └── requireAdmin.ts
        ├── db/
        │   ├── supabase.server.ts   # createServerSupabaseClient, createServerSupabaseClientWithServiceRole
        │   ├── supabase.browser.ts
        │   ├── queries.ts
        │   ├── rpc.ts
        │   └── tx.ts
        ├── time/tz.ts
        ├── messaging/
        │   ├── sendEmail.ts
        │   ├── templates.ts
        │   ├── types.ts
        │   ├── adapter.ts
        │   └── providers/dev.ts, postmark.ts, resend.ts
        ├── onboarding/getOwnerOnboardingStatus.ts
        ├── security/
        │   ├── tokens.ts            # generate + hash manage token
        │   ├── issueManageToken.ts  # for cron reminder emails
        │   ├── resolveManageToken.ts
        │   └── phone.ts             # E.164 normalization
        ├── rate-limit/limiter.ts    # Upstash rateLimit, getClientIp, makeKey, getClientIpFromHeaders
        ├── validation/schemas.ts
        └── utils.ts
```

---

## 3) Database schema

### Core tables

| Table | Purpose |
|-------|---------|
| `profiles` | `id`, `email`, `is_admin` — linked to auth.users |
| `shops` | `name`, `slug` UNIQUE, `timezone`, `phone`, `address`, `is_active`, `reminder_next_day_enabled`, `reminder_next_day_send_time_local` |
| `shop_owners` | `(shop_id, owner_user_id)` many-to-many |
| `staff` | `shop_id`, `name`, `active` |
| `services` | `shop_id`, `name`, `duration_minutes`, `price_cents`, `active` |
| `working_hours` | `shop_id`, `staff_id`, `day_of_week` 0..6, `start_local`, `end_local` |
| `customers` | `shop_id`, `name`, `phone_e164`, `email` — unique `(shop_id, phone_e164)` |
| `bookings` | `shop_id`, `staff_id`, `service_id`, `customer_id`, `start_at`, `end_at`, `status`, `source` |
| `blocks` | `shop_id`, `staff_id`, `start_at`, `end_at`, `reason` |
| `manage_tokens` | `booking_id` PK, `token_hash` UNIQUE, `expires_at`, `revoked_at` |
| `notification_outbox` | `shop_id`, `booking_id`, `event_type`, `channel`, `payload_json`, `idempotency_key` UNIQUE, `status`, `attempt_count`, `next_attempt_at`, `last_error`, `sent_at` |

### Constraints

* **No double booking:** `EXCLUDE` on bookings for `status='confirmed'` using `tstzrange(start_at,end_at)` overlap per `staff_id`
* Blocks validated in availability RPC + write path
* Unique slug per shop

### RPC

* `rpc_get_availability(p_shop_slug, p_staff_id, p_service_id, p_day_local)` → UTC slot starts for that day (shop TZ), 15-min increments, excluding confirmed bookings + blocks

### Indexes

* Bookings: `(staff_id, start_at, end_at)`, `(shop_id, start_at)`, optional `(shop_id, staff_id, start_at)`
* Working hours: `(staff_id, day_of_week)`
* Staff: `(shop_id)`; Services: `(shop_id)`
* Blocks: `(shop_id, staff_id, start_at, end_at)`
* Outbox: `(status, next_attempt_at)`, `(booking_id, event_type, status)`
* Manage tokens: UNIQUE on `token_hash`

---

## 4) Security model

### Auth types

1. **Owner:** Supabase session cookies via `requireOwner()` / `requireOwnerSingleShop()`
2. **Admin:** `profiles.is_admin` via `requireAdmin()`; pages use `{ redirect: true }` → `redirect("/login")`; APIs return 403
3. **Customer manage:** token in URL `/m/[token]`; hash looked up in `manage_tokens`

### RLS

* Owners: read/write only shops in `shop_owners`
* Public booking: anon/service-role for availability + create booking
* Admin: service role after admin check (no RLS for admin operations)

### Token handling

* Raw token generated once, shown as `/m/[token]`
* DB stores `token_hash = sha256(token + TOKEN_PEPPER)`
* `resolveManageToken(token)` hashes and looks up `manage_tokens.token_hash`

### Rate limiting (Upstash)

| Endpoint | Limit | Key |
|----------|-------|-----|
| `/api/availability` | 60/min | `avail:shop:ip` |
| `/api/bookings` | 10/min | `book:shopSlug:ip` |
| `/m/[token]` page | 30/min | `manage_view:ip` |
| `/api/manage/cancel` | 10/min | `manage_cancel:ip` |
| `/api/manage/reschedule` | 10/min | `manage_resched:ip` |

Fail-open if Upstash env missing (warns once).

---

## 5) Runtime flows

### Customer booking

1. User loads `/[shopSlug]`
2. UI calls `/api/availability?shop=&staffId=&serviceId=&date=YYYY-MM-DD`
3. User submits `POST /api/bookings`
4. DB insert enforces overlap constraint; `manage_tokens` + `notification_outbox` rows created
5. Cron sends email (or DEV logs)

### Customer manage

1. User opens `/m/[token]`
2. `resolveManageToken(token)` → booking bundle
3. Cancel/reschedule → `/api/manage/cancel` or `/api/manage/reschedule`
4. Booking updated; outbox event queued; pending reminders cancelled on change

### Owner day view

1. Owner logs in at `/login`
2. `/dashboard` (guarded by `requireOwner`)
3. Server loads bookings + blocks for selected day (shop timezone)
4. Owner actions → `/api/owner/*` (session-gated)
5. Outbox events enqueued as needed

### Admin outbox

1. Admin visits `/admin/outbox` (guarded by `requireAdmin({ redirect: true })`)
2. Page queries `notification_outbox` via service role (server-side)
3. Filters applied from querystring
4. "Retry now" → `POST /api/admin/outbox/retry` → `router.refresh()`

### Cron

1. `POST /api/cron/send-reminders` with `x-cron-secret`
2. Idempotent generation of `REMINDER_NEXT_DAY` rows
3. Batch send of pending outbox with backoff
4. `issueManageToken` used for manage link in reminders

---

## 6) Environment variables

| Name | Purpose |
|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-only) |
| `TOKEN_PEPPER` | Secret for manage token hashing |
| `CRON_SECRET` | Header value for cron route |
| `EMAIL_PROVIDER` | `dev` \| `postmark` \| `resend` |
| `EMAIL_FROM` | Sender address |
| `POSTMARK_SERVER_TOKEN` | (Optional) Postmark API token |
| `APP_BASE_URL` | Base URL for app (e.g. reminders, redirects) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `DATABASE_URL` | (Optional) Postgres connection for RLS test script |

---

## 7) Smoke test env (scripts)

* `BASE_URL` (default `http://localhost:3001`)
* `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
* `SUPABASE_SERVICE_ROLE_KEY`
* `SHOP_SLUG`, `STAFF_ID`, `SERVICE_ID` — for booking/availability
* `CRON_SECRET` — for cron dedupe scenario
* `DATE_OVERRIDE` — (optional) YYYY-MM-DD for availability
* `DATABASE_URL` — for RLS script only

---
