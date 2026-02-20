import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/requireOwner";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

const BodySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  duration_minutes: z.number().int().min(1, "Duration must be at least 1"),
  price_cents: z.number().int().min(0).nullable().optional(),
});

export async function POST(request: Request) {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return NextResponse.json({ error: "No shop assigned" }, { status: 401 });
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

  const { name, duration_minutes, price_cents } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data: service, error } = await supabase
    .from("services")
    .insert({
      shop_id: activeShopId,
      name: name.trim(),
      duration_minutes,
      price_cents: price_cents ?? null,
      active: true,
    })
    .select("id, name, duration_minutes, price_cents, active")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to create service" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, service }, { status: 201 });
}
