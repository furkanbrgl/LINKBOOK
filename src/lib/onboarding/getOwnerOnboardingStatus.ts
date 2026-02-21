/**
 * Server-only. Computes onboarding checklist status for the current owner's first shop.
 * Uses requireOwner() and createServerSupabaseClient() (RLS-safe).
 */

import { requireOwner } from "@/lib/auth/requireOwner";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

export type OnboardingItem = {
  key: string;
  label: string;
  done: boolean;
  href: string;
};

export type OwnerOnboardingStatus = {
  total: number;
  done: number;
  items: OnboardingItem[];
  next?: { label: string; href: string };
};

const ITEMS: { key: string; label: string; href: string }[] = [
  { key: "slug", label: "Slug set", href: "/app/settings" },
  { key: "timezone", label: "Timezone set", href: "/app/settings" },
  { key: "phone", label: "Phone set", href: "/app/settings" },
  { key: "staff", label: "At least 1 active staff", href: "/app/settings/staff" },
  { key: "services", label: "At least 1 active service", href: "/app/settings/services" },
  {
    key: "hours",
    label: "Working hours configured (for at least one active staff)",
    href: "/app/settings/hours",
  },
];

export async function getOwnerOnboardingStatus(): Promise<OwnerOnboardingStatus | null> {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return {
      total: ITEMS.length,
      done: 0,
      items: ITEMS.map((item) => ({ ...item, done: false })),
      next: ITEMS[0] ? { label: ITEMS[0].label, href: ITEMS[0].href } : undefined,
    };
  }

  const supabase = await createServerSupabaseClient();

  const [
    { data: shop },
    { data: activeStaff },
    { data: activeServices },
  ] = await Promise.all([
    supabase
      .from("shops")
      .select("slug, timezone, phone")
      .eq("id", activeShopId)
      .maybeSingle(),
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

  const slugOk = Boolean(shop?.slug?.trim());
  const timezoneOk = Boolean(shop?.timezone?.trim());
  const phoneOk =
    shop?.phone != null && String(shop.phone).trim() !== "";
  const staffOk = (activeStaff ?? []).length >= 1;
  const servicesOk = (activeServices ?? []).length >= 1;

  const staffIds = (activeStaff ?? []).map((r: { id: string }) => r.id);
  let workingHoursForActiveStaff = 0;
  if (staffIds.length > 0) {
    const { count } = await supabase
      .from("working_hours")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", activeShopId)
      .in("staff_id", staffIds);
    workingHoursForActiveStaff = count ?? 0;
  }
  const hoursOk = workingHoursForActiveStaff > 0;

  const doneByKey: Record<string, boolean> = {
    slug: slugOk,
    timezone: timezoneOk,
    phone: phoneOk,
    staff: staffOk,
    services: servicesOk,
    hours: hoursOk,
  };

  const items: OnboardingItem[] = ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    done: doneByKey[item.key] ?? false,
    href: item.href,
  }));

  const done = items.filter((i) => i.done).length;
  const firstIncomplete = items.find((i) => !i.done);

  return {
    total: ITEMS.length,
    done,
    items,
    next: firstIncomplete
      ? { label: firstIncomplete.label, href: firstIncomplete.href }
      : undefined,
  };
}
