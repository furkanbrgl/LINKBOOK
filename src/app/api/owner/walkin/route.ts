import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/owner/walkin" });
}

export async function POST() {
  return NextResponse.json({ ok: true, route: "/api/owner/walkin" });
}
