import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { StaffEditor } from "./StaffEditor";

export default async function SettingsStaffPage() {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Staff</h1>
        <p className="mt-2 text-neutral-500">No shop assigned.</p>
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
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Staff</h1>
        <Link
          href="/settings"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Back to settings
        </Link>
      </div>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Add and edit staff. Deactivate instead of deleting if they have bookings.
      </p>
      <StaffEditor staff={staff} />
    </div>
  );
}
