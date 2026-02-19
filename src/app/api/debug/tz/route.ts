import { NextResponse } from "next/server";
import { getShopLocalDate, formatShopLocal } from "@/lib/time/tz";

export async function GET() {
  const nowUtc = new Date().toISOString();
  const istanbulDate = getShopLocalDate(nowUtc, "Europe/Istanbul");
  const istanbulTime = formatShopLocal(nowUtc, "Europe/Istanbul", "HH:mm");

  return NextResponse.json({
    nowUtc,
    istanbulDate,
    istanbulTime,
  });
}
