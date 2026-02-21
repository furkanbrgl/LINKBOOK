import { NextResponse } from "next/server";
import { createServerSupabaseClientWithServiceRole } from "@/lib/db/supabase.server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) {
    return admin;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id =
    typeof body === "object" && body !== null && "id" in body
      ? (body as { id: unknown }).id
      : undefined;

  if (typeof id !== "string" || id.length < 10) {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  }

  const supabase = createServerSupabaseClientWithServiceRole();

  const { data: row, error: fetchError } = await supabase
    .from("notification_outbox")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message ?? "Failed to fetch row" },
      { status: 500 }
    );
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.status === "sent") {
    return NextResponse.json({ ok: false, reason: "already_sent" });
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("notification_outbox")
    .update({
      status: "pending",
      next_attempt_at: nowIso,
      last_error: null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
