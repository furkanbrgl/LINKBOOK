# AGENTS.md

## Cursor Cloud specific instructions

### Overview

**Linkbook** is a Next.js 16 (App Router) SaaS appointment booking platform. Single `package.json`, uses `npm`. See `PROJECT_STRUCTURE.md` for full architecture.

### Prerequisites (installed on the VM image, not in the update script)

- **Docker** + **fuse-overlayfs** + **iptables-legacy** for running local Supabase
- **Supabase CLI** (`supabase` binary in `/usr/local/bin`)

### Starting services

1. **Docker daemon**: `sudo dockerd &>/tmp/dockerd.log &` (wait ~3s)
2. **Local Supabase**: `cd /workspace && sudo supabase start` (pulls Docker images on first run, ~90s; subsequent starts ~10s). Outputs API URL, keys, and DB URL.
3. **Apply SQL schema** (only after a fresh `supabase start` with no prior schema):
   ```
   sudo docker exec -i supabase_db_workspace psql -U postgres -d postgres < src/sql/001_schema.sql
   sudo docker exec -i supabase_db_workspace psql -U postgres -d postgres < src/sql/002_rls.sql
   sudo docker exec -i supabase_db_workspace psql -U postgres -d postgres < src/sql/003_indexes_constraints.sql
   sudo docker exec -i supabase_db_workspace psql -U postgres -d postgres < sql/004_rpc_get_availability.sql
   sudo docker exec -i supabase_db_workspace psql -U postgres -d postgres < sql/006_perf_indexes.sql
   sudo docker exec -i supabase_db_workspace psql -U postgres -d postgres < sql/007_templates.sql
   sudo docker exec -i supabase_db_workspace psql -U postgres -d postgres < src/sql/seed.sql
   ```
4. **Create `.env.local`** with local Supabase keys (get from `sudo supabase status -o json`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase status>
   TOKEN_PEPPER=dev-token-pepper-secret-12345
   CRON_SECRET=dev-cron-secret-12345
   APP_BASE_URL=http://localhost:3000
   EMAIL_PROVIDER=dev
   EMAIL_FROM=noreply@localhost
   ```
5. **Next.js dev server**: `npm run dev` (port 3000)

### Common commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npx eslint .` |
| Smoke tests | `npm run test:smoke` (requires running app + Supabase with seed data + env vars) |

### Known caveats

- **Next.js 16 deprecates `middleware.ts`**: The dev server logs a warning about using "proxy" instead. The app still works but expect this warning.
- **Next.js 16 + Supabase fetch caching**: API routes using `createServerSupabaseClientWithServiceRole()` may return stale or incorrect data due to Next.js's internal `fetch` patching. This is a known compatibility issue. Server components (pages) are not affected in the same way. If you need to debug API data issues, test Supabase queries directly via `node -e "..."` scripts or curl to `http://localhost:54321/rest/v1/...`.
- **Upstash Redis**: Rate limiting is optional and fails open (logs a warning, allows all requests). No Upstash env vars needed for local development.
- **Email**: Set `EMAIL_PROVIDER=dev` for local dev; confirmation/reminder emails log to stdout instead of sending.
- **Test user creation**: Use the Supabase Admin API to create auth users, then insert corresponding `profiles` and `shop_owners` rows. Example:
  ```bash
  curl -s -X POST http://localhost:54321/auth/v1/admin/users \
    -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
    -H "apikey: <ANON_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"email":"owner@test.com","password":"TestPass2026!@#","email_confirm":true}'
  ```
  Then link the user's UUID to `profiles` and `shop_owners` tables via psql.
- **SQL files**: The "real" schema is in `src/sql/` (001, 002, 003 + seed). The `sql/` directory at root has additional RPC and index files. The root `sql/001-003` are stubs/TODOs.
