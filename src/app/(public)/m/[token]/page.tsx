import { createServerSupabaseClientWithServiceRole } from "@/lib/db/supabase.server";
import { formatShopLocal } from "@/lib/time/tz";
import { hashToken } from "@/lib/security/tokens";

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let tokenHash: string;
  try {
    tokenHash = hashToken(token);
  } catch {
    return <InvalidLink />;
  }

  const supabase = createServerSupabaseClientWithServiceRole();

  const { data: tokenRow, error: tokenError } = await supabase
    .from("manage_tokens")
    .select("booking_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow || tokenRow.revoked_at != null) {
    return <InvalidLink />;
  }

  const now = new Date().toISOString();
  if (new Date(tokenRow.expires_at).toISOString() < now) {
    return <InvalidLink />;
  }

  const bookingId = tokenRow.booking_id;

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, start_at, end_at, status, shops(name, slug, timezone, phone), staff(name), services(name, duration_minutes), customers(name, phone_e164, email)"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return <InvalidLink />;
  }

  const shop = booking.shops as { name: string; slug: string; timezone: string; phone: string | null } | null;
  const staff = booking.staff as { name: string } | null;
  const service = booking.services as { name: string; duration_minutes: number } | null;
  const customer = booking.customers as { name: string; phone_e164: string; email: string | null } | null;

  const tz = shop?.timezone ?? "UTC";
  const dateLine = formatShopLocal(booking.start_at, tz, "EEE, d MMM yyyy");
  const timeLine = formatShopLocal(booking.start_at, tz, "HH:mm");

  return (
    <div className="min-h-screen bg-zinc-50 p-4 text-zinc-900 sm:p-6">
      <main className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-800">
          {shop?.name ?? "Shop"}
        </h1>

        <div className="mt-4 space-y-3 text-sm">
          <p className="text-zinc-600">
            <span className="font-medium text-zinc-800">{service?.name ?? "—"}</span>
            {staff?.name != null && (
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
            {customer?.name ?? "—"}
          </p>
        </div>
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
