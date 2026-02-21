import { redirect } from "next/navigation";
import { getTemplateForShop } from "@/lib/templates";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

export type OwnerShopContext = {
  userId: string;
  shop: {
    id: string;
    name: string;
    slug: string;
    industry_template: string;
    branding: unknown | null;
    template_overrides: unknown | null;
  };
  template: ReturnType<typeof getTemplateForShop>["template"];
  branding: ReturnType<typeof getTemplateForShop>["branding"];
};

export async function requireOwnerShop(): Promise<OwnerShopContext> {
  const supabase = await createServerSupabaseClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    redirect("/login");
  }
  const userId = auth.user.id;

  const { data: ownerRow, error: ownerErr } = await supabase
    .from("shop_owners")
    .select("shop_id")
    .eq("owner_user_id", userId)
    .limit(1)
    .maybeSingle();

  if (ownerErr || !ownerRow?.shop_id) {
    redirect("/login");
  }

  const { data: shop, error: shopErr } = await supabase
    .from("shops")
    .select("id,name,slug,industry_template,branding,template_overrides")
    .eq("id", ownerRow.shop_id)
    .single();

  if (shopErr || !shop) {
    redirect("/login");
  }

  const merged = getTemplateForShop(shop);

  return {
    userId,
    shop,
    template: merged.template,
    branding: merged.branding,
  };
}
