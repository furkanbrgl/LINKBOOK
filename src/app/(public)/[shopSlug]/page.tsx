import { createServerSupabaseClientWithAnon } from "@/lib/db/supabase.server";
import { getShopLocalDate } from "@/lib/time/tz";
import { getTemplateForShop } from "@/lib/templates";
import { BookingWizard } from "./BookingWizard";

export default async function ShopPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = createServerSupabaseClientWithAnon();

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id, name, slug, timezone, phone, industry_template, branding, template_overrides")
    .eq("slug", shopSlug)
    .maybeSingle();

  if (shopError || !shop) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6 flex items-center justify-center">
        <p className="text-zinc-600">Shop not found or inactive.</p>
      </div>
    );
  }

  // Optional: if your schema has is_active on shops, add it to the select and:
  // if (shop.is_active === false) return the same not-found UI above.

  const { template, branding } = getTemplateForShop(shop);

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
      <header className="p-4 sm:p-6 max-w-md mx-auto text-center">
        <h1 className="text-xl font-semibold text-zinc-800">
          {template.bookingCopy.heroTitle}
        </h1>
        {template.bookingCopy.heroSubtitle && (
          <p className="mt-1 text-sm text-zinc-600">
            {template.bookingCopy.heroSubtitle}
          </p>
        )}
      </header>
      <BookingWizard
        shop={{ id: shop.id, name: shop.name, slug: shop.slug, timezone: shop.timezone, phone: shop.phone }}
        services={services}
        staff={staff}
        minDate={minDate}
        template={template}
        branding={branding}
      />
    </div>
  );
}
