import { NextResponse } from "next/server";
import { resolveManageToken } from "@/lib/security/resolveManageToken";
import { createServerSupabaseClientWithServiceRole } from "@/lib/db/supabase.server";
import { getClientIp, makeKey, rateLimit } from "@/lib/rate-limit/limiter";

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/manage/cancel" });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const token = typeof body === "object" && body !== null && "token" in body
    ? (body as { token: unknown }).token
    : undefined;

  if (typeof token !== "string" || token.length < 20) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const ip = getClientIp(request);
  const rl = await rateLimit(makeKey(["manage_cancel", ip]), {
    name: "manage_cancel",
    limit: 10,
    window: "1 m",
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const resolved = await resolveManageToken(token);
  if (!resolved) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const { booking, shop, staff, service } = resolved;
  const bookingId = booking.id;

  // Idempotency: already cancelled
  if (booking.status === "cancelled_by_customer" || booking.status === "cancelled_by_shop") {
    return NextResponse.json({ ok: true, bookingId, status: booking.status }, { status: 200 });
  }

  const supabase = createServerSupabaseClientWithServiceRole();

  // 1) Update booking status
  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: "cancelled_by_customer" })
    .eq("id", bookingId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to cancel booking" },
      { status: 500 }
    );
  }

  // 2) Cancel pending reminder outbox rows
  await supabase
    .from("notification_outbox")
    .update({ status: "cancelled" })
    .eq("booking_id", bookingId)
    .eq("event_type", "REMINDER_NEXT_DAY")
    .eq("status", "pending");

  // 3) Insert BOOKING_CANCELLED outbox (ignore idempotency conflict)
  const payload = {
    shopName: shop.name,
    shopSlug: shop.slug,
    timezone: shop.timezone,
    staffName: staff.name,
    serviceName: service.name,
    startAt: booking.start_at,
    endAt: booking.end_at,
    bookingId,
    cancelReason: "customer",
  };

  const { error: outboxError } = await supabase.from("notification_outbox").insert({
    shop_id: shop.id,
    booking_id: bookingId,
    event_type: "BOOKING_CANCELLED",
    channel: "email",
    payload_json: payload,
    idempotency_key: `booking:${bookingId}:cancelled_by_customer`,
    status: "pending",
  });

  // 23505 = unique_violation; ignore conflict on idempotency_key
  if (outboxError && (outboxError as { code?: string }).code !== "23505") {
    return NextResponse.json(
      { error: outboxError.message ?? "Failed to enqueue cancellation notification" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, bookingId, status: "cancelled_by_customer" },
    { status: 200 }
  );
}
