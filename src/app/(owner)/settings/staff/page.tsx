import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { SettingsNav } from "../SettingsNav";
import { StaffEditor } from "./StaffEditor";

export default async function SettingsStaffPage() {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Staff</h1>
        <div className="mt-3">
          <SettingsNav currentPath="/settings/staff" />
        </div>
        <p className="mt-3 text-neutral-500">No shop assigned.</p>
      </div>
    );
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
    <div className="p-8">
      <h1 className="text-xl font-semibold">Staff</h1>
      <div className="mt-3">
        <SettingsNav currentPath="/settings/staff" />
      </div>
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        Add and edit staff. Deactivate instead of deleting if they have bookings.
      </p>
      <StaffEditor staff={staff} />
    </div>
  );
}
