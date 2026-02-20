import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/requireOwner";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

const BodySchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  duration_minutes: z.number().int().min(1).optional(),
  price_cents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { serviceId, name, duration_minutes, price_cents, active } =
    parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data: serviceRow, error: fetchError } = await supabase
    .from("services")
    .select("id, shop_id")
    .eq("id", serviceId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message ?? "Failed to fetch service" },
      { status: 500 }
    );
  }
  if (!serviceRow || !owner.shopIds.includes(serviceRow.shop_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: {
    name?: string;
    duration_minutes?: number;
    price_cents?: number | null;
    active?: boolean;
  } = {};
  if (name !== undefined) updates.name = name.trim();
  if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
  if (price_cents !== undefined) updates.price_cents = price_cents;
  if (active !== undefined) updates.active = active;

  if (
    name === undefined &&
    duration_minutes === undefined &&
    price_cents === undefined &&
    active === undefined
  ) {
    return NextResponse.json(
      { error: "Provide at least one field to update" },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("services")
    .update(updates)
    .eq("id", serviceId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update service" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
