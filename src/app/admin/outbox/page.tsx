import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createServerSupabaseClientWithServiceRole } from "@/lib/db/supabase.server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { OutboxRetryButton } from "./OutboxRetryButton";

const STATUS_VALUES = ["pending", "sent", "failed", "cancelled"] as const;
const LIMIT = 50;

type SearchParams = Promise<{ status?: string; eventType?: string; shop?: string }>;

export default async function AdminOutboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = await requireAdmin({ redirect: true });
  if (admin && typeof admin === "object" && "redirect" in admin && admin.redirect) {
    redirect("/login");
  }
  if (admin instanceof NextResponse) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-semibold text-zinc-800">Admin Outbox</h1>
        <p className="mt-2 text-red-600">Access denied</p>
      </div>
    );
  }

  const params = await searchParams;
  const statusParam =
    params.status && STATUS_VALUES.includes(params.status as (typeof STATUS_VALUES)[number])
      ? (params.status as (typeof STATUS_VALUES)[number])
      : undefined;
  const eventTypeParam = params.eventType?.trim() || undefined;
  const shopSlugParam = params.shop?.trim() || undefined;

  const supabase = createServerSupabaseClientWithServiceRole();

  let shopId: string | undefined;
  if (shopSlugParam) {
    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .eq("slug", shopSlugParam)
      .maybeSingle();
    shopId = shop?.id;
  }

  let query = supabase
    .from("notification_outbox")
    .select(
      "id, shop_id, booking_id, event_type, status, attempt_count, next_attempt_at, last_error, sent_at, created_at, payload_json"
    )
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (statusParam) query = query.eq("status", statusParam);
  if (eventTypeParam) query = query.eq("event_type", eventTypeParam);
  if (shopId) query = query.eq("shop_id", shopId);

  const { data: rows, error } = await query;

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-semibold text-zinc-800">Admin Outbox</h1>
        <p className="mt-2 text-red-600">{error.message ?? "Failed to load outbox"}</p>
      </div>
    );
  }

  const items = rows ?? [];
  const shopIds = [...new Set(items.map((r) => r.shop_id))];
  let shops: { id: string; slug: string; name: string }[] = [];
  if (shopIds.length > 0) {
    const { data: shopRows } = await supabase
      .from("shops")
      .select("id, slug, name")
      .in("id", shopIds);
    shops = shopRows ?? [];
  }
  const shopMap = Object.fromEntries(shops.map((s) => [s.id, s]));
  const itemsWithShop = items.map((row) => ({
    ...row,
    shopSlug: shopMap[row.shop_id]?.slug ?? "",
    shopName: shopMap[row.shop_id]?.name ?? "",
  }));

  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-800">Admin Outbox</h1>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Status</span>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="sent">sent</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Event type</span>
          <input
            type="text"
            name="eventType"
            defaultValue={params.eventType ?? ""}
            placeholder="e.g. BOOKING_CONFIRMED"
            className="w-48 rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Shop slug</span>
          <input
            type="text"
            name="shop"
            defaultValue={params.shop ?? ""}
            placeholder="shop-slug"
            className="w-40 rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
        >
          Apply
        </button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-600">
              <th className="p-2 font-medium">created_at</th>
              <th className="p-2 font-medium">shop</th>
              <th className="p-2 font-medium">event_type</th>
              <th className="p-2 font-medium">status</th>
              <th className="p-2 font-medium">attempts</th>
              <th className="p-2 font-medium">next_attempt_at</th>
              <th className="p-2 font-medium">sent_at</th>
              <th className="p-2 font-medium">booking_id</th>
              <th className="p-2 font-medium">recipient email</th>
              <th className="p-2 font-medium">last_error</th>
              <th className="p-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {itemsWithShop.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-4 text-center text-zinc-500">
                  No rows
                </td>
              </tr>
            ) : (
              itemsWithShop.map((row) => {
                const created = row.created_at
                  ? new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19) + "Z"
                  : "—";
                const nextAt = row.next_attempt_at
                  ? new Date(row.next_attempt_at).toISOString().replace("T", " ").slice(0, 19) + "Z"
                  : "—";
                const sentAt = row.sent_at
                  ? new Date(row.sent_at).toISOString().replace("T", " ").slice(0, 19) + "Z"
                  : "—";
                const bookingId = row.booking_id
                  ? String(row.booking_id).slice(0, 8) + "…"
                  : "—";
                const payload =
                  row.payload_json && typeof row.payload_json === "object"
                    ? (row.payload_json as Record<string, unknown>)
                    : {};
                const email =
                  typeof payload.customerEmail === "string"
                    ? payload.customerEmail
                    : "—";
                const lastError = row.last_error
                  ? String(row.last_error).slice(0, 120) +
                    (row.last_error.length > 120 ? "…" : "")
                  : "—";

                return (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50"
                  >
                    <td className="p-2 text-zinc-700">{created}</td>
                    <td className="p-2 text-zinc-700">{row.shopSlug}</td>
                    <td className="p-2 text-zinc-700">{row.event_type}</td>
                    <td className="p-2 text-zinc-700">{row.status}</td>
                    <td className="p-2 text-zinc-700">{row.attempt_count}</td>
                    <td className="p-2 text-zinc-700">{nextAt}</td>
                    <td className="p-2 text-zinc-700">{sentAt}</td>
                    <td className="p-2 font-mono text-zinc-600">{bookingId}</td>
                    <td className="max-w-[180px] truncate p-2 text-zinc-700" title={email !== "—" ? email : undefined}>
                      {email}
                    </td>
                    <td className="max-w-[200px] truncate p-2 text-zinc-600" title={row.last_error ?? ""}>
                      {lastError}
                    </td>
                    <td className="p-2">
                      <OutboxRetryButton id={row.id} status={row.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
