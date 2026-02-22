import { NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { requireOwnerSingleShop } from "@/lib/auth/requireOwner";
import {
  createServerSupabaseClient,
  createServerSupabaseClientWithServiceRole,
} from "@/lib/db/supabase.server";
import { normalizePhoneE164 } from "@/lib/security/phone";
import { issueManageToken } from "@/lib/security/issueManageToken";
import { getAppBaseUrl } from "@/lib/messaging/renderEmail";

const isoDatetime = z
  .string()
  .refine((s) => DateTime.fromISO(s, { zone: "utc" }).isValid, {
    message: "Invalid ISO datetime",
  });
const BodySchema = z.object({
  staffId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startAt: isoDatetime,
  name: z.string().max(200).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const resolved = await requireOwnerSingleShop();
  if (resolved instanceof NextResponse) return resolved;
  const { shopId } = resolved;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const supabase = await createServerSupabaseClient();

  const { data: staffRow, error: staffError } = await supabase
    .from("staff")
    .select("id, name")
    .eq("id", data.staffId)
    .eq("shop_id", shopId)
    .eq("active", true)
    .maybeSingle();

  if (staffError) {
    return NextResponse.json(
      { error: staffError.message ?? "Failed to fetch staff" },
      { status: 500 }
    );
  }
  if (!staffRow) {
    return NextResponse.json(
      { error: "Staff not found or inactive for this shop" },
      { status: 400 }
    );
  }

  const { data: serviceRow, error: svcError } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("id", data.serviceId)
    .eq("shop_id", shopId)
    .eq("active", true)
    .maybeSingle();

  if (svcError) {
    return NextResponse.json(
      { error: svcError.message ?? "Failed to fetch service" },
      { status: 500 }
    );
  }
  if (!serviceRow) {
    return NextResponse.json(
      { error: "Service not found or inactive for this shop" },
      { status: 400 }
    );
  }

  let customerId: string;
  if (data.phone && data.phone.trim()) {
    const phoneResult = normalizePhoneE164(data.phone.trim());
    if ("error" in phoneResult) {
      return NextResponse.json(
        { error: phoneResult.error },
        { status: 400 }
      );
    }
    const phoneE164 = phoneResult.e164;
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("shop_id", shopId)
      .eq("phone_e164", phoneE164)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("customers")
        .update({
          name: (data.name ?? "Customer").trim() || "Customer",
          email: data.email && data.email.trim() ? data.email.trim() : null,
        })
        .eq("id", existing.id);
      customerId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("customers")
        .insert({
          shop_id: shopId,
          name: (data.name ?? "Customer").trim() || "Customer",
          phone_e164: phoneE164,
          email: data.email && data.email.trim() ? data.email.trim() : null,
        })
        .select("id")
        .single();
      if (insErr) {
        return NextResponse.json(
          { error: insErr.message ?? "Failed to create customer" },
          { status: 500 }
        );
      }
      customerId = inserted.id;
    }
  } else {
    const placeholderPhone = `+walkin-${crypto.randomUUID().replace(/-/g, "")}`;
    const { data: inserted, error: insErr } = await supabase
      .from("customers")
      .insert({
        shop_id: shopId,
        name: (data.name ?? "Walk-in").trim() || "Walk-in",
        phone_e164: placeholderPhone,
        email: data.email && data.email.trim() ? data.email.trim() : null,
      })
      .select("id")
      .single();
    if (insErr) {
      return NextResponse.json(
        { error: insErr.message ?? "Failed to create customer" },
        { status: 500 }
      );
    }
    customerId = inserted.id;
  }

  const startAtDt = DateTime.fromISO(data.startAt, { zone: "utc" });
  const endAtDt = startAtDt.plus({ minutes: serviceRow.duration_minutes });
  const endAt = endAtDt.toISO();
  if (!endAt) {
    return NextResponse.json({ error: "Invalid datetime" }, { status: 400 });
  }

  const { data: blockingRows, error: blocksError } = await supabase
    .from("blocks")
    .select("id")
    .eq("shop_id", shopId)
    .eq("staff_id", data.staffId)
    .lt("start_at", endAt)
    .gt("end_at", data.startAt)
    .limit(1);

  if (blocksError) {
    return NextResponse.json(
      { error: blocksError.message ?? "Failed to check blocks" },
      { status: 500 }
    );
  }
  if (blockingRows && blockingRows.length > 0) {
    return NextResponse.json({ error: "slot_taken" }, { status: 409 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      shop_id: shopId,
      staff_id: data.staffId,
      service_id: data.serviceId,
      customer_id: customerId,
      start_at: data.startAt,
      end_at: endAt,
      status: "confirmed",
      source: "walk_in",
    })
    .select("id, start_at, end_at, status, staff_id, service_id, customer_id, source")
    .single();

  if (bookingError) {
    const code = (bookingError as { code?: string }).code;
    const msg = bookingError.message ?? "";
    const isOverlap =
      code === "23P01" ||
      msg.includes("bookings_no_overlap_confirmed") ||
      msg.includes("conflicts with existing key");
    if (isOverlap) {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    return NextResponse.json(
      { error: msg || "Failed to create booking" },
      { status: 500 }
    );
  }

  const bookingId = booking.id;
  const hasContact = (data.phone && data.phone.trim()) || (data.email && data.email.trim());
  if (hasContact) {
    const serviceSupabase = createServerSupabaseClientWithServiceRole();
    const manageToken = await issueManageToken(serviceSupabase, bookingId);
    const baseUrl = getAppBaseUrl();
    const { data: shopForOutbox } = await supabase
      .from("shops")
      .select("name, slug, timezone")
      .eq("id", shopId)
      .maybeSingle();
    const customerEmail = data.email?.trim() || null;
    const payload_json = {
      shopName: shopForOutbox?.name ?? "Shop",
      shopSlug: shopForOutbox?.slug ?? "",
      timezone: shopForOutbox?.timezone ?? "UTC",
      staffName: staffRow.name,
      serviceName: serviceRow.name,
      startAt: booking.start_at,
      endAt: booking.end_at,
      customerName: data.name?.trim() || "Walk-in",
      customerEmail,
      toEmail: customerEmail,
      manageToken,
      manageUrl: `${baseUrl}/m/${manageToken}`,
      rebookUrl: shopForOutbox?.slug ? `${baseUrl}/${shopForOutbox.slug}` : null,
    };
    await supabase.from("notification_outbox").insert({
      shop_id: shopId,
      booking_id: bookingId,
      event_type: "BOOKING_CONFIRMED",
      channel: "email",
      payload_json,
      idempotency_key: `booking:${bookingId}:confirmed_walkin`,
      status: "pending",
    });
  }

  return NextResponse.json(
    {
      ok: true,
      bookingId,
      startAt: booking.start_at,
      endAt: booking.end_at,
      status: booking.status,
      staffId: booking.staff_id,
      serviceId: booking.service_id,
      customerId: booking.customer_id,
      source: booking.source,
    },
    { status: 200 }
  );
}
