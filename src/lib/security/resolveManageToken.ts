/**
 * Server-only. Resolves a raw manage token to booking + related entities.
 * Returns null for invalid, expired, revoked, or missing data.
 */

import { hashToken } from "@/lib/security/tokens";
import { createServerSupabaseClientWithServiceRole } from "@/lib/db/supabase.server";

export type ResolvedManageToken = {
  booking: { id: string; start_at: string; end_at: string; status: string; shop_id: string; staff_id: string; service_id: string; customer_id: string };
  shop: { id: string; name: string; slug: string; timezone: string; phone: string | null };
  staff: { id: string; name: string };
  service: { id: string; name: string; duration_minutes: number };
  customer: { id: string; name: string; phone_e164: string; email: string | null };
};

export async function resolveManageToken(rawToken: string): Promise<ResolvedManageToken | null> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 20) {
    return null;
  }

  let hash: string;
  try {
    hash = hashToken(rawToken);
  } catch {
    return null;
  }

  const supabase = createServerSupabaseClientWithServiceRole();

  const { data: tokenRow, error: tokenError } = await supabase
    .from("manage_tokens")
    .select("booking_id, expires_at, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (tokenError || !tokenRow || tokenRow.revoked_at != null) {
    return null;
  }

  const now = new Date().toISOString();
  if (new Date(tokenRow.expires_at).toISOString() < now) {
    return null;
  }

  const bookingId = tokenRow.booking_id;

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, start_at, end_at, status, shop_id, staff_id, service_id, customer_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return null;
  }

  const [shopRes, staffRes, serviceRes, customerRes] = await Promise.all([
    supabase.from("shops").select("id, name, slug, timezone, phone").eq("id", booking.shop_id).maybeSingle(),
    supabase.from("staff").select("id, name").eq("id", booking.staff_id).maybeSingle(),
    supabase.from("services").select("id, name, duration_minutes").eq("id", booking.service_id).maybeSingle(),
    supabase.from("customers").select("id, name, phone_e164, email").eq("id", booking.customer_id).maybeSingle(),
  ]);

  const shop = shopRes.data;
  const staff = staffRes.data;
  const service = serviceRes.data;
  const customer = customerRes.data;

  if (shopRes.error || staffRes.error || serviceRes.error || customerRes.error || !shop || !staff || !service || !customer) {
    return null;
  }

  return {
    booking: {
      id: booking.id,
      start_at: booking.start_at,
      end_at: booking.end_at,
      status: booking.status,
      shop_id: booking.shop_id,
      staff_id: booking.staff_id,
      service_id: booking.service_id,
      customer_id: booking.customer_id,
    },
    shop: { id: shop.id, name: shop.name, slug: shop.slug, timezone: shop.timezone, phone: shop.phone },
    staff: { id: staff.id, name: staff.name },
    service: { id: service.id, name: service.name, duration_minutes: service.duration_minutes },
    customer: { id: customer.id, name: customer.name, phone_e164: customer.phone_e164, email: customer.email },
  };
}
