import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { ServicesEditor } from "./ServicesEditor";

export default async function SettingsServicesPage() {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Services</h1>
        <p className="mt-2 text-neutral-500">No shop assigned.</p>
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
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Services</h1>
        <Link
          href="/settings"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Back to settings
        </Link>
      </div>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Add and edit services. Deactivate instead of deleting if they have bookings.
      </p>
      <ServicesEditor services={services} />
    </div>
  );
}
