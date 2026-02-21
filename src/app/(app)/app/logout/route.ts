import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  const baseUrl =
    process.env.APP_BASE_URL ?? "http://localhost:3001";
  return NextResponse.redirect(new URL("/login", baseUrl));
}
