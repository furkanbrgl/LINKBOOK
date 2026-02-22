import { NextResponse } from "next/server";
import { createServerSupabaseClientWithServiceRole } from "@/lib/db/supabase.server";
import {
  getShopLocalDate,
  getShopLocalDateTomorrow,
  getShopLocalTime,
  getShopDayUtcRange,
} from "@/lib/time/tz";
import { renderEmail, getAppBaseUrl } from "@/lib/messaging/renderEmail";
import { getTemplateForShop } from "@/lib/templates/getTemplateForShop";
import { sendEmail, getEmailProviderName } from "@/lib/messaging/sendEmail";
import { issueManageToken } from "@/lib/security/issueManageToken";

const CRON_SECRET = process.env.CRON_SECRET;
const BACKOFF_MINUTES = [5, 30, 2 * 60, 12 * 60] as const; // attempt 1..4 => minutes
const MAX_ATTEMPTS = 5;
const SEND_BATCH_LIMIT = 200;
const LAST_ERROR_MAX_LEN = 2000;

function getTemplateEventType(
  eventType: string,
  payload: { by?: string }
): string {
  if (eventType === "BOOKING_CANCELLED") {
    return payload.by === "customer"
      ? "BOOKING_CANCELLED_CUSTOMER"
      : "BOOKING_CANCELLED_SHOP";
  }
  return eventType;
}

