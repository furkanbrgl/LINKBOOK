import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { SettingsNav } from "../SettingsNav";
import { ServicesEditor } from "./ServicesEditor";

export default async function SettingsServicesPage() {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Services</h1>
        <div className="mt-3">
          <SettingsNav currentPath="/settings/services" />
        </div>
        <p className="mt-3 text-neutral-500">No shop assigned.</p>
      </div>
    );
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
    <div className="p-8">
      <h1 className="text-xl font-semibold">Services</h1>
      <div className="mt-3">
        <SettingsNav currentPath="/settings/services" />
      </div>
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        Add and edit services. Deactivate instead of deleting if they have bookings.
      </p>
      <ServicesEditor services={services} />
    </div>
  );
}
