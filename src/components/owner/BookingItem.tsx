"use client";

import { DateTime } from "luxon";
import { cn } from "@/lib/utils";
import type { BookingLike } from "./BookingDetailsDialog";

function timeRange(booking: BookingLike, tz: string): string {
  const s = booking.start_at ?? booking.startAt;
  const e = booking.end_at ?? booking.endAt;
  if (!s || !e) return "";
  const start = DateTime.fromISO(String(s), { zone: "utc" }).setZone(tz).toFormat("HH:mm");
  const end = DateTime.fromISO(String(e), { zone: "utc" }).setZone(tz).toFormat("HH:mm");
  return `${start}–${end}`;
}

function pick(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  return s.length ? s : null;
}

export function BookingItem({
  booking,
  shopTimezone,
  onOpenDetails,
  renderActions,
}: {
  booking: BookingLike;
  shopTimezone: string;
  onOpenDetails: (b: BookingLike) => void;
  renderActions?: React.ReactNode;
}) {
  const status = pick(booking.status) ?? "confirmed";
  const source = pick(booking.source) ?? null;

  const cancelled = status.startsWith("cancelled");

  const service =
    pick(booking.service_name) ??
    pick((booking.service as { name?: string })?.name) ??
    pick(booking.serviceName) ??
    "Service";

  const customer =
    pick(booking.customer_name) ??
    pick((booking.customer as { name?: string })?.name) ??
    pick(booking.customerName) ??
    "Customer";

  const range = timeRange(booking, shopTimezone);

  return (
    <li>
      <div
        className={cn(
          "flex items-start justify-between gap-3 px-4 py-3",
          cancelled && "opacity-60"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className={cn("text-sm font-medium", cancelled && "line-through")}>
            {range} · {service} · {customer}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge text={status} tone={cancelled ? "muted" : "default"} />
            {source && <Badge text={source === "walk_in" ? "Walk-in" : source} tone="muted" />}
            <button
              type="button"
              onClick={() => onOpenDetails(booking)}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Details
            </button>
          </div>
        </div>

        <div className="shrink-0">{renderActions}</div>
      </div>
    </li>
  );
}

function Badge({
  text,
  tone,
}: {
  text: string;
  tone: "default" | "muted";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs",
        tone === "default"
          ? "bg-muted text-foreground"
          : "bg-muted/60 text-muted-foreground"
      )}
    >
      {text.replace(/_/g, " ")}
    </span>
  );
}
