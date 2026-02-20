/**
 * Scenario: create booking for tomorrow, run cron twice, assert REMINDER_NEXT_DAY outbox dedupe (count=1).
 * Env: BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, SHOP_SLUG, STAFF_ID, SERVICE_ID.
 */

import {
  getBaseUrl,
  supabaseAdmin,
  postJson,
  getJson,
  assert,
} from "./_helpers.mjs";
import { DateTime } from "luxon";

function log(msg) {
  console.log(`[scenario-cron-reminder-dedupe] ${msg}`);
}

export async function run() {
  const base = getBaseUrl();
  const cronSecret = process.env.CRON_SECRET;
  const shopSlug = process.env.SHOP_SLUG;
  const staffId = process.env.STAFF_ID;
  const serviceId = process.env.SERVICE_ID;

  assert(cronSecret, "CRON_SECRET is required");
  assert(shopSlug, "SHOP_SLUG is required");
  assert(staffId, "STAFF_ID is required");
  assert(serviceId, "SERVICE_ID is required");

  const supabase = supabaseAdmin();
  assert(supabase, "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id, timezone")
    .eq("slug", shopSlug)
    .maybeSingle();
  if (shopError) throw new Error(`Shops query failed: ${shopError.message}`);
  assert(shop, `Shop not found: ${shopSlug}`);
  const tz = shop.timezone || "UTC";

  await supabase
    .from("shops")
    .update({
      reminder_next_day_enabled: true,
      reminder_next_day_send_time_local: "00:00",
    })
    .eq("id", shop.id);

  const tomorrowLocal = DateTime.now().setZone(tz).plus({ days: 1 }).toFormat("yyyy-MM-dd");
  log(`Tomorrow (shop TZ): ${tomorrowLocal}`);

  const availUrl = `${base}/api/availability?shop=${encodeURIComponent(shopSlug)}&staffId=${encodeURIComponent(staffId)}&serviceId=${encodeURIComponent(serviceId)}&date=${tomorrowLocal}`;
  const availRes = await getJson(availUrl);
  if (availRes.status !== 200) {
    throw new Error(`Availability returned ${availRes.status}: ${JSON.stringify(availRes.data)}`);
  }
  const slots = availRes.data?.slots ?? [];
  assert(slots.length > 0, `No slots for tomorrow ${tomorrowLocal}`);

  const startAt = slots[0].startAt;
  assert(startAt, "First slot missing startAt");

  const bookingPayload = {
    shopSlug,
    staffId,
    serviceId,
    startAt,
    name: "CI Cron Dedupe",
    phone: "+905551112233",
    email: "ci-cron@test.example",
  };

  const bookRes = await postJson(`${base}/api/bookings`, bookingPayload);
  if (bookRes.status !== 201) {
    throw new Error(`POST /api/bookings returned ${bookRes.status}: ${JSON.stringify(bookRes.data)}`);
  }
  const bookingId = bookRes.data?.bookingId;
  assert(bookingId, "Response missing bookingId");

  const cronUrl = `${base}/api/cron/send-reminders`;
  const cronRes1 = await postJson(cronUrl, {}, { "x-cron-secret": cronSecret });
  if (cronRes1.status !== 200) {
    throw new Error(`Cron first call returned ${cronRes1.status}: ${JSON.stringify(cronRes1.data)}`);
  }

  const { data: outbox1, error: out1 } = await supabase
    .from("notification_outbox")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("event_type", "REMINDER_NEXT_DAY");
  if (out1) throw new Error(`Outbox query failed: ${out1.message}`);
  assert(outbox1?.length >= 1, `Expected at least one REMINDER_NEXT_DAY row for booking ${bookingId} after first cron, got ${outbox1?.length ?? 0}`);

  const cronRes2 = await postJson(cronUrl, {}, { "x-cron-secret": cronSecret });
  if (cronRes2.status !== 200) {
    throw new Error(`Cron second call returned ${cronRes2.status}: ${JSON.stringify(cronRes2.data)}`);
  }

  const { data: outbox2, error: out2 } = await supabase
    .from("notification_outbox")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("event_type", "REMINDER_NEXT_DAY");
  if (out2) throw new Error(`Outbox query failed: ${out2.message}`);
  assert(outbox2?.length === 1, `Expected exactly one REMINDER_NEXT_DAY row after second cron (dedupe), got ${outbox2?.length ?? 0}`);

  log("PASS");
}

run().catch((err) => {
  console.error("[scenario-cron-reminder-dedupe] FAIL:", err.message);
  process.exit(1);
});
