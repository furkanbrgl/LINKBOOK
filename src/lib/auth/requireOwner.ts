import { NextResponse } from "next/server";

// TODO: Implement owner auth middleware/wrapper
// Verify user is authenticated and has owner role for the shop

export async function requireOwner(
  _request: Request,
  _shopId?: string
): Promise<{ userId: string; shopId: string } | NextResponse> {
  // TODO: implement
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
