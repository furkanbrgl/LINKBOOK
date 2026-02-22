import { headers } from "next/headers";
import { resolveManageToken } from "@/lib/security/resolveManageToken";
import { formatShopLocal, getShopLocalDate } from "@/lib/time/tz";
import { getClientIpFromHeaders, makeKey, rateLimit } from "@/lib/rate-limit/limiter";
import { ManageActions } from "./ManageActions";

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const ip = getClientIpFromHeaders(await headers());
  const rl = await rateLimit(makeKey(["manage_view", ip]), {
    name: "manage_view",
    limit: 30,
    window: "1 m",
  });
  if (!rl.ok) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <main className="text-center">
          <p className="text-zinc-600">Too many attempts. Try again in a minute.</p>
        </main>
      </div>
    );
  }

  const resolved = await resolveManageToken(token);
  if (!resolved) {
    return <InvalidLink />;
  }

  const { booking, shop, staff, service } = resolved;
  const tz = shop.timezone;
  const formattedWhen = formatShopLocal(booking.start_at, tz, "EEE, d MMM yyyy · HH:mm");
  const initialDate = getShopLocalDate(booking.start_at, tz);
  const minDate = getShopLocalDate(new Date().toISOString(), tz);
  const isCancelled = booking.status === "cancelled_by_customer" || booking.status === "cancelled_by_shop";
  const statusLabel = isCancelled ? "Cancelled" : "Confirmed";

  return (
    <div className="min-h-screen bg-zinc-50 p-4 text-zinc-900 sm:p-6">
      <main className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-800">Manage your booking</h1>

        <span
          className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${
            isCancelled ? "bg-zinc-100 text-zinc-600" : "bg-green-100 text-green-800"
          }`}
        >
          {statusLabel}
        </span>

        <div className="mt-4 space-y-2 divide-y divide-zinc-100">
          <div className="flex justify-between gap-4 py-2 text-sm">
            <span className="text-zinc-500">Shop</span>
            <span className="font-medium text-zinc-900 text-right">{shop.name}</span>
          </div>
          <div className="flex justify-between gap-4 py-2 text-sm">
            <span className="text-zinc-500">Service</span>
            <span className="font-medium text-zinc-900 text-right">{service.name}</span>
          </div>
          <div className="flex justify-between gap-4 py-2 text-sm">
            <span className="text-zinc-500">Provider</span>
            <span className="font-medium text-zinc-900 text-right">{staff.name}</span>
          </div>
          <div className="flex justify-between gap-4 py-2 text-sm">
            <span className="text-zinc-500">When</span>
            <span className="font-medium text-zinc-900 text-right">{formattedWhen}</span>
          </div>
          <div className="flex justify-between gap-4 py-2 text-sm">
            <span className="text-zinc-500">Duration</span>
            <span className="font-medium text-zinc-900 text-right">{service.duration_minutes} min</span>
          </div>
        </div>

        {(shop.phone || shop.address) && (
          <div className="mt-4 rounded-lg bg-zinc-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Contact</div>
            {shop.phone && <p className="mt-1 text-sm text-zinc-700">{shop.phone}</p>}
            {shop.address && <p className="mt-1 text-sm text-zinc-700">{shop.address}</p>}
          </div>
        )}

        <ManageActions
          token={token}
          shopSlug={shop.slug}
          tz={tz}
          staffId={booking.staff_id}
          serviceId={booking.service_id}
          currentStatus={booking.status}
          currentStartAt={booking.start_at}
          serviceDurationMinutes={service.duration_minutes}
          initialDate={initialDate}
          minDate={minDate}
        />
      </main>
    </div>
  );
}

function InvalidLink() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <main className="text-center">
        <h1 className="text-lg font-semibold text-zinc-800">Booking not found</h1>
        <p className="mt-2 text-sm text-zinc-600">
          This link may have expired or already been used.
        </p>
      </main>
    </div>
  );
}