/** Normalize DB time "HH:mm:ss" or "HH:mm" to "HH:mm" for comparison. */
function normalizeTimeForCompare(t: string): string {
  return t.slice(0, 5);
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!CRON_SECRET || CRON_SECRET.trim() === "") {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getEmailProviderName();
  const supabase = createServerSupabaseClientWithServiceRole();
  const nowIso = new Date().toISOString();
  let generated = 0;

  // Step 1: Generate reminder outbox rows (idempotent)
  const { data: shops } = await supabase
    .from("shops")
    .select("id, timezone, reminder_next_day_send_time_local, slug, name, phone, address")
    .eq("reminder_next_day_enabled", true);

  if (shops?.length) {
    for (const shop of shops) {
      const tz = shop.timezone;
      const sendTimeLocal = shop.reminder_next_day_send_time_local;
      if (!tz || sendTimeLocal == null) continue;

      const localTime = getShopLocalTime(nowIso, tz);
      const sendTimeNorm = normalizeTimeForCompare(
        typeof sendTimeLocal === "string" ? sendTimeLocal : "23:59"
      );
      if (localTime < sendTimeNorm) continue;

      const tomorrowLocal = getShopLocalDateTomorrow(nowIso, tz);
      const { startUtcISO, endUtcISO } = getShopDayUtcRange(tomorrowLocal, tz);

      const { data: bookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("shop_id", shop.id)
        .eq("status", "confirmed")
        .lt("start_at", endUtcISO)
        .gt("end_at", startUtcISO);

      if (!bookings?.length) continue;

      for (const b of bookings) {
        const idempotencyKey = `booking:${b.id}:reminder_next_day:${tomorrowLocal}`;
        const payload = {
          shop_id: shop.id,
          booking_id: b.id,
          type: "REMINDER_NEXT_DAY",
        };
        const { error } = await supabase.from("notification_outbox").insert({
          shop_id: shop.id,
          booking_id: b.id,
          event_type: "REMINDER_NEXT_DAY",
          channel: "email",
          payload_json: payload,
          idempotency_key: idempotencyKey,
          status: "pending",
        });
        if (!error) generated++;
        else if ((error as { code?: string }).code !== "23505") throw error;
      }
    }
  }

  // Step 2: Send pending outbox rows
  const { data: pending } = await supabase
    .from("notification_outbox")
    .select("id, shop_id, booking_id, event_type, payload_json, attempt_count")
    .eq("status", "pending")
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(SEND_BATCH_LIMIT);

  let processed = 0;
  let sent = 0;
  let failed = 0;
  const appBaseUrl = getAppBaseUrl();

  if (pending?.length) {
    for (const row of pending) {
      processed++;

      const shopId = row.shop_id;
      const bookingId = row.booking_id;
      let payload = (row.payload_json ?? {}) as Record<string, unknown>;

      // Fetch shop with template fields
      const { data: shop } = await supabase
        .from("shops")
        .select("name, slug, timezone, phone, address, industry_template, branding, template_overrides")
        .eq("id", shopId)
        .maybeSingle();

      if (!shop) {
        await supabase
          .from("notification_outbox")
          .update({
            status: "failed",
            last_error: "Shop not found",
            attempt_count: row.attempt_count + 1,
            next_attempt_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed++;
        continue;
      }

      const { template, branding } = getTemplateForShop(shop);

      // Fetch booking, staff, service, customer to enrich payload for REMINDER etc.
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, start_at, end_at, status, staff_id, service_id, customer_id")
        .eq("id", bookingId)
        .maybeSingle();

      let staff: { name: string } | null = null;
      let service: { name: string; duration_minutes?: number } | null = null;
      let customer: { name: string | null; email: string | null } | null = null;

      if (booking) {
        const [staffRes, serviceRes, customerRes] = await Promise.all([
          supabase.from("staff").select("name").eq("id", booking.staff_id).maybeSingle(),
          supabase.from("services").select("name, duration_minutes").eq("id", booking.service_id).maybeSingle(),
          supabase.from("customers").select("name, email").eq("id", booking.customer_id).maybeSingle(),
        ]);
        staff = staffRes.data ?? null;
        service = serviceRes.data ?? null;
        customer = customerRes.data ?? null;

        payload = {
          ...payload,
          shopName: payload.shopName ?? shop.name,
          shopSlug: payload.shopSlug ?? shop.slug,
          timezone: payload.timezone ?? shop.timezone,
          startAt: payload.startAt ?? booking.start_at,
          endAt: payload.endAt ?? booking.end_at,
          staffName: payload.staffName ?? staff?.name,
          serviceName: payload.serviceName ?? service?.name,
          customerName: payload.customerName ?? customer?.name,
          toEmail: payload.toEmail ?? payload.customerEmail ?? customer?.email,
          customerEmail: payload.customerEmail ?? customer?.email,
        };
      }

      let manageToken = payload.manageToken as string | undefined;
      if (bookingId && manageToken == null) {
        manageToken = await issueManageToken(supabase, bookingId);
        payload = { ...payload, manageToken };
        await supabase
          .from("notification_outbox")
          .update({ payload_json: payload })
          .eq("id", row.id);
      }

      const eventType = getTemplateEventType(row.event_type, payload);
      const email = renderEmail(eventType, payload, template, branding, appBaseUrl);

      const toEmail = email.to;

      if (!toEmail) {
        await supabase
          .from("notification_outbox")
          .update({
            status: "failed",
            last_error: "Missing recipient email (toEmail/customerEmail).",
            attempt_count: (row.attempt_count ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed++;
        continue;
      }

      const existingPayload =
        (row.payload_json as Record<string, unknown> | null) ?? {};
      const payloadMerge = {
        ...existingPayload,
        toEmail: existingPayload.toEmail ?? toEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
      };

      await supabase
        .from("notification_outbox")
        .update({
          payload_json: payloadMerge,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      try {
        await sendEmail({
          to: toEmail.trim(),
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
        await supabase
          .from("notification_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", row.id);
        sent++;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        const lastError = message.slice(0, LAST_ERROR_MAX_LEN);
        const nextAttempt = row.attempt_count + 1;
        const isFinal = nextAttempt >= MAX_ATTEMPTS;
        const backoffMs =
          nextAttempt <= BACKOFF_MINUTES.length
            ? BACKOFF_MINUTES[nextAttempt - 1] * 60 * 1000
            : BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1] * 60 * 1000;
        const nextAttemptAt = new Date(
          Date.now() + backoffMs
        ).toISOString();

        await supabase
          .from("notification_outbox")
          .update({
            status: isFinal ? "failed" : "pending",
            attempt_count: nextAttempt,
            next_attempt_at: nextAttemptAt,
            last_error: lastError,
          })
          .eq("id", row.id);
        failed++;
      }
    }
  }

  return NextResponse.json({
    generated,
    processed,
    sent,
    failed,
    provider,
  });
}
