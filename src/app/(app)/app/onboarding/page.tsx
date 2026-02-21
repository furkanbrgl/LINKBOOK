import Link from "next/link";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { OnboardingShareCard } from "./OnboardingShareCard";

type ChecklistItem = {
  label: string;
  done: boolean;
  fixHref: string;
};

export default async function OnboardingPage() {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Onboarding</h1>
        <p className="mt-2 text-neutral-500">No shop assigned.</p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();

  const [
    { data: shop },
    { data: activeStaff },
    { data: activeServices },
  ] = await Promise.all([
    supabase
      .from("shops")
      .select("id, slug, timezone, phone")
      .eq("id", activeShopId)
      .single(),
    supabase
      .from("staff")
      .select("id")
      .eq("shop_id", activeShopId)
      .eq("active", true),
    supabase
      .from("services")
      .select("id")
      .eq("shop_id", activeShopId)
      .eq("active", true),
  ]);

  if (!shop) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Onboarding</h1>
        <p className="mt-2 text-neutral-500">Shop not found.</p>
      </div>
    );
  }

  const staffIds = (activeStaff ?? []).map((s: { id: string }) => s.id);
  let workingHoursForActiveStaff = 0;
  if (staffIds.length > 0) {
    const { count } = await supabase
      .from("working_hours")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", activeShopId)
      .in("staff_id", staffIds);
    workingHoursForActiveStaff = count ?? 0;
  }

  const slugOk = Boolean(shop?.slug?.trim());
  const timezoneOk = Boolean(shop?.timezone?.trim());
  const phoneOk = Boolean(shop?.phone != null && String(shop.phone).trim() !== "");
  const staffOk = (activeStaff ?? []).length >= 1;
  const servicesOk = (activeServices ?? []).length >= 1;
  const hoursOk = workingHoursForActiveStaff > 0;

  const items: ChecklistItem[] = [
    { label: "Slug set", done: slugOk, fixHref: "/app/settings" },
    { label: "Timezone set", done: timezoneOk, fixHref: "/app/settings" },
    { label: "Phone set", done: phoneOk, fixHref: "/app/settings" },
    { label: "At least 1 active staff", done: staffOk, fixHref: "/app/settings/staff" },
    { label: "At least 1 active service", done: servicesOk, fixHref: "/app/settings/services" },
    {
      label: "Working hours configured (for at least one active staff)",
      done: hoursOk,
      fixHref: "/app/settings/hours",
    },
  ];

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : null;
  const publicPath = shop.slug?.trim() ? `/${shop.slug.trim()}` : "/";
  const absolutePublicUrl = origin ? `${origin}${publicPath}` : null;

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Onboarding</h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Complete these steps so customers can book.
      </p>

      <ul className="mt-6 space-y-2" role="list">
        {items.map((item) => (
          <li
            key={item.label}
            className={`flex items-center gap-2 text-sm ${
              item.done
                ? "text-green-700 dark:text-green-400"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                item.done ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-600"
              }`}
              aria-hidden
            />
            <span>{item.label}</span>
            {!item.done && (
              <Link
                href={item.fixHref}
                className="ml-1 text-neutral-700 underline hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
              >
                Fix
              </Link>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-8 max-w-md">
        <OnboardingShareCard
          publicPath={publicPath}
          absolutePublicUrl={absolutePublicUrl}
        />
      </div>
    </div>
  );
}
