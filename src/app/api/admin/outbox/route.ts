import { NextResponse } from "next/server";
import { createServerSupabaseClientWithServiceRole } from "@/lib/db/supabase.server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const STATUS_VALUES = ["pending", "sent", "failed", "cancelled"] as const;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) {
    return admin;
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const eventTypeParam = url.searchParams.get("eventType")?.trim() || undefined;
  const shopSlugParam = url.searchParams.get("shop")?.trim() || undefined;
  const limitParam = url.searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitParam != null) {
    const n = parseInt(limitParam, 10);
    if (!Number.isNaN(n) && n >= 1) {
      limit = Math.min(n, MAX_LIMIT);
    }
  }

  const status =
    statusParam && STATUS_VALUES.includes(statusParam as (typeof STATUS_VALUES)[number])
      ? (statusParam as (typeof STATUS_VALUES)[number])
      : undefined;

  const supabase = createServerSupabaseClientWithServiceRole();

  let shopId: string | undefined;
  if (shopSlugParam) {
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id")
      .eq("slug", shopSlugParam)
      .maybeSingle();
    if (shopError) {
      return NextResponse.json(
        { error: shopError.message ?? "Failed to resolve shop" },
        { status: 500 }
      );
    }
    if (!shop) {
      return NextResponse.json({ error: "Shop not found", items: [], shops: [] });
    }
    shopId = shop.id;
  }

  let query = supabase
    .from("notification_outbox")
    .select(
      "id, shop_id, booking_id, event_type, status, attempt_count, next_attempt_at, last_error, sent_at, created_at, payload_json"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }
  if (eventTypeParam) {
    query = query.eq("event_type", eventTypeParam);
  }
  if (shopId) {
    query = query.eq("shop_id", shopId);
  }

  const { data: items, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to fetch outbox" },
      { status: 500 }
    );
  }

  const rows = items ?? [];
  const shopIds = [...new Set(rows.map((r) => r.shop_id))];

  let shops: { id: string; slug: string; name: string }[] = [];
  if (shopIds.length > 0) {
    const { data: shopRows } = await supabase
      .from("shops")
      .select("id, slug, name")
      .in("id", shopIds);
    shops = shopRows ?? [];
  }

  const shopMap = Object.fromEntries(shops.map((s) => [s.id, s]));
  const itemsWithShop = rows.map((row) => ({
    ...row,
    shopSlug: shopMap[row.shop_id]?.slug ?? "",
    shopName: shopMap[row.shop_id]?.name ?? "",
  }));

  return NextResponse.json({ items: itemsWithShop, shops });
}
