/**
 * Scenario: create booking, cancel via POST /api/manage/cancel, assert booking cancelled and outbox has BOOKING_CANCELLED.
 * Env: BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SHOP_SLUG, STAFF_ID, SERVICE_ID.
 */

import {
  getBaseUrl,
  supabaseAdmin,
  postJson,
  getJson,
  assert,
} from "./_helpers.mjs";

function log(msg) {
  console.log(`[scenario-manage-cancel-outbox] ${msg}`);
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

  let dateStr = process.env.DATE_OVERRIDE;
  if (!dateStr) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 7);
    dateStr = d.toISOString().slice(0, 10);
  }

  const availUrl = `${base}/api/availability?shop=${encodeURIComponent(shopSlug)}&staffId=${encodeURIComponent(staffId)}&serviceId=${encodeURIComponent(serviceId)}&date=${dateStr}`;
  const availRes = await getJson(availUrl);
  if (availRes.status !== 200) {
    throw new Error(`Availability returned ${availRes.status}: ${JSON.stringify(availRes.data)}`);
  }
  const slots = availRes.data?.slots ?? [];
  assert(slots.length > 0, `No slots for ${dateStr}`);

  const startAt = slots[0].startAt;
  assert(startAt, "First slot missing startAt");

  const bookingPayload = {
    shopSlug,
    staffId,
    serviceId,
    startAt,
    name: "CI Cancel Test",
    phone: "+905551112233",
    email: "ci-cancel@test.example",
  };

  const bookRes = await postJson(`${base}/api/bookings`, bookingPayload);
  if (bookRes.status !== 201) {
    throw new Error(`POST /api/bookings returned ${bookRes.status}: ${JSON.stringify(bookRes.data)}`);
  }
  const bookingId = bookRes.data?.bookingId;
  const manageToken = bookRes.data?.manageToken;
  assert(bookingId, "Response missing bookingId");
  assert(manageToken, "Response missing manageToken");

  const cancelRes = await postJson(`${base}/api/manage/cancel`, { token: manageToken });
  if (cancelRes.status !== 200) {
    throw new Error(`POST /api/manage/cancel returned ${cancelRes.status}: ${JSON.stringify(cancelRes.data)}`);
  }
  assert(cancelRes.data?.ok === true, "Cancel response missing ok: true");
  assert(cancelRes.data?.status === "cancelled_by_customer", `Expected status cancelled_by_customer, got ${cancelRes.data?.status}`);

  const { data: booking, error: bookError } = await supabase
    .from("bookings")
    .select("status")
    .eq("id", bookingId)
    .single();
  if (bookError) throw new Error(`Bookings query failed: ${bookError.message}`);
  assert(booking?.status === "cancelled_by_customer", `Booking status expected cancelled_by_customer, got ${booking?.status}`);

  const idempotencyKey = `booking:${bookingId}:cancelled_by_customer`;
  const { data: outboxRows, error: outboxError } = await supabase
    .from("notification_outbox")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("event_type", "BOOKING_CANCELLED")
    .eq("idempotency_key", idempotencyKey);

  if (outboxError) throw new Error(`Outbox query failed: ${outboxError.message}`);
  assert(outboxRows?.length >= 1, `Expected outbox row with idempotency_key ${idempotencyKey}, got ${outboxRows?.length ?? 0}`);

  log("PASS");
}

run().catch((err) => {
  console.error("[scenario-manage-cancel-outbox] FAIL:", err.message);
  process.exit(1);
});
