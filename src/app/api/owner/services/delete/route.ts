import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/requireOwner";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

const BodySchema = z.object({
  serviceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { serviceId } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data: serviceRow, error: serviceError } = await supabase
    .from("services")
    .select("id, shop_id")
    .eq("id", serviceId)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json(
      { error: serviceError.message ?? "Failed to fetch service" },
      { status: 500 }
    );
  }
  if (!serviceRow || !owner.shopIds.includes(serviceRow.shop_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("id")
    .eq("service_id", serviceId)
    .limit(1);

  if (bookingsError) {
    return NextResponse.json(
      { error: bookingsError.message ?? "Failed to check bookings" },
      { status: 500 }
    );
  }
  if (bookings && bookings.length > 0) {
    return NextResponse.json(
      { error: "Service has bookings; deactivate instead." },
      { status: 409 }
    );
  }

  const { error: deleteError } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message ?? "Failed to delete service" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
