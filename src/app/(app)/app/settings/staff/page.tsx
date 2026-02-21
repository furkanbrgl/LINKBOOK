import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { StaffEditor } from "./StaffEditor";

export default async function SettingsStaffPage() {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return <p className="text-neutral-500">No shop assigned.</p>;
  }

  const supabase = await createServerSupabaseClient();
  const { data: staffList } = await supabase
    .from("staff")
    .select("id, name, active, created_at, updated_at")
    .eq("shop_id", activeShopId)
    .order("name");

  const staff = (staffList ?? []) as {
    id: string;
    name: string;
    active: boolean;
    created_at: string;
    updated_at: string;
  }[];

  return (
    <>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Add and edit staff. Deactivate instead of deleting if they have bookings.
      </p>
      <StaffEditor staff={staff} />
    </>
  );
}
