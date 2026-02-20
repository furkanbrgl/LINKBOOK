# Linkbook — Project structure

Next.js 16 (App Router) + Supabase booking app. This file is a quick map of what lives where.

---

## Root

```
linkbook/
├── package.json           # deps: next, react, @supabase/*, luxon, zod, tailwind, etc.
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── components.json        # shadcn/ui
├── .env.local             # env vars (not committed)
├── src/
├── sql/                   # DB migrations/schema (root-level)
└── scripts/              # e.g. concurrency-booking-test.mjs
```

---

## `src/` — Application

### Entry & layout

| Path | Purpose |
|------|--------|
| `app/layout.tsx` | Root layout (fonts, metadata, `<html>/<body>`) |
| `app/page.tsx` | Home page (placeholder) |
| `app/globals.css` | Global styles |
| `middleware.ts` | Supabase session refresh on every request |

### Route groups

- **`(owner)`** — Logged-in shop owners (protected by `requireOwner()`).
- **`(public)`** — No auth: public booking and manage-by-token pages.

---

## `src/app/` — Pages & API

### Owner area `(owner)/`

| Path | Purpose |
|------|--------|
| `layout.tsx` | Requires owner; redirects to `/login` if not authenticated |
| `dashboard/page.tsx` | Dashboard: day view, staff, bookings, blocks, cancel/move, walk-in, block |
| `dashboard/DayPicker.tsx` | Day selector (links) |
| `dashboard/OwnerActions.tsx` | BookingActions (cancel, move), StaffActions (walk-in, block) |
| `dashboard/LogoutButton.tsx` | Client logout |
| `onboarding/page.tsx` | Onboarding checklist + share card |
| `onboarding/OnboardingShareCard.tsx` | Share URL / QR |
| `settings/layout.tsx` | Shared settings layout: header, onboarding progress, tabs |
| `settings/page.tsx` | General shop settings (slug, timezone, phone, reminders, etc.) |
| `settings/SettingsNav.tsx` | Tabs: General, Staff, Services, Working hours |
| `settings/ShopSettingsForm.tsx` | General settings form |
| `settings/staff/page.tsx` | Staff list + editor |
| `settings/staff/StaffEditor.tsx` | Staff CRUD UI |
| `settings/services/page.tsx` | Services list + editor |
| `settings/services/ServicesEditor.tsx` | Services CRUD UI |
| `settings/hours/page.tsx` | Working hours per staff |
| `settings/hours/HoursEditor.tsx` | Hours grid editor |

### Public area `(public)/`

| Path | Purpose |
|------|--------|
| `[shopSlug]/page.tsx` | Public booking page (service, staff, date, slots, customer form) |
| `[shopSlug]/BookingWizard.tsx` | Multi-step booking form; calls `/api/availability`, `POST /api/bookings` |
| `m/[token]/page.tsx` | Manage booking by token (view, cancel, reschedule) |
| `m/[token]/ManageActions.tsx` | Cancel / reschedule UI |

### Other app pages

| Path | Purpose |
|------|--------|
| `login/page.tsx` | Email/password sign-in (Supabase) |
| `admin/shops/page.tsx` | Admin: shops list |
| `admin/outbox/page.tsx` | Admin: notification outbox |

---

## `src/app/api/` — API routes

### Auth

| Path | Purpose |
|------|--------|
| `auth/logout/route.ts` | Logout |

### Public (no owner auth)

| Path | Purpose |
|------|--------|
| `availability/route.ts` | GET slots for shop+staff+service+date (uses `rpc_get_availability`) |
| `bookings/route.ts` | POST create booking; customer upsert; manage token; outbox row |

### Manage (token-based)

| Path | Purpose |
|------|--------|
| `manage/cancel/route.ts` | POST cancel by manage token |
| `manage/reschedule/route.ts` | POST reschedule by manage token |

### Owner (require owner session)

| Path | Purpose |
|------|--------|
| `owner/cancel/route.ts` | POST cancel booking (shop) |
| `owner/move/route.ts` | POST move booking |
| `owner/block/route.ts` | POST create block |
| `owner/walkin/route.ts` | POST create walk-in booking |
| `owner/bookings/route.ts` | GET bookings for shop |
| `owner/hours/route.ts` | GET/PUT working hours |
| `owner/settings/shop/route.ts` | PUT shop settings (general) |
| `owner/staff/create|update|delete/route.ts` | Staff CRUD |
| `owner/services/create|update|delete/route.ts` | Services CRUD |

