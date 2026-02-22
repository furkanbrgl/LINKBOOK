import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { BookingCreateSchema } from "@/lib/validation/schemas";
import { createServerSupabaseClientWithServiceRole } from "@/lib/db/supabase.server";
import { normalizePhoneE164 } from "@/lib/security/phone";
import { generateManageToken, hashToken } from "@/lib/security/tokens";
import { getClientIp, makeKey, rateLimit } from "@/lib/rate-limit/limiter";
import { getAppBaseUrl } from "@/lib/messaging/renderEmail";

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/bookings" });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Silent bot drop: honeypot present and non-empty
  if (data.honeypot != null && data.honeypot !== "") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const ip = getClientIp(request);
  const key = makeKey(["book", data.shopSlug, ip]);
  const rl = await rateLimit(key, { name: "booking", limit: 10, window: "1 m" });
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const supabase = createServerSupabaseClientWithServiceRole();

  // 1) Load shop by slug, is_active = true
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id, name, timezone")
    .eq("slug", data.shopSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (shopError) {
    return NextResponse.json(
      { error: shopError.message ?? "Failed to fetch shop" },
      { status: 500 }
    );
  }
  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const shopId = shop.id;

  // 2) Validate staff belongs to shop and is active
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

  // 3) Validate service belongs to shop and is active
  const { data: serviceRow, error: serviceError } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("id", data.serviceId)
    .eq("shop_id", shopId)
    .eq("active", true)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json(
      { error: serviceError.message ?? "Failed to fetch service" },
      { status: 500 }
    );
  }
  if (!serviceRow) {
    return NextResponse.json(
      { error: "Service not found or inactive for this shop" },
      { status: 400 }
    );
  }

  const durationMinutes = serviceRow.duration_minutes;

  // 4) Normalize phone
  const phoneResult = normalizePhoneE164(data.phone);
  if ("error" in phoneResult) {
    return NextResponse.json(
      { error: phoneResult.error },
      { status: 400 }
    );
  }
  const phoneE164 = phoneResult.e164;

  // 5) Upsert customer by (shop_id, phone_e164)
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("shop_id", shopId)
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  let customerId: string;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    const { error: updateErr } = await supabase
      .from("customers")
      .update({
        name: data.name,
        email: data.email ?? null,
      })
      .eq("id", customerId);

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message ?? "Failed to update customer" },
        { status: 500 }
      );
    }
  } else {
    const { data: newCustomer, error: insertErr } = await supabase
      .from("customers")
      .insert({
        shop_id: shopId,
        name: data.name,
        phone_e164: phoneE164,
        email: data.email ?? null,
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: insertErr.message ?? "Failed to create customer" },
        { status: 500 }
      );
    }
    customerId = newCustomer.id;
  }

  // 6) Compute endAt = startAt + duration_minutes (UTC)
  const startAtDt = DateTime.fromISO(data.startAt, { zone: "utc" });
  if (!startAtDt.isValid) {
    return NextResponse.json(
      { error: "Invalid startAt datetime" },
      { status: 400 }
    );
  }
  if (startAtDt.second !== 0 || startAtDt.millisecond !== 0 || startAtDt.minute % 15 !== 0) {
    return NextResponse.json({ error: "Invalid slot start time" }, { status: 400 });
  }
  const endAtDt = startAtDt.plus({ minutes: durationMinutes });
  const startAt = startAtDt.toISO();
  const endAt = endAtDt.toISO();
  if (!startAt || !endAt) {
    return NextResponse.json(
      { error: "Invalid datetime" },
      { status: 400 }
    );
  }

  // 7) Block overlap check
  const { data: blockingRows, error: blocksError } = await supabase
    .from("blocks")
    .select("id")
    .eq("shop_id", shopId)
    .eq("staff_id", data.staffId)
    .lt("start_at", endAt)
    .gt("end_at", startAt)
    .limit(1);

  if (blocksError) {
    return NextResponse.json(
      { error: blocksError.message ?? "Failed to check blocks" },
      { status: 500 }
    );
  }
  if (blockingRows && blockingRows.length > 0) {
    return NextResponse.json({ error: "blocked" }, { status: 409 });
  }

  // 8) Insert booking
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      shop_id: shopId,
      staff_id: data.staffId,
      service_id: data.serviceId,
      customer_id: customerId,
      start_at: startAt,
      end_at: endAt,
      status: "confirmed",
      source: "customer",
    })
    .select("id")
    .single();

  if (bookingError) {
    const msg = bookingError.message ?? "";
    const code = (bookingError as { code?: string }).code;
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

  // 9) Create manage token and upsert manage_tokens
  const rawToken = generateManageToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = DateTime.utc().plus({ days: 90 }).toISO();
  if (!expiresAt) {
    return NextResponse.json(
      { error: "Failed to compute token expiry" },
      { status: 500 }
    );
  }

  const { error: tokenErr } = await supabase.from("manage_tokens").upsert(
    {
      booking_id: bookingId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    },
    { onConflict: "booking_id" }
  );

  if (tokenErr) {
    return NextResponse.json(
      { error: tokenErr.message ?? "Failed to create manage token" },
      { status: 500 }
    );
  }

  // 10) Insert notification_outbox
  const baseUrl = getAppBaseUrl();
  const payload = {
    shopName: shop.name,
    shopSlug: data.shopSlug,
    timezone: shop.timezone,
    staffName: staffRow.name,
    serviceName: serviceRow.name,
    startAt,
    endAt,
    customerName: data.name,
    customerPhoneE164: phoneE164,
    customerEmail: data.email ?? null,
    toEmail: data.email ?? null,
    rebookUrl: `${baseUrl}/${data.shopSlug}`,
    manageToken: rawToken,
    manageUrl: `${baseUrl}/m/${rawToken}`,
  };

  const { error: outboxErr } = await supabase.from("notification_outbox").insert({
    shop_id: shopId,
    booking_id: bookingId,
    event_type: "BOOKING_CONFIRMED",
    channel: "email",
    payload_json: payload,
    idempotency_key: `booking:${bookingId}:confirmed`,
    status: "pending",
  });

  if (outboxErr) {
    return NextResponse.json(
      { error: outboxErr.message ?? "Failed to enqueue notification" },
      { status: 500 }
    );
  }

  // 11) Respond 201
  return NextResponse.json(
    {
      bookingId,
      shopSlug: data.shopSlug,
      startAt,
      endAt,
      staffId: data.staffId,
      serviceId: data.serviceId,
      customerId,
      manageToken: rawToken,
    },
    { status: 201 }
  );
}
