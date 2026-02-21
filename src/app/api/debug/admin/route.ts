import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, stage: "no_user" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, email")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    userId: user.id,
    email: user.email,
    profile: profile ?? null,
  });
}
