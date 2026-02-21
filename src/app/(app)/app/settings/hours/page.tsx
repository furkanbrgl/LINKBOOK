import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { HoursEditor } from "./HoursEditor";

export default async function SettingsHoursPage() {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return <p className="text-neutral-500">No shop assigned.</p>;
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
    <>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Set weekly hours per staff. Days left closed have no availability.
      </p>
      <HoursEditor staff={staff} initialHours={hours} shopId={activeShopId} />
    </>
  );
}
