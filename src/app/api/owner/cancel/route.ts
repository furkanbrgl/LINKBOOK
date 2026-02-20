import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerSingleShop } from "@/lib/auth/requireOwner";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

const BodySchema = z.object({ bookingId: z.string().uuid() });

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
  const { bookingId } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message ?? "Failed to fetch booking" },
      { status: 500 }
    );
  }
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (
    booking.status === "cancelled_by_customer" ||
    booking.status === "cancelled_by_shop"
  ) {
    return NextResponse.json(
      { ok: true, bookingId, status: booking.status },
      { status: 200 }
    );
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: "cancelled_by_shop" })
    .eq("id", bookingId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to cancel booking" },
      { status: 500 }
    );
  }

  await supabase
    .from("notification_outbox")
    .update({ status: "cancelled" })
    .eq("booking_id", bookingId)
    .eq("event_type", "REMINDER_NEXT_DAY")
    .eq("status", "pending");

  const { error: outboxError } = await supabase
    .from("notification_outbox")
    .insert({
      shop_id: shopId,
      booking_id: bookingId,
      event_type: "BOOKING_CANCELLED",
      channel: "email",
      payload_json: { by: "shop" },
      idempotency_key: `booking:${bookingId}:cancelled_by_shop`,
      status: "pending",
    });

  if (outboxError && (outboxError as { code?: string }).code !== "23505") {
    return NextResponse.json(
      {
        error:
          outboxError.message ?? "Failed to enqueue cancellation notification",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, bookingId, status: "cancelled_by_shop" },
    { status: 200 }
  );
}
