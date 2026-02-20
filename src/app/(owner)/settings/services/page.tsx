import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { ServicesEditor } from "./ServicesEditor";

export default async function SettingsServicesPage() {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return <p className="text-neutral-500">No shop assigned.</p>;
  }

  const supabase = await createServerSupabaseClient();
  const { data: servicesList } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_cents, active")
    .eq("shop_id", activeShopId)
    .order("name");

  const services = (servicesList ?? []) as {
    id: string;
    name: string;
    duration_minutes: number;
    price_cents: number | null;
    active: boolean;
  }[];

  return (
    <>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Add and edit services. Deactivate instead of deleting if they have bookings.
      </p>
      <ServicesEditor services={services} />
    </>
  );
}
