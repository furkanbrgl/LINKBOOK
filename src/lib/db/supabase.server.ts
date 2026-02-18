import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only. Do not import in client components.
 * Uses service role key; bypasses RLS.
 */
export function createServerSupabaseClientWithServiceRole(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (server-only)");
  }

  return createClient(url, serviceRoleKey);
}

/**
 * Server-only. Do not import in client components.
 * Uses anon key; respects RLS.
 */
export function createServerSupabaseClientWithAnon(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, anonKey);
}