### Cron

| Path | Purpose |
|------|--------|
| `cron/send-reminders/route.ts` | POST; x-cron-secret; generate REMINDER_NEXT_DAY rows; send pending outbox (Postmark/dev) |

### Debug

| Path | Purpose |
|------|--------|
| `debug/owner/route.ts` | Debug owner context |
| `debug/tz/route.ts` | Debug timezone |
| `debug/rls-check/route.ts` | RLS check |

---

## `src/lib/` — Shared logic

### Auth

| Path | Purpose |
|------|--------|
| `auth/requireOwner.ts` | Server: get current user + shop IDs from `shop_owners` (cookie client) |
| `auth/requireAdmin.ts` | Server: require admin |

### Database

| Path | Purpose |
|------|--------|
| `db/supabase.server.ts` | createServerSupabaseClient (cookies/RLS), withServiceRole, withAnon |
| `db/supabase.browser.ts` | Browser Supabase client |
| `db/tx.ts` | Transaction helpers (stub) |
| `db/rpc.ts` | RPC helpers (stub) |
| `db/queries.ts` | Query helpers (stub) |

### Time

| Path | Purpose |
|------|--------|
| `time/tz.ts` | Shop timezone: getShopLocalDate, getShopLocalDateTomorrow, getShopLocalTime, getShopDayUtcRange, formatShopLocal, toUTCFromShopLocal, etc. (Luxon) |

### Messaging (email)

| Path | Purpose |
|------|--------|
| `messaging/types.ts` | EmailMessage, EmailProvider |
| `messaging/sendEmail.ts` | sendEmail(msg), getEmailProviderName() — Postmark or dev |
| `messaging/templates.ts` | renderEmail(eventType, data), formatBookingLine; BOOKING_*, REMINDER_* |
| `messaging/providers/postmark.ts` | Postmark API (POSTMARK_SERVER_TOKEN, EMAIL_FROM) |
| `messaging/providers/dev.ts` | Dev provider (console.log) |
| `messaging/providers/resend.ts` | Resend (legacy/stub) |
| `messaging/adapter.ts` | Legacy adapter types (MessagePayload, MessagingAdapter) |

### Onboarding

| Path | Purpose |
|------|--------|
| `onboarding/getOwnerOnboardingStatus.ts` | Server: checklist status (slug, timezone, phone, staff, services, hours); items + next href |

### Security

| Path | Purpose |
|------|--------|
| `security/tokens.ts` | generateManageToken(), hashToken() |
| `security/resolveManageToken.ts` | Resolve raw token → booking + shop, staff, service, customer |
| `security/phone.ts` | normalizePhoneE164 |

### Validation

| Path | Purpose |
|------|--------|
| `validation/schemas.ts` | Zod: BookingCreateSchema, etc. |

### Other

| Path | Purpose |
|------|--------|
| `rate-limit/limiter.ts` | Rate limiting (stub) |
| `utils.ts` | cn() and other utils |

---

## `sql/` (root) and `src/sql/`

| Path | Purpose |
|------|--------|
| `001_schema.sql` | Tables: profiles, shops, shop_owners, staff, services, working_hours, customers, bookings, blocks, manage_tokens, notification_outbox |
| `002_rls.sql` | RLS policies |
| `003_indexes_constraints.sql` | Indexes, constraints |
| `004_rpc_get_availability.sql` | rpc_get_availability |
| `seed.sql` | Seed data (if any) |

---

## Env vars (reference)

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Cron:** `CRON_SECRET`
- **Email:** `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM`, `EMAIL_PROVIDER` (optional: `dev` | `postmark`), `APP_BASE_URL`

---

## Flow summary

- **Customer books:** `/[shopSlug]` → BookingWizard → `/api/availability` + `POST /api/bookings` → manage token + outbox.
- **Customer manages:** `/m/[token]` → resolveManageToken → cancel/reschedule via `/api/manage/*`.
- **Owner:** Login → `/dashboard` (requireOwner); settings/onboarding under `(owner)`; owner APIs use requireOwnerSingleShop or cookie client.
- **Cron:** `POST /api/cron/send-reminders` (x-cron-secret) → generate reminder rows → send pending outbox (Postmark or dev provider).
