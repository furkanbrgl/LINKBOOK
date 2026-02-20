import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/requireOwner";

export async function GET() {
  const owner = await requireOwner();
  if (owner === null) {
    return NextResponse.json(
      { ok: false, reason: "not_logged_in" },
      { status: 401 }
    );
  }
  return NextResponse.json({ ok: true, owner }, { status: 200 });
}
