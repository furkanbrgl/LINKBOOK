// src/lib/time/tz.ts
import { DateTime } from "luxon";

/**
 * Parse a UTC ISO string (or Date) and return a Luxon DateTime in the shop timezone.
 */
export function toShopDateTime(
  utc: string | Date,
  tz: string
): DateTime {
  const iso =
    utc instanceof Date ? utc.toISOString() : utc;

  // Ensure it is interpreted as UTC, then converted to tz
  const dt = DateTime.fromISO(iso, { zone: "utc" });
  if (!dt.isValid) throw new Error(`Invalid UTC datetime: ${iso}`);
  return dt.setZone(tz);
}

/**
 * Convert a local date + local time in a shop timezone to UTC ISO string.
 *
 * dateLocal: "YYYY-MM-DD"
 * timeLocal: "HH:mm" or "HH:mm:ss"
 */
export function toUTCFromShopLocal(
  dateLocal: string,
  timeLocal: string,
  tz: string
): string {
  // Normalize time
  const time = timeLocal.length === 5 ? `${timeLocal}:00` : timeLocal;

  const dtLocal = DateTime.fromISO(`${dateLocal}T${time}`, { zone: tz });
  if (!dtLocal.isValid) {
    throw new Error(`Invalid local date/time: ${dateLocal} ${timeLocal} in ${tz}`);
  }
  return dtLocal.toUTC().toISO({ suppressMilliseconds: true })!;
}

/**
 * Format a UTC datetime into a shop-local display string.
 *
 * format examples:
 * - "ccc, LLL dd"   => "Mon, Feb 18"
 * - "HH:mm"         => "10:30"
 * - "dd LLL yyyy HH:mm"
 */
export function formatShopLocal(
  dtUtc: string | Date,
  tz: string,
  format: string
): string {
  const dtLocal = toShopDateTime(dtUtc, tz);
  return dtLocal.toFormat(format);
}

/**
 * Get shop-local date string (YYYY-MM-DD) for a given UTC now (or Date).
 */
export function getShopLocalDate(
  utcNow: string | Date,
  tz: string
): string {
  const dtLocal = toShopDateTime(utcNow, tz);
  return dtLocal.toFormat("yyyy-LL-dd");
}

/**
 * Utility: convert a shop-local date (YYYY-MM-DD) to UTC range [start,end) for that day.
 * Useful for availability queries.
 */
export function getUtcDayRangeFromShopLocalDate(
  dayLocal: string,
  tz: string
): { startUtcIso: string; endUtcIso: string } {
  const startLocal = DateTime.fromISO(`${dayLocal}T00:00:00`, { zone: tz });
  if (!startLocal.isValid) throw new Error(`Invalid dayLocal: ${dayLocal}`);
  const endLocal = startLocal.plus({ days: 1 });

  return {
    startUtcIso: startLocal.toUTC().toISO({ suppressMilliseconds: true })!,
    endUtcIso: endLocal.toUTC().toISO({ suppressMilliseconds: true })!,
  };
}
