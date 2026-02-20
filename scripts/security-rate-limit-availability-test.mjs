/**
 * Hit /api/availability in a loop > 60 times and assert a 429 occurs.
 * Env: BASE_URL, SHOP_SLUG, STAFF_ID, SERVICE_ID.
 */

import { getBaseUrl, getJson, assert } from "./_helpers.mjs";

function log(msg) {
  console.log(`[security-rate-limit-availability-test] ${msg}`);
}

export async function run() {
  const base = getBaseUrl();
  const shopSlug = process.env.SHOP_SLUG;
  const staffId = process.env.STAFF_ID;
  const serviceId = process.env.SERVICE_ID;

  assert(shopSlug, "SHOP_SLUG is required");
  assert(staffId, "STAFF_ID is required");
  assert(serviceId, "SERVICE_ID is required");

  const dateStr = new Date().toISOString().slice(0, 10);
  const url = `${base}/api/availability?shop=${encodeURIComponent(shopSlug)}&staffId=${encodeURIComponent(staffId)}&serviceId=${encodeURIComponent(serviceId)}&date=${dateStr}`;

  let got429 = false;
  const limit = 65;
  for (let i = 0; i < limit; i++) {
    const res = await getJson(url);
    if (res.status === 429) {
      got429 = true;
      log(`Received 429 after ${i + 1} requests`);
      break;
    }
  }

  assert(got429, `Expected 429 within ${limit} requests; rate limit may be disabled or limit > 60`);
  log("PASS");
}

run().catch((err) => {
  console.error("[security-rate-limit-availability-test] FAIL:", err.message);
  process.exit(1);
});
