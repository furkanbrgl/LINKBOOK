import { NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { requireOwnerSingleShop } from "@/lib/auth/requireOwner";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

const isoDatetime = z
  .string()
  .refine((s) => DateTime.fromISO(s, { zone: "utc" }).isValid, {
    message: "Invalid ISO datetime",
  });
const BodySchema = z.object({
  bookingId: z.string().uuid(),
  newStartAt: isoDatetime,
});

export async function POST(request: Request) {
  const resolved = await requireOwnerSingleShop();
  if (resolved instanceof NextResponse) return resolved;
  const { shopId } = resolved;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { bookingId, newStartAt } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data: booking, error: bookError } = await supabase
    .from("bookings")
    .select("id, shop_id, staff_id, service_id, status, start_at")
    .eq("id", bookingId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (bookError) {
    return NextResponse.json(
      { error: bookError.message ?? "Failed to fetch booking" },
      { status: 500 }
    );
  }
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "confirmed") {
    return NextResponse.json(
      { error: "Only confirmed bookings can be moved" },
      { status: 400 }
    );
  }

  const { data: service, error: svcError } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", booking.service_id)
    .eq("shop_id", shopId)
    .single();

  if (svcError || !service) {
    return NextResponse.json(
      { error: "Service not found" },
      { status: 404 }
    );
  }

  const newStartAtDt = DateTime.fromISO(newStartAt, { zone: "utc" });
  const newEndAtDt = newStartAtDt.plus({
    minutes: service.duration_minutes,
  });
  const newEndAt = newEndAtDt.toISO();
  if (!newEndAt) {
    return NextResponse.json(
      { error: "Invalid datetime" },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ start_at: newStartAt, end_at: newEndAt })
    .eq("id", bookingId);

  if (updateError) {
    const code = (updateError as { code?: string }).code;
    const msg = updateError.message ?? "";
    const isOverlap =
      code === "23P01" ||
      msg.includes("bookings_no_overlap_confirmed") ||
      msg.includes("conflicts with existing key");
    if (isOverlap) {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    return NextResponse.json(
      { error: msg || "Failed to move booking" },
      { status: 500 }
    );
  }

  await supabase
    .from("notification_outbox")
    .update({ status: "cancelled" })
    .eq("booking_id", bookingId)
    .eq("event_type", "REMINDER_NEXT_DAY")
    .eq("status", "pending");

  const payload = {
    by: "shop",
    oldStartAt: booking.start_at,
    newStartAt,
  };
  await supabase.from("notification_outbox").insert({
    shop_id: shopId,
    booking_id: bookingId,
    event_type: "BOOKING_UPDATED",
    channel: "email",
    payload_json: payload,
    idempotency_key: `booking:${bookingId}:moved_by_shop`,
    status: "pending",
  });

  return NextResponse.json(
    {
      ok: true,
      bookingId,
      startAt: newStartAt,
      endAt: newEndAt,
    },
    { status: 200 }
  );
}
