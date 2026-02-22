#!/usr/bin/env node
/**
 * Concurrency booking test: 10 parallel POSTs for the same slot.
 * Expects exactly 1 success (201) and 9 conflicts (409 slot_taken).
 *
 *   node scripts/concurrency-booking-test.mjs
 *
 * Optional env: BASE_URL, SHOP_SLUG, STAFF_ID, SERVICE_ID, START_AT
 * (default BASE_URL=http://localhost:3001, SHOP_SLUG=temp-barber)
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";
const shopSlug = process.env.SHOP_SLUG ?? "temp-barber";
const staffId = process.env.STAFF_ID ?? "";
const serviceId = process.env.SERVICE_ID ?? "";
const startAt = process.env.START_AT ?? "";

if (!staffId || !serviceId || !startAt) {
  console.error("Set STAFF_ID, SERVICE_ID, and START_AT (env or edit script). Example:");
  console.error("  STAFF_ID=<uuid> SERVICE_ID=<uuid> START_AT=2026-02-20T09:00:00.000Z node scripts/concurrency-booking-test.mjs");
  process.exit(1);
}

const phone = "+905551112233";

async function runOne(i) {
  const res = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shopSlug,
      serviceId,
      staffId,
      startAt,
      name: `Concurrency Test User ${i}`,
      phone,
      email: `user${i}@concurrency-test.example`,
      honeypot: "",
    }),
  });
  return { status: res.status, ok: res.ok };
}

async function main() {
  const promises = Array.from({ length: 10 }, (_, i) => runOne(i + 1));
  const results = await Promise.all(promises);

  let success = 0;
  let conflicts = 0;
  const others = [];

  for (const { status } of results) {
    if (status === 201) success++;
    else if (status === 409) conflicts++;
    else others.push(status);
  }

  console.log("Summary:");
  console.log("  success (201):", success);
  console.log("  conflicts (409 slot_taken):", conflicts);
  if (others.length) console.log("  other statuses:", others.join(", "));

  const pass = success === 1 && conflicts === 9;
  if (pass) {
    console.log("OK: exactly 1 success and 9 conflicts.");
    process.exit(0);
  }
  console.log("FAIL: expected 1 success and 9 conflicts.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
