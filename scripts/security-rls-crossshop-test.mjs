/**
 * DB-level RLS check: ensure relrowsecurity is true for key tables.
 * Env: DATABASE_URL (Postgres connection string; e.g. Supabase pooler URL).
 * Requires: pg (devDep) and DATABASE_URL.
 */

let pg;
try {
  pg = (await import("pg")).default;
} catch (e) {
  console.error("[security-rls-crossshop-test] FAIL: pg module not found. Install with: npm install pg");
  process.exit(1);
}

const REQUIRED_TABLES = [
  "bookings",
  "blocks",
  "staff",
  "services",
  "working_hours",
  "customers",
  "notification_outbox",
];

function log(msg) {
  console.log(`[security-rls-crossshop-test] ${msg}`);
}

export async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log("SKIP: DATABASE_URL not set (required for RLS check)");
    process.exit(0);
    return;
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT c.relname, c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = ANY($1)`,
      [REQUIRED_TABLES]
    );
    const rows = res.rows || [];
    const byName = Object.fromEntries(rows.map((r) => [r.relname, r.relrowsecurity]));

    for (const table of REQUIRED_TABLES) {
      const rls = byName[table];
      if (rls !== true) {
        throw new Error(`RLS not enabled on public.${table} (relrowsecurity=${rls})`);
      }
    }
  } finally {
    await client.end().catch(() => {});
  }

  log("PASS");
}

run().catch((err) => {
  console.error("[security-rls-crossshop-test] FAIL:", err.message);
  process.exit(1);
});
