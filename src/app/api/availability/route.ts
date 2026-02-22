import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClientWithServiceRole } from "@/lib/db/supabase.server";
import { formatShopLocal, getShopLocalDate } from "@/lib/time/tz";
import { getClientIp, makeKey, rateLimit } from "@/lib/rate-limit/limiter";

const querySchema = z.object({
  shop: z.string().min(1),
  staffId: z.union([z.literal("any"), z.string().uuid()]),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    shop: url.searchParams.get("shop") ?? undefined,
    staffId: url.searchParams.get("staffId") ?? undefined,
    serviceId: url.searchParams.get("serviceId") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { shop, staffId, serviceId, date } = parsed.data;

  const ip = getClientIp(request);
  const key = makeKey(["avail", shop, ip]);
  const rl = await rateLimit(key, { name: "availability", limit: 60, window: "1 m" });
  if (!rl.ok) {
    const retryAfterSec = Math.max(0, Math.ceil((rl.reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.reset),
        },
      }
    );
  }

  // Using service role here (Option A) to avoid public RLS policies for v1; endpoint still validates by slug/staff/service and returns only slots.
  const supabase = createServerSupabaseClientWithServiceRole();

  // Fetch shop timezone and id (must be active)
  const { data: shopRow, error: shopError } = await supabase
    .from("shops")
    .select("id, timezone")
    .eq("slug", shop)
    .eq("is_active", true)
    .maybeSingle();

  if (shopError) {
    return NextResponse.json(
      { error: shopError.message ?? "Failed to fetch shop" },
      { status: 500 }
    );
  }

  if (!shopRow) {
    return NextResponse.json(
      { error: "Shop not found or inactive" },
      { status: 404 }
    );
  }

  const { id: shopId, timezone: tz } = shopRow;

  let slots: { slot_start_at: string }[];

  if (staffId === "any") {
    const { data: staffRows } = await supabase
      .from("staff")
      .select("id")
      .eq("shop_id", shopId)
      .eq("active", true);
    const activeStaffIds = (staffRows ?? []).map((r) => r.id);

    const serviceCheck = await supabase
      .from("services")
      .select("id")
      .eq("id", serviceId)
      .eq("shop_id", shopId)
      .eq("active", true)
      .maybeSingle();
    if (serviceCheck.error || !serviceCheck.data) {
      return NextResponse.json(
        { error: "Invalid service for this shop" },
        { status: 400 }
      );
    }

    const slotMap = new Map<string, { startAt: string; labelLocal: string }>();
    for (const sid of activeStaffIds) {
      const { data: rpcRows } = await supabase.rpc("rpc_get_availability", {
        p_shop_slug: shop,
        p_staff_id: sid,
        p_service_id: serviceId,
        p_day_local: date,
      });
      const rows = (rpcRows ?? []) as { slot_start_at: string }[];
      for (const row of rows) {
        const startAt = row.slot_start_at;
        if (!slotMap.has(startAt)) {
          slotMap.set(startAt, {
            startAt,
            labelLocal: formatShopLocal(startAt, tz, "HH:mm"),
          });
        }
      }
    }
    slots = Array.from(slotMap.values())
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((s) => ({ slot_start_at: s.startAt }));
  } else {
    const { data: rpcRows, error: rpcError } = await supabase.rpc(
      "rpc_get_availability",
      {
        p_shop_slug: shop,
        p_staff_id: staffId,
        p_service_id: serviceId,
        p_day_local: date,
      }
    );

    if (rpcError) {
      return NextResponse.json(
        { error: rpcError.message ?? "Availability lookup failed" },
        { status: 500 }
      );
    }

    slots = (rpcRows ?? []) as { slot_start_at: string }[];

    if (slots.length === 0) {
      const [staffRes, serviceRes] = await Promise.all([
        supabase
          .from("staff")
          .select("id")
          .eq("id", staffId)
          .eq("shop_id", shopId)
          .eq("active", true)
          .maybeSingle(),
        supabase
          .from("services")
          .select("id")
          .eq("id", serviceId)
          .eq("shop_id", shopId)
          .eq("active", true)
          .maybeSingle(),
      ]);

      if (staffRes.error || serviceRes.error) {
        return NextResponse.json(
          { error: "Failed to validate staff or service" },
          { status: 500 }
        );
      }
      if (!staffRes.data || !serviceRes.data) {
        return NextResponse.json(
          { error: "Invalid staff or service for this shop" },
          { status: 400 }
        );
      }
      return NextResponse.json({ slots: [] });
    }
  }

  let result = slots.map((row) => ({
    startAt: row.slot_start_at,
    labelLocal: formatShopLocal(row.slot_start_at, tz, "HH:mm"),
  }));

  const nowUtc = new Date().toISOString();
  const todayLocal = getShopLocalDate(nowUtc, tz);
  if (date === todayLocal) {
    result = result.filter((s) => s.startAt > nowUtc);
  }

  return NextResponse.json({ slots: result });
}
