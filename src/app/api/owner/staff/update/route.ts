import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/requireOwner";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

const BodySchema = z.object({
  staffId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
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

  const { staffId, name, active } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data: staffRow, error: fetchError } = await supabase
    .from("staff")
    .select("id, shop_id")
    .eq("id", staffId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message ?? "Failed to fetch staff" },
      { status: 500 }
    );
  }
  if (!staffRow || !owner.shopIds.includes(staffRow.shop_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: { name?: string; active?: boolean; updated_at?: string } = {};
  if (name !== undefined) updates.name = name.trim();
  if (active !== undefined) updates.active = active;
  updates.updated_at = new Date().toISOString();

  if (name === undefined && active === undefined) {
    return NextResponse.json(
      { error: "Provide name or active to update" },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("staff")
    .update(updates)
    .eq("id", staffId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update staff" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
