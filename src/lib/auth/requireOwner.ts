import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

export type RequireOwnerResult = { userId: string; shopIds: string[] };

export type RequireOwnerSingleShopResult =
  | { owner: RequireOwnerResult; shopId: string }
  | NextResponse;

/**
 * Server-only. Uses cookie-backed Supabase client, gets current user, and resolves owned shop IDs.
 * Returns null if not authenticated; otherwise { userId, shopIds }.
 */
export async function requireOwner(): Promise<RequireOwnerResult | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: rows, error: ownerError } = await supabase
    .from("shop_owners")
    .select("shop_id")
    .eq("owner_user_id", user.id);

  if (ownerError) {
    return null;
  }

  const shopIds = [...new Set((rows ?? []).map((r) => r.shop_id))];
  return { userId: user.id, shopIds };
}

/**
 * Server-only. Like requireOwner() but enforces exactly one shop.
 * Returns { owner, shopId } or a NextResponse (401 if no shops, 400 if multiple).
 */
export async function requireOwnerSingleShop(): Promise<RequireOwnerSingleShopResult> {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (owner.shopIds.length === 0) {
    return NextResponse.json({ error: "No shop assigned" }, { status: 401 });
  }
  if (owner.shopIds.length > 1) {
    return NextResponse.json(
      { error: "Multiple shops; single shop required" },
      { status: 400 }
    );
  }
  return { owner, shopId: owner.shopIds[0] };
}
