"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import { getShopLocalDate, toUTCFromShopLocal, formatShopLocal } from "@/lib/time/tz";
import { StaffActions, BookingActions } from "@/app/(app)/app/dashboard/OwnerActions";
import { BookingItem } from "./BookingItem";
import { BookingDetailsDialog, type BookingLike } from "./BookingDetailsDialog";

// ——— Local helpers (copied from OwnerActions to avoid circular deps) ———
type SlotOption = { startAt: string; labelLocal: string };

function formatDateToShopLocal(date: Date, tz: string): string {
  return getShopLocalDate(date, tz);
}

function localDateAndTimeToUtcISO(
  dateLocal: string,
  timeLocal: string,
  tz: string
): string {
  return toUTCFromShopLocal(dateLocal, timeLocal, tz);
}

const BLOCK_TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    BLOCK_TIME_OPTIONS.push(
      `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
    );
  }
}

const BLOCK_DURATIONS = [15, 30, 45, 60, 90, 120];

async function postJSON(url: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = "Request failed.";
    try {
      const data = await res.json();
      if (typeof data?.error === "string") message = data.error;
    } catch {
      // ignore
    }
    if (res.status === 409) message = "Slot taken. Please pick another time.";
    if (res.status === 401) message = "Please log in again.";
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

async function fetchSlots(
  shopSlug: string,
  staffId: string,
  serviceId: string,
  date: string
): Promise<SlotOption[]> {
  const url = `/api/availability?shop=${encodeURIComponent(shopSlug)}&staffId=${encodeURIComponent(
    staffId
  )}&serviceId=${encodeURIComponent(serviceId)}&date=${date}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) return [];
  return (data.slots ?? []) as SlotOption[];
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 sm:max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}



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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingLike | null>(null);

  const defaultOpenStaffId = useMemo(() => {
    const withItems = staffSections.find((s) => s.items.length > 0);
    return (withItems ?? staffSections[0])?.staffId ?? null;
  }, [staffSections]);

  const [openStaffId, setOpenStaffId] = useState<string | null>(defaultOpenStaffId);

  useEffect(() => {
    setOpenStaffId(defaultOpenStaffId);
  }, [defaultOpenStaffId, selectedDay]);

  // Global Walk-in / Block (query-param driven)
  const [globalWalkinOpen, setGlobalWalkinOpen] = useState(false);
  const [globalBlockOpen, setGlobalBlockOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");

  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [walkinServiceId, setWalkinServiceId] = useState("");
  const [walkinDate, setWalkinDate] = useState(selectedDay);
  const [walkinSlotStartAt, setWalkinSlotStartAt] = useState("");
  const [walkinSlots, setWalkinSlots] = useState<SlotOption[]>([]);
  const [walkinSlotsLoading, setWalkinSlotsLoading] = useState(false);
  const [walkinName, setWalkinName] = useState("Walk-in");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [walkinEmail, setWalkinEmail] = useState("");

  const [blockDate, setBlockDate] = useState(selectedDay);
  const [blockStartTime, setBlockStartTime] = useState("09:00");
  const [blockDuration, setBlockDuration] = useState(60);
  const [blockNote, setBlockNote] = useState("");

  const defaultDate =
    selectedDay || formatDateToShopLocal(new Date(), timezone);

  const clearNewParam = useCallback(() => {
    const day = selectedDay || formatDateToShopLocal(new Date(), timezone);
    router.replace(`/app/dashboard?day=${day}`);
  }, [router, selectedDay, timezone]);

  useEffect(() => {
    const newParam = searchParams.get("new");
    if (newParam === "walkin") {
      const firstStaffId = staffSections[0]?.staffId ?? "";
      setSelectedStaffId(firstStaffId);
      setWalkinDate(defaultDate);
      setWalkinServiceId("");
      setWalkinSlotStartAt("");
      setWalkinName("Walk-in");
      setWalkinPhone("");
      setWalkinEmail("");
      setGlobalWalkinOpen(true);
      setGlobalError(null);
    } else if (newParam === "block") {
      const firstStaffId = staffSections[0]?.staffId ?? "";
      setSelectedStaffId(firstStaffId);
      setBlockDate(defaultDate);
      setBlockStartTime("09:00");
      setBlockDuration(60);
      setBlockNote("");
      setGlobalBlockOpen(true);
      setGlobalError(null);
    }
  }, [searchParams, staffSections, defaultDate]);

  const loadWalkinSlots = useCallback(async () => {
    if (!walkinDate || !walkinServiceId || !selectedStaffId) {
      setWalkinSlots([]);
      return;
    }
    setWalkinSlotsLoading(true);
    setWalkinSlots([]);
    setWalkinSlotStartAt("");
    try {
      const list = await fetchSlots(
        shopSlug,
        selectedStaffId,
        walkinServiceId,
        walkinDate
      );
      setWalkinSlots(list);
    } finally {
      setWalkinSlotsLoading(false);
    }
  }, [shopSlug, selectedStaffId, walkinServiceId, walkinDate]);

  useEffect(() => {
    if (globalWalkinOpen && walkinDate && walkinServiceId && selectedStaffId)
      loadWalkinSlots();
    else if (globalWalkinOpen) {
      setWalkinSlots([]);
      setWalkinSlotStartAt("");
    }
  }, [globalWalkinOpen, walkinDate, walkinServiceId, selectedStaffId, loadWalkinSlots]);

  const closeGlobalWalkin = useCallback(() => {
    setGlobalWalkinOpen(false);
    clearNewParam();
    router.refresh();
  }, [clearNewParam, router]);

  const closeGlobalBlock = useCallback(() => {
    setGlobalBlockOpen(false);
    clearNewParam();
    router.refresh();
  }, [clearNewParam, router]);

  const handleGlobalWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || !walkinServiceId.trim() || !walkinSlotStartAt.trim() || globalLoading) return;
    setGlobalError(null);
    setGlobalLoading(true);
    try {
      await postJSON("/api/owner/walkin", {
        staffId: selectedStaffId,
        serviceId: walkinServiceId,
        startAt: walkinSlotStartAt.trim(),
        name: walkinName.trim() || undefined,
        phone: walkinPhone.trim() || undefined,
        email: walkinEmail.trim() || undefined,
      });
      closeGlobalWalkin();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleGlobalBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || !blockDate || !blockStartTime || globalLoading) return;
    setGlobalError(null);
    const startAt = localDateAndTimeToUtcISO(blockDate, blockStartTime, timezone);
    const endAt = DateTime.fromISO(startAt, { zone: "utc" })
      .plus({ minutes: blockDuration })
      .toISO({ suppressMilliseconds: true });
    if (!endAt) {
      setGlobalError("Invalid time");
      return;
    }
    setGlobalLoading(true);
    try {
      await postJSON("/api/owner/block", {
        staffId: selectedStaffId,
        startAt,
        endAt,
        note: blockNote.trim() || undefined,
      });
      closeGlobalBlock();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleOpenDetails = (booking: BookingLike) => {
    setSelectedBooking(booking);
    setDetailsOpen(true);
  };

  return (
    <>
      <div className="mt-8 space-y-4 md:space-y-8">
        {staffSections.map((section) => {
          const isOpen = openStaffId === section.staffId;
          const count = section.items.length;

          return (
            <section
              key={section.staffId}
              className="rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              <div className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800">
                <div className="flex items-center justify-between px-4 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenStaffId((cur) =>
                        cur === section.staffId ? null : section.staffId
                      )
                    }
                    className="flex min-w-0 flex-1 items-center gap-2 text-left md:cursor-default"
                  >
                    <span className="truncate text-sm font-medium">
                      {section.staffName}
                      {!section.staffActive && (
                        <span className="ml-2 text-neutral-500">(inactive)</span>
                      )}
                    </span>

                    <span className="ml-auto inline-flex items-center gap-2 md:hidden">
                      <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                        {count}
                      </span>
                      <span className="text-neutral-500">
                        {isOpen ? "▾" : "▸"}
                      </span>
                    </span>
                  </button>

                  <div className="ml-3 shrink-0">
                    <StaffActions
                      staffId={section.staffId}
                      services={services}
                      shopSlug={shopSlug}
                      timezone={timezone}
                      selectedDay={selectedDay}
                    />
                  </div>
                </div>
              </div>

              <div
                className={(isOpen ? "block" : "hidden") + " md:block"}
              >
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
              </div>
            </section>
          );
        })}
      </div>

      <BookingDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        booking={selectedBooking}
        shopTimezone={timezone}
      />

      {/* Global Walk-in modal (query new=walkin) */}
      {globalWalkinOpen && (
        <Modal title="Walk-in" onClose={closeGlobalWalkin}>
          <form onSubmit={handleGlobalWalkinSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Staff
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => {
                  setSelectedStaffId(e.target.value);
                  setWalkinSlotStartAt("");
                }}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              >
                <option value="">Choose staff</option>
                {staffSections.map((s) => (
                  <option key={s.staffId} value={s.staffId}>
                    {s.staffName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Service
              </label>
              <select
                value={walkinServiceId}
                onChange={(e) => {
                  setWalkinServiceId(e.target.value);
                  setWalkinSlotStartAt("");
                }}
                required
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              >
                <option value="">Choose service</option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                    {svc.duration_minutes != null
                      ? ` (${svc.duration_minutes} min)`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Date
              </label>
              <input
                type="date"
                value={walkinDate}
                onChange={(e) => {
                  setWalkinDate(e.target.value);
                  setWalkinSlotStartAt("");
                }}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Available slots
              </label>
              {walkinSlotsLoading && (
                <p className="text-xs text-neutral-500">Loading slots…</p>
              )}
              {!walkinSlotsLoading &&
                walkinDate &&
                walkinServiceId &&
                selectedStaffId &&
                walkinSlots.length === 0 && (
                  <p className="text-xs text-neutral-500">No available slots</p>
                )}
              {!walkinSlotsLoading && walkinSlots.length > 0 && (
                <select
                  value={walkinSlotStartAt}
                  onChange={(e) => setWalkinSlotStartAt(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  <option value="">Choose time</option>
                  {walkinSlots.map((s) => (
                    <option key={s.startAt} value={s.startAt}>
                      {s.labelLocal}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Name (optional)
              </label>
              <input
                type="text"
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
                placeholder="Walk-in"
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Phone (optional)
              </label>
              <input
                type="text"
                value={walkinPhone}
                onChange={(e) => setWalkinPhone(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Email (optional)
              </label>
              <input
                type="email"
                value={walkinEmail}
                onChange={(e) => setWalkinEmail(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              />
            </div>
            {globalError && (
              <p className="text-xs text-red-600 dark:text-red-400">{globalError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={
                  globalLoading ||
                  walkinSlotsLoading ||
                  !selectedStaffId ||
                  !walkinServiceId ||
                  !walkinSlotStartAt
                }
                className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {globalLoading
                  ? "Saving…"
                  : walkinSlotsLoading
                    ? "Loading slots…"
                    : "Save"}
              </button>
              <button
                type="button"
                onClick={closeGlobalWalkin}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:text-neutral-300"
              >
                Close
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Global Block modal (query new=block) */}
      {globalBlockOpen && (
        <Modal title="Block time" onClose={closeGlobalBlock}>
          <form onSubmit={handleGlobalBlockSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Staff
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              >
                <option value="">Choose staff</option>
                {staffSections.map((s) => (
                  <option key={s.staffId} value={s.staffId}>
                    {s.staffName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Date
              </label>
              <input
                type="date"
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Start time (shop local)
              </label>
              <select
                value={blockStartTime}
                onChange={(e) => setBlockStartTime(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              >
                {BLOCK_TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Duration (minutes)
              </label>
              <select
                value={blockDuration}
                onChange={(e) => setBlockDuration(Number(e.target.value))}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              >
                {BLOCK_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Note (optional)
              </label>
              <input
                type="text"
                value={blockNote}
                onChange={(e) => setBlockNote(e.target.value)}
                placeholder="Lunch break"
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              />
            </div>
            {globalError && (
              <p className="text-xs text-red-600 dark:text-red-400">{globalError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={globalLoading || !selectedStaffId}
                className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {globalLoading ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={closeGlobalBlock}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:text-neutral-300"
              >
                Close
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
