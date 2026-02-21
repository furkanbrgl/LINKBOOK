"use client";

import { DateTime } from "luxon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Flexible booking shape: support both flat (service_name) and nested (customer.name) field names. */
export type BookingLike = Record<string, unknown> & {
  id?: string;
  start_at?: string | null;
  startAt?: string | null;
  end_at?: string | null;
  endAt?: string | null;
  status?: string | null;
  source?: string | null;
  customer_name?: string | null;
  customerName?: string | null;
  customer?: { name?: string; phone_e164?: string; phone?: string; email?: string | null } | null;
  phone?: string | null;
  customer_phone?: string | null;
  email?: string | null;
  customer_email?: string | null;
  service_name?: string | null;
  serviceName?: string | null;
  service?: { name?: string } | null;
  staff_name?: string | null;
  staffName?: string | null;
  staff?: { name?: string } | null;
  created_at?: string | null;
  updated_at?: string | null;
  manageUrl?: string | null;
  manage_url?: string | null;
};

function fmt(dtIso: string | null | undefined, tz: string): string {
  if (!dtIso) return "";
  const dt = DateTime.fromISO(dtIso, { zone: "utc" }).setZone(tz);
  return dt.isValid ? dt.toFormat("EEE, d MMM yyyy · HH:mm") : String(dtIso);
}

function field(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  return s.length ? s : null;
}

export function BookingDetailsDialog({
  open,
  onOpenChange,
  booking,
  shopTimezone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: BookingLike | null;
  shopTimezone: string;
}) {
  if (!booking) return null;

  const customerName =
    (booking && field(booking.customer_name)) ??
    (booking?.customer && field((booking.customer as { name?: string }).name)) ??
    (booking && field(booking.customerName)) ??
    "Customer";

  const phone =
    booking && (field(booking.phone) ?? field(booking.customer_phone) ?? field((booking.customer as { phone_e164?: string })?.phone_e164) ?? field((booking.customer as { phone?: string })?.phone));

  const email =
    booking && (field(booking.email) ?? field(booking.customer_email) ?? field((booking.customer as { email?: string | null })?.email));

  const service =
    booking && (field(booking.service_name) ?? field((booking.service as { name?: string })?.name) ?? field(booking.serviceName));

  const provider =
    booking && (field(booking.staff_name) ?? field((booking.staff as { name?: string })?.name) ?? field(booking.staffName));

  const status = booking && field(booking.status);
  const source = booking && field(booking.source);

  const start = booking ? fmt(booking.start_at ?? booking.startAt ?? null, shopTimezone) : "";
  const end = booking ? fmt(booking.end_at ?? booking.endAt ?? null, shopTimezone) : "";

  const createdAt = booking && field(booking.created_at) ? fmt(booking.created_at as string, shopTimezone) : null;
  const updatedAt = booking && field(booking.updated_at) ? fmt(booking.updated_at as string, shopTimezone) : null;

  const manageUrl = booking && (field(booking.manageUrl) ?? field(booking.manage_url));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-base">Booking details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {booking ? (
            <>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="font-medium">{customerName}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {service ? `${service}` : "Service"}
                  {provider ? ` · ${provider}` : ""}
                </div>
                <div className="mt-1 text-sm">
                  {start}
                  {end ? ` → ${end}` : ""}
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <Row label="Status" value={status ?? undefined} />
                <Row label="Source" value={source ?? undefined} />
                <Row label="Phone" value={phone ?? undefined} />
                <Row label="Email" value={email ?? undefined} />
                {manageUrl && (
                  <div className="grid grid-cols-3 items-start gap-3">
                    <div className="text-muted-foreground">Manage</div>
                    <a className="col-span-2 break-all text-blue-600 underline" href={manageUrl}>
                      {manageUrl}
                    </a>
                  </div>
                )}
                <Row label="Created" value={createdAt ?? undefined} />
                <Row label="Updated" value={updatedAt ?? undefined} />
              </div>

              <div className="text-xs text-muted-foreground">
                Tip: Keep contact details here so the schedule view stays clean.
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No booking selected.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-3 items-start gap-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}
