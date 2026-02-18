import { NextResponse } from "next/server";

// TODO: Implement admin auth middleware/wrapper
// Verify user is authenticated and has admin role

export async function requireAdmin(
  _request: Request
): Promise<{ userId: string } | NextResponse> {
  // TODO: implement
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
