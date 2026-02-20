import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { HoursEditor } from "./HoursEditor";

export default async function SettingsHoursPage() {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Working hours</h1>
        <p className="mt-2 text-neutral-500">No shop assigned.</p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();

  const [
    { data: staffList },
    { data: hoursList },
  ] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, active")
      .eq("shop_id", activeShopId)
      .order("name"),
    supabase
      .from("working_hours")
      .select("id, staff_id, day_of_week, start_local, end_local")
      .eq("shop_id", activeShopId),
  ]);

  const staff = (staffList ?? []) as { id: string; name: string; active: boolean }[];
  const hours = (hoursList ?? []) as {
    id: string;
    staff_id: string;
    day_of_week: number;
    start_local: string;
    end_local: string;
  }[];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Working hours</h1>
        <Link
          href="/settings"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Back to settings
        </Link>
      </div>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Set weekly hours per staff. Days left closed have no availability.
      </p>
      <HoursEditor staff={staff} initialHours={hours} shopId={activeShopId} />
    </div>
  );
}
