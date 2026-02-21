import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";

export type RequireAdminResult = { userId: string };

/** Returned from requireAdmin when redirect: true and user is not admin (page should call redirect()). */
export type RequireAdminRedirect = { redirect: true };

/**
 * Server-only. Verifies the current user is authenticated and has is_admin = true in profiles.
 * Returns { userId } or a NextResponse (401/403) or { redirect: true }.
 * - For API routes: call with no options or { redirect: false }; returns 403 when not admin.
 * - For pages: call with { redirect: true }; returns { redirect: true } when not admin (call redirect("/login") in page).
 */
export async function requireAdmin(options?: {
  redirect?: boolean;
}): Promise<RequireAdminResult | NextResponse | RequireAdminRedirect> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    if (options?.redirect) {
      return { redirect: true };
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.is_admin) {
    if (options?.redirect) {
      return { redirect: true };
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: user.id };
}

