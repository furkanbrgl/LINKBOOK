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
  staffId: z.string().uuid(),
  startAt: isoDatetime,
  endAt: isoDatetime,
  note: z.string().max(500).optional(),
}).refine((d) => DateTime.fromISO(d.endAt) > DateTime.fromISO(d.startAt), {
  message: "endAt must be after startAt",
  path: ["endAt"],
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
  const { staffId, startAt, endAt, note } = parsed.data;

  const supabase = await createServerSupabaseClient();

  const { data: staffRow, error: staffError } = await supabase
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (staffError) {
    return NextResponse.json(
      { error: staffError.message ?? "Failed to fetch staff" },
      { status: 500 }
    );
  }
  if (!staffRow) {
    return NextResponse.json(
      { error: "Staff not found for this shop" },
      { status: 400 }
    );
  }

  const { data: overlapping } = await supabase
    .from("bookings")
    .select("id")
    .eq("shop_id", shopId)
    .eq("staff_id", staffId)
    .eq("status", "confirmed")
    .lt("start_at", endAt)
    .gt("end_at", startAt)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    return NextResponse.json(
      { error: "Block overlaps a confirmed booking" },
      { status: 409 }
    );
  }

  const { data: block, error: insertError } = await supabase
    .from("blocks")
    .insert({
      shop_id: shopId,
      staff_id: staffId,
      start_at: startAt,
      end_at: endAt,
      reason: note ?? null,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message ?? "Failed to create block" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, blockId: block.id },
    { status: 200 }
  );
}
