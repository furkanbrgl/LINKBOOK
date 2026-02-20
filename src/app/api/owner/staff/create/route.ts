import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/requireOwner";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

const BodySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
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

  const supabase = await createServerSupabaseClient();
  const { data: staff, error } = await supabase
    .from("staff")
    .insert({
      shop_id: activeShopId,
      name: parsed.data.name.trim(),
      active: true,
    })
    .select("id, name, active")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to create staff" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, staff }, { status: 201 });
}
