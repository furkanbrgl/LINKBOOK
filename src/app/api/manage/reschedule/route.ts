import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { resolveManageToken } from "@/lib/security/resolveManageToken";
import { createServerSupabaseClientWithServiceRole } from "@/lib/db/supabase.server";

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/manage/reschedule" });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const token =
    typeof body === "object" && body !== null && "token" in body
      ? (body as { token: unknown }).token
      : undefined;
  const newStartAtRaw =
    typeof body === "object" && body !== null && "newStartAt" in body
      ? (body as { newStartAt: unknown }).newStartAt
      : undefined;

  if (typeof token !== "string" || token.length < 20) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  if (typeof newStartAtRaw !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const newStartAtDt = DateTime.fromISO(newStartAtRaw, { zone: "utc" });
  if (!newStartAtDt.isValid) {
    return NextResponse.json({ error: "Invalid newStartAt datetime" }, { status: 400 });
  }
  if (newStartAtDt.second !== 0 || newStartAtDt.millisecond !== 0 || newStartAtDt.minute % 15 !== 0) {
    return NextResponse.json({ error: "Invalid slot start time" }, { status: 400 });
  }

  const resolved = await resolveManageToken(token);
  if (!resolved) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const { booking, shop, staff, service } = resolved;
  const bookingId = booking.id;

  if (booking.status !== "confirmed") {
    return NextResponse.json(
      { error: "Booking is not reschedulable" },
      { status: 400 }
    );
  }

  const newEndAtDt = newStartAtDt.plus({ minutes: service.duration_minutes });
  const newStartAt = newStartAtDt.toISO();
  const newEndAt = newEndAtDt.toISO();
  if (!newStartAt || !newEndAt) {
    return NextResponse.json(
      { error: "Invalid datetime" },
      { status: 500 }
    );
  }

  const supabase = createServerSupabaseClientWithServiceRole();

  // Block overlap check
  const { data: blockingRows, error: blocksError } = await supabase
    .from("blocks")
    .select("id")
    .eq("shop_id", shop.id)
    .eq("staff_id", booking.staff_id)
    .lt("start_at", newEndAt)
    .gt("end_at", newStartAt)
    .limit(1);

  if (blocksError) {
    return NextResponse.json(
      { error: blocksError.message ?? "Failed to check blocks" },
      { status: 500 }
    );
  }
  if (blockingRows && blockingRows.length > 0) {
    return NextResponse.json({ error: "blocked" }, { status: 409 });
  }

  // Update booking
  const { error: updateError } = await supabase
    .from("bookings")
    .update({ start_at: newStartAt, end_at: newEndAt })
    .eq("id", bookingId);

  if (updateError) {
    const msg = updateError.message ?? "";
    const code = (updateError as { code?: string }).code;
    const isOverlap =
      code === "23P01" ||
      msg.includes("bookings_no_overlap_confirmed") ||
      msg.includes("conflicts with existing key");
    if (isOverlap) {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    return NextResponse.json(
      { error: msg || "Failed to reschedule booking" },
      { status: 500 }
    );
  }

  // Cancel pending reminder outbox rows
  await supabase
    .from("notification_outbox")
    .update({ status: "cancelled" })
    .eq("booking_id", bookingId)
    .eq("event_type", "REMINDER_NEXT_DAY")
    .eq("status", "pending");

  // Insert BOOKING_UPDATED outbox (ignore idempotency conflict)
  const payload = {
    shopName: shop.name,
    shopSlug: shop.slug,
    timezone: shop.timezone,
    staffName: staff.name,
    serviceName: service.name,
    oldStartAt: booking.start_at,
    oldEndAt: booking.end_at,
    newStartAt,
    newEndAt,
    bookingId,
  };

  const { error: outboxError } = await supabase.from("notification_outbox").insert({
    shop_id: shop.id,
    booking_id: bookingId,
    event_type: "BOOKING_UPDATED",
    channel: "email",
    payload_json: payload,
    idempotency_key: `booking:${bookingId}:updated:${newStartAt}`,
    status: "pending",
  });

  if (outboxError && (outboxError as { code?: string }).code !== "23505") {
    return NextResponse.json(
      { error: outboxError.message ?? "Failed to enqueue update notification" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, bookingId, startAt: newStartAt, endAt: newEndAt, status: "confirmed" },
    { status: 200 }
  );
}
