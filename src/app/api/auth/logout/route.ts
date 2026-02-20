import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
