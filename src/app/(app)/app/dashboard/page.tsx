import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { getShopLocalDate, getShopDayUtcRange, formatShopLocal } from "@/lib/time/tz";
import { DayPicker } from "./DayPicker";
import { BookingActions, StaffActions } from "./OwnerActions";

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

function isCancelled(status: string): boolean {
  return status.startsWith("cancelled");
}

function formatCustomerLine(c: {
  name: string;
  phone_e164: string;
  email: string | null;
}): string {
  const parts = [c.name];
  if (c.phone_e164 && !c.phone_e164.startsWith("+walkin")) {
    parts.push(c.phone_e164);
  }
  if (c.email && c.email.trim()) parts.push(c.email);
  return parts.join(" • ");
}

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

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Day
          </label>
          <DayPicker day={selectedDay} />
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {staff.map((s) => {
          const items = byStaff.get(s.id) ?? [];
          return (
            <section key={s.id} className="rounded-lg border border-neutral-200 dark:border-neutral-700">
              <h2 className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-800">
                {s.name}
                {!s.active && (
                  <span className="ml-2 text-neutral-500">(inactive)</span>
                )}
                <StaffActions
                  staffId={s.id}
                  services={services}
                  shopSlug={shopSlug}
                  timezone={tz}
                  selectedDay={selectedDay}
                />
              </h2>
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {items.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-neutral-500">
                    No bookings or blocks
                  </li>
                ) : (
                  items.map((item) => {
                    if (item.type === "booking") {
                      const b = item.data;
                      const cancelled = isCancelled(b.status);
                      const serviceName =
                        servicesById.get(b.service_id)?.name ?? "—";
                      const sourceLabel =
                        b.source === "walk_in" ? "Walk-in" : "Customer";
                      const customer = customersById.get(b.customer_id);
                      return (
                        <li
                          key={`b-${b.id}`}
                          className={`px-4 py-2 text-sm ${
                            cancelled
                              ? "text-neutral-400 line-through dark:text-neutral-500"
                              : ""
                          }`}
                        >
                          <span className="font-mono text-neutral-600 dark:text-neutral-400">
                            {formatShopLocal(b.start_at, tz, "HH:mm")}–
                            {formatShopLocal(b.end_at, tz, "HH:mm")}
                          </span>{" "}
                          {serviceName} •{" "}
                          {cancelled ? `(${b.status})` : b.status}{" "}
                          <span
                            className={
                              b.source === "walk_in"
                                ? "inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                : "inline-flex rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
                            }
                          >
                            {sourceLabel}
                          </span>
                          <BookingActions
                            bookingId={b.id}
                            status={b.status}
                            staffId={b.staff_id}
                            serviceId={b.service_id}
                            shopSlug={shopSlug}
                            timezone={tz}
                            selectedDay={selectedDay}
                          />
                          {customer && (
                            <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                              {formatCustomerLine(customer)}
                            </div>
                          )}
                        </li>
                      );
                    }
                    const bl = item.data;
                    return (
                      <li
                        key={`bl-${bl.id}`}
                        className="px-4 py-2 text-sm text-amber-700 dark:text-amber-400"
                      >
                        <span className="font-mono">
                          {formatShopLocal(bl.start_at, tz, "HH:mm")}–
                          {formatShopLocal(bl.end_at, tz, "HH:mm")}
                        </span>{" "}
                        Block {bl.reason ? `— ${bl.reason}` : ""}
                      </li>
                    );
                  })
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
