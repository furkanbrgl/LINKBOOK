import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { ShopSettingsForm } from "./ShopSettingsForm";

export default async function SettingsPage() {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-2 text-neutral-500">No shop assigned.</p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select(
      "id, name, slug, timezone, phone, address, reminder_next_day_enabled, reminder_next_day_send_time_local, is_active"
    )
    .eq("id", activeShopId)
    .single();

  if (shopError || !shop) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-2 text-neutral-500">Shop not found.</p>
      </div>
    );
  }

  const initialShop = {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    timezone: shop.timezone,
    phone: shop.phone,
    address: shop.address,
    reminder_next_day_enabled: shop.reminder_next_day_enabled,
    reminder_next_day_send_time_local: shop.reminder_next_day_send_time_local,
    is_active: shop.is_active,
  };

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Settings</h1>

      {!shop.is_active && (
        <div
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          This shop is inactive. The public booking page is disabled.
        </div>
      )}

      <ShopSettingsForm initialShop={initialShop} />
    </div>
  );
}
