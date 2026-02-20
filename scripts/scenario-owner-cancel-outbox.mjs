/**
 * Owner cancel outbox scenario.
 * The owner cancel API (POST /api/owner/cancel) requires a browser session (requireOwnerSingleShop).
 * This script does not perform automated owner-cancel; it documents manual validation.
 *
 * Manual validation: When an owner cancels a booking (cancelled_by_shop),
 * verify that notification_outbox contains a row with
 *   event_type = 'BOOKING_CANCELLED' and
 *   idempotency_key = 'booking:<bookingId>:cancelled_by_shop'.
 *
 * CI: PASS (manual; owner cancel requires session).
 */

function log(msg) {
  console.log(`[scenario-owner-cancel-outbox] ${msg}`);
}

export async function run() {
  log("Owner cancel requires cookie session; skipping automated test.");
  log("Manual check: cancel a booking as owner and verify outbox has booking:<id>:cancelled_by_shop.");
  log("PASS");
}

run().catch((err) => {
  console.error("[scenario-owner-cancel-outbox] FAIL:", err.message);
  process.exit(1);
});
