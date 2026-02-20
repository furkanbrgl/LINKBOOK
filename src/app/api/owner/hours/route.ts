import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/requireOwner";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

const timeRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
function normalizeTime(s: string): string | null {
  const m = s.trim().match(timeRegex);
  if (!m) return null;
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const min = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  const sec = m[3] != null ? Math.max(0, Math.min(59, parseInt(m[3], 10))) : 0;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

const DaySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  closed: z.boolean(),
  startLocal: z.string().optional(),
  endLocal: z.string().optional(),
});

const BodySchema = z.object({
  staffId: z.string().uuid(),
  days: z.array(DaySchema),
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

  const { staffId, days } = parsed.data;

  const supabase = await createServerSupabaseClient();

  const { data: staffRow, error: staffError } = await supabase
    .from("staff")
    .select("id, shop_id")
    .eq("id", staffId)
    .maybeSingle();

  if (staffError) {
    return NextResponse.json(
      { error: staffError.message ?? "Failed to fetch staff" },
      { status: 500 }
    );
  }
  if (!staffRow || !owner.shopIds.includes(staffRow.shop_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const shopId = staffRow.shop_id;

  for (const day of days) {
    if (day.closed) {
      await supabase
        .from("working_hours")
        .delete()
        .eq("shop_id", shopId)
        .eq("staff_id", staffId)
        .eq("day_of_week", day.dayOfWeek);
      continue;
    }

    const startStr = day.startLocal ?? "09:00";
    const endStr = day.endLocal ?? "17:00";
    const startLocal = normalizeTime(startStr);
    const endLocal = normalizeTime(endStr);
    if (!startLocal || !endLocal) {
      return NextResponse.json(
        { error: "Invalid time; use HH:MM or HH:MM:SS" },
        { status: 400 }
      );
    }
    if (startLocal >= endLocal) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    await supabase
      .from("working_hours")
      .delete()
      .eq("shop_id", shopId)
      .eq("staff_id", staffId)
      .eq("day_of_week", day.dayOfWeek);

    const { error: insertError } = await supabase
      .from("working_hours")
      .insert({
        shop_id: shopId,
        staff_id: staffId,
        day_of_week: day.dayOfWeek,
        start_local: startLocal,
        end_local: endLocal,
      });

    if (insertError) {
      const msg = insertError.message ?? "";
      if (
        msg.includes("end") ||
        msg.includes("start") ||
        msg.includes("check") ||
        (insertError as { code?: string }).code === "23514"
      ) {
        return NextResponse.json(
          { error: "End time must be after start time" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: insertError.message ?? "Failed to save hours" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
