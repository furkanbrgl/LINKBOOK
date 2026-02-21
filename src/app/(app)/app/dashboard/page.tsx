import Link from "next/link";
import { DateTime } from "luxon";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { getShopLocalDate, getShopDayUtcRange } from "@/lib/time/tz";
import { DayPicker } from "./DayPicker";
import {
  DashboardSchedule,
  type StaffSection,
  type ScheduleItem,
} from "@/components/owner/DashboardSchedule";

type StaffRow = { id: string; name: string; active: boolean };
type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  staff_id: string;
  service_id: string;
  customer_id: string;
  source: string;
};
type BlockRow = {
  id: string;
  start_at: string;
  end_at: string;
  staff_id: string;
  reason: string | null;
};
type ServiceRow = { id: string; name: string; duration_minutes: number };

type DayItem =
  | { type: "booking"; data: BookingRow }
  | { type: "block"; data: BlockRow };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const owner = await requireOwner();
  if (!owner) return null;

  const activeShopId = owner.shopIds[0];
  if (!activeShopId) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-neutral-500">No shop assigned.</p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const params = await searchParams;

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("timezone, slug")
    .eq("id", activeShopId)
    .single();

  if (shopError || !shop) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-neutral-500">Shop not found.</p>
      </div>
    );
  }

  const tz = shop.timezone;
  const shopSlug = shop.slug;
  const now = new Date().toISOString();
  const todayLocal = getShopLocalDate(now, tz);
  const selectedDay = params.day ?? todayLocal;
  const dayDT = DateTime.fromFormat(selectedDay, "yyyy-MM-dd", { zone: tz });
  const prevDay = dayDT.minus({ days: 1 }).toFormat("yyyy-MM-dd");
  const nextDay = dayDT.plus({ days: 1 }).toFormat("yyyy-MM-dd");
  const todayDay = todayLocal;
  const { startUtcISO, endUtcISO } = getShopDayUtcRange(selectedDay, tz);

  const [
    { data: staffList },
    { data: bookings },
    { data: blocks },
    { data: servicesList },
  ] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, active")
      .eq("shop_id", activeShopId)
      .order("name"),
    supabase
      .from("bookings")
      .select("id, start_at, end_at, status, staff_id, service_id, customer_id, source")
      .eq("shop_id", activeShopId)
      .lt("start_at", endUtcISO)
      .gt("end_at", startUtcISO)
      .order("start_at"),
    supabase
      .from("blocks")
      .select("id, start_at, end_at, staff_id, reason")
      .eq("shop_id", activeShopId)
      .lt("start_at", endUtcISO)
      .gt("end_at", startUtcISO)
      .order("start_at"),
    supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("shop_id", activeShopId)
      .eq("active", true)
      .order("name"),
  ]);

  const staff = (staffList ?? []) as StaffRow[];
  const bookingList = (bookings ?? []) as BookingRow[];
  const blockList = (blocks ?? []) as BlockRow[];
  const services = (servicesList ?? []) as ServiceRow[];

  const servicesById = new Map(services.map((s) => [s.id, s]));

  const customerIds = [...new Set(bookingList.map((b) => b.customer_id))];
  let customersById = new Map<
    string,
    { id: string; name: string; phone_e164: string; email: string | null }
  >();
  if (customerIds.length > 0) {
    const { data: customersList } = await supabase
      .from("customers")
      .select("id, name, phone_e164, email")
      .eq("shop_id", activeShopId)
      .in("id", customerIds);
    const rows = (customersList ?? []) as {
      id: string;
      name: string;
      phone_e164: string;
      email: string | null;
    }[];
    customersById = new Map(rows.map((c) => [c.id, c]));
  }

  const byStaff = new Map<string, DayItem[]>();
  for (const s of staff) {
    byStaff.set(s.id, []);
  }
  for (const b of bookingList) {
    const list = byStaff.get(b.staff_id);
    if (list) list.push({ type: "booking", data: b });
  }
  for (const bl of blockList) {
    const list = byStaff.get(bl.staff_id);
    if (list) list.push({ type: "block", data: bl });
  }
  for (const list of byStaff.values()) {
    list.sort((a, b) => a.data.start_at.localeCompare(b.data.start_at));
  }

  const staffSections: StaffSection[] = staff.map((s) => {
    const items: ScheduleItem[] = (byStaff.get(s.id) ?? []).map((item) => {
      if (item.type === "block") {
        const bl = item.data;
        return {
          type: "block" as const,
          id: bl.id,
          start_at: bl.start_at,
          end_at: bl.end_at,
          staff_id: bl.staff_id,
          reason: bl.reason,
        };
      }
      const b = item.data;
      return {
        type: "booking" as const,
        id: b.id,
        start_at: b.start_at,
        end_at: b.end_at,
        status: b.status,
        staff_id: b.staff_id,
        service_id: b.service_id,
        customer_id: b.customer_id,
        source: b.source,
        serviceName: servicesById.get(b.service_id)?.name ?? "—",
        staffName: s.name,
        customer: customersById.get(b.customer_id) ?? null,
      };
    });
    return {
      staffId: s.id,
      staffName: s.name,
      staffActive: s.active,
      items,
    };
  });

  return (
    <div className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Day
          </label>
          <Link
            href={`/app/dashboard?day=${prevDay}`}
            className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
          >
            Prev
          </Link>
          <Link
            href={`/app/dashboard?day=${todayDay}`}
            className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
          >
            Today
          </Link>
          <Link
            href={`/app/dashboard?day=${nextDay}`}
            className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
          >
            Next
          </Link>
          <DayPicker day={selectedDay} />
        </div>
      </div>

      <DashboardSchedule
        staffSections={staffSections}
        services={services}
        shopSlug={shopSlug}
        timezone={tz}
        selectedDay={selectedDay}
      />
    </div>
  );
}
