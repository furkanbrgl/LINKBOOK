import { createServerSupabaseClientWithServiceRole } from "@/lib/db/supabase.server";
import { getShopLocalDate } from "@/lib/time/tz";
import { BookingWizard } from "./BookingWizard";

export default async function ShopPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = createServerSupabaseClientWithServiceRole();

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id, name, slug, timezone, phone, is_active")
    .eq("slug", shopSlug)
    .maybeSingle();

  if (shopError || !shop || !shop.is_active) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6 flex items-center justify-center">
        <p className="text-zinc-600">Shop not found or inactive.</p>
      </div>
    );
  }

  const [servicesRes, staffRes] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("staff")
      .select("id, name")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .order("name"),
  ]);

  const services = servicesRes.data ?? [];
  const staff = staffRes.data ?? [];
  const minDate = getShopLocalDate(new Date().toISOString(), shop.timezone);

  return (
    <div className="min-h-screen bg-zinc-50">
      <BookingWizard
        shop={{ id: shop.id, name: shop.name, slug: shop.slug, timezone: shop.timezone, phone: shop.phone }}
        services={services}
        staff={staff}
        minDate={minDate}
      />
    </div>
  );
}
