// TODO: DELETE - Temporary debug route for local RLS testing only.
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, anonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });

  const { data, error } = await supabase
    .from("shops")
    .select("slug")
    .order("slug");

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }

  const slugs = (data ?? []).map((r) => r.slug);
  return NextResponse.json({
    slugs,
    tokenProvided: !!token,
  });
}
