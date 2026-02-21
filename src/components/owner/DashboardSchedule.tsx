"use client";

import { useState } from "react";
import { formatShopLocal } from "@/lib/time/tz";
import { StaffActions, BookingActions } from "@/app/(app)/app/dashboard/OwnerActions";
import { BookingItem } from "./BookingItem";
import { BookingDetailsDialog, type BookingLike } from "./BookingDetailsDialog";



export type ScheduleBlockItem = {
  type: "block";
  id: string;
  start_at: string;
  end_at: string;
  staff_id: string;
  reason: string | null;
};

/** Booking item for schedule list; compatible with BookingLike for dialog. */
export type ScheduleBookingItem = {
  type: "booking";
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  staff_id: string;
  service_id: string;
  customer_id: string;
  source: string;
  serviceName?: string;
  staffName?: string;
  customer?: { name: string; phone_e164: string; email: string | null } | null;
  [key: string]: unknown;
};

export type ScheduleItem = ScheduleBookingItem | ScheduleBlockItem;

export type StaffSection = {
  staffId: string;
  staffName: string;
  staffActive: boolean;
  items: ScheduleItem[];
};

type ServiceRow = { id: string; name: string; duration_minutes?: number };

type Props = {
  staffSections: StaffSection[];
  services: ServiceRow[];
  shopSlug: string;
  timezone: string;
  selectedDay: string;
};

function isBookingItem(item: ScheduleItem): item is ScheduleBookingItem {
  return item.type === "booking";
}

export function DashboardSchedule({
  staffSections,
  services,
  shopSlug,
  timezone,
  selectedDay,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingLike | null>(null);

  const handleOpenDetails = (booking: BookingLike) => {
    setSelectedBooking(booking);
    setDetailsOpen(true);
  };

  return (
    <>
      <div className="mt-8 space-y-8">
        {staffSections.map((section) => (
          <section
            key={section.staffId}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700"
          >
            <h2 className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-800">
              {section.staffName}
              {!section.staffActive && (
                <span className="ml-2 text-neutral-500">(inactive)</span>
              )}
              <StaffActions
                staffId={section.staffId}
                services={services}
                shopSlug={shopSlug}
                timezone={timezone}
                selectedDay={selectedDay}
              />
            </h2>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {section.items.length === 0 ? (
                <li className="px-4 py-3 text-sm text-neutral-500">
                  No bookings or blocks
                </li>
              ) : (
                section.items.map((item) => {
                  if (isBookingItem(item)) {
                    return (
                      <BookingItem
                        key={`b-${item.id}`}
                        booking={item as BookingLike}
                        shopTimezone={timezone}
                        onOpenDetails={handleOpenDetails}
                        renderActions={
                          <BookingActions
                            bookingId={item.id}
                            status={item.status}
                            staffId={item.staff_id}
                            serviceId={item.service_id}
                            shopSlug={shopSlug}
                            timezone={timezone}
                            selectedDay={selectedDay}
                          />
                        }
                      />
                    );
                  }
                  const bl = item;
                  return (
                    <li
                      key={`bl-${bl.id}`}
                      className="px-4 py-2 text-sm text-amber-700 dark:text-amber-400"
                    >
                      <span className="font-mono">
                        {formatShopLocal(bl.start_at, timezone, "HH:mm")}–
                        {formatShopLocal(bl.end_at, timezone, "HH:mm")}
                      </span>{" "}
                      Block {bl.reason ? `— ${bl.reason}` : ""}
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        ))}
      </div>

      <BookingDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        booking={selectedBooking}
        shopTimezone={timezone}
      />
    </>
  );
}
