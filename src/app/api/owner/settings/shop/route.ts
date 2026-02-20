import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/requireOwner";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

const slugRegex = /^[a-z0-9-]+$/;

function normalizeReminderTime(s: string): string | null {
  const trimmed = s.trim();
  // HH:MM or HH:MM:SS
  const twoPart = /^(\d{1,2}):(\d{2})$/;
  const threePart = /^(\d{1,2}):(\d{2}):(\d{2})$/;
  const m2 = trimmed.match(twoPart);
  const m3 = trimmed.match(threePart);
  if (m2) {
    const h = Math.max(0, Math.min(23, parseInt(m2[1], 10)));
    const min = Math.max(0, Math.min(59, parseInt(m2[2], 10)));
    return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:00`;
  }
  if (m3) {
    const h = Math.max(0, Math.min(23, parseInt(m3[1], 10)));
    const min = Math.max(0, Math.min(59, parseInt(m3[2], 10)));
    const sec = Math.max(0, Math.min(59, parseInt(m3[3], 10)));
    return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }
  return null;
}

const BodySchema = z
  .object({
    shopId: z.string().uuid(),
    name: z.string().min(1, "Name is required"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .refine((s) => slugRegex.test(s.toLowerCase()), {
        message: "Slug must be lowercase letters, numbers, and hyphens only",
      }),
    timezone: z.string().min(1, "Timezone is required"),
    phone: z.string().max(32).nullable().optional(),
    address: z.string().nullable().optional(),
    reminder_next_day_enabled: z.boolean(),
    reminder_next_day_send_time_local: z
      .string()
      .min(1)
      .refine((s) => normalizeReminderTime(s) != null, {
        message: "Invalid time; use HH:MM or HH:MM:SS",
      }),
  })
  .transform((d) => ({
    ...d,
    slug: d.slug.toLowerCase().trim(),
    reminder_next_day_send_time_local: normalizeReminderTime(
      d.reminder_next_day_send_time_local
    )!,
  }));

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

  const { shopId, ...data } = parsed.data;

  if (!owner.shopIds.includes(shopId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: updated, error: updateError } = await supabase
    .from("shops")
    .update({
      name: data.name,
      slug: data.slug,
      timezone: data.timezone,
      phone: data.phone ?? null,
      address: data.address ?? null,
      reminder_next_day_enabled: data.reminder_next_day_enabled,
      reminder_next_day_send_time_local: data.reminder_next_day_send_time_local,
      updated_at: new Date().toISOString(),
    })
    .eq("id", shopId)
    .select("id, slug")
    .maybeSingle();

  if (updateError) {
    const code = (updateError as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update shop" },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Shop not found or access denied" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { ok: true, shopId: updated.id, slug: updated.slug },
    { status: 200 }
  );
}
