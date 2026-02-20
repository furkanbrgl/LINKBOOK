/**
 * Scenario: create booking via POST /api/bookings, assert 201 and outbox has BOOKING_CONFIRMED.
 * Env: BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SHOP_SLUG, STAFF_ID, SERVICE_ID.
 * Optional: DATE_OVERRIDE (YYYY-MM-DD) for availability date; default 7 days from now (UTC date).
 */

import {
  getBaseUrl,
  supabaseAdmin,
  postJson,
  getJson,
  assert,
} from "./_helpers.mjs";

function log(msg) {
  console.log(`[scenario-book-confirm-outbox] ${msg}`);
}

export async function run() {
  const base = getBaseUrl();
  const shopSlug = process.env.SHOP_SLUG;
  const staffId = process.env.STAFF_ID;
  const serviceId = process.env.SERVICE_ID;

  assert(shopSlug, "SHOP_SLUG is required");
  assert(staffId, "STAFF_ID is required");
  assert(serviceId, "SERVICE_ID is required");

  const supabase = supabaseAdmin();
  assert(supabase, "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  // Date for availability: optional DATE_OVERRIDE or 7 days from now (UTC date)
  let dateStr = process.env.DATE_OVERRIDE;
  if (!dateStr) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 7);
    dateStr = d.toISOString().slice(0, 10);
  }
  log(`Using availability date: ${dateStr}`);

  const availUrl = `${base}/api/availability?shop=${encodeURIComponent(shopSlug)}&staffId=${encodeURIComponent(staffId)}&serviceId=${encodeURIComponent(serviceId)}&date=${dateStr}`;
  const availRes = await getJson(availUrl);
  if (availRes.status !== 200) {
    throw new Error(`Availability returned ${availRes.status}: ${JSON.stringify(availRes.data)}`);
  }
  const slots = availRes.data?.slots ?? [];
  assert(slots.length > 0, `No slots returned for ${dateStr}. Check SHOP_SLUG, STAFF_ID, SERVICE_ID and shop config.`);

  const startAt = slots[0].startAt;
  assert(startAt, "First slot missing startAt");

  const bookingPayload = {
    shopSlug,
    staffId,
    serviceId,
    startAt,
    name: "CI Test User",
    phone: "+905551112233",
    email: "ci@test.example",
  };

  const { status, data } = await postJson(`${base}/api/bookings`, bookingPayload);
  if (status !== 201) {
    throw new Error(`POST /api/bookings returned ${status}: ${JSON.stringify(data)}`);
  }
  const bookingId = data?.bookingId;
  assert(bookingId, "Response missing bookingId");

  const { data: rows, error } = await supabase
    .from("notification_outbox")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("event_type", "BOOKING_CONFIRMED");

  if (error) throw new Error(`Outbox query failed: ${error.message}`);
  assert(rows?.length >= 1, `Expected at least one BOOKING_CONFIRMED outbox row for booking ${bookingId}, got ${rows?.length ?? 0}`);

  log("PASS");
}

run().catch((err) => {
  console.error("[scenario-book-confirm-outbox] FAIL:", err.message);
  process.exit(1);
});
