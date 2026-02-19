import { resolveManageToken } from "@/lib/security/resolveManageToken";
import { formatShopLocal, getShopLocalDate } from "@/lib/time/tz";
import { ManageActions } from "./ManageActions";

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const resolved = await resolveManageToken(token);
  if (!resolved) {
    return <InvalidLink />;
  }

  const { booking, shop, staff, service, customer } = resolved;
  const tz = shop.timezone;
  const dateLine = formatShopLocal(booking.start_at, tz, "EEE, d MMM yyyy");
  const timeLine = formatShopLocal(booking.start_at, tz, "HH:mm");
  const initialDate = getShopLocalDate(booking.start_at, tz);
  const minDate = getShopLocalDate(new Date().toISOString(), tz);

  return (
    <div className="min-h-screen bg-zinc-50 p-4 text-zinc-900 sm:p-6">
      <main className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-800">
          {shop.name}
        </h1>

        <div className="mt-4 space-y-3 text-sm">
          <p className="text-zinc-600">
            <span className="font-medium text-zinc-800">{service.name}</span>
            {staff.name != null && (
              <> · {staff.name}</>
            )}
          </p>
          <p className="text-zinc-600">
            {dateLine} at {timeLine}
          </p>
          <p className="text-zinc-600">
            Status: <span className="font-medium capitalize">{booking.status.replace(/_/g, " ")}</span>
          </p>
          <p className="text-zinc-600">
            {customer.name}
          </p>
        </div>

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
        <h1 className="text-lg font-semibold text-zinc-800">
          Link expired or invalid
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          This link may have expired or already been used.
        </p>
      </main>
    </div>
  );
}
