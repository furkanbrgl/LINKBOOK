"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Slot = { startAt: string; labelLocal: string };

function groupSlotsByHour(slots: Slot[]): { hour: string; slots: Slot[] }[] {
  const map = new Map<string, Slot[]>();
  for (const s of slots) {
    const label = s.labelLocal ?? "";
    const hour = label && label.includes(":") ? `${label.slice(0, 2)}:00` : "—";
    const arr = map.get(hour) ?? [];
    arr.push(s);
    map.set(hour, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => {
      const aStart = a[1][0]?.startAt ?? "";
      const bStart = b[1][0]?.startAt ?? "";
      return aStart.localeCompare(bStart);
    })
    .map(([hour, list]) => ({
      hour,
      slots: list.sort((x, y) => x.startAt.localeCompare(y.startAt)),
    }));
}

type ManageActionsProps = {
  token: string;
  shopSlug: string;
  tz: string;
  staffId: string;
  serviceId: string;
  currentStatus: string;
  currentStartAt: string;
  serviceDurationMinutes: number;
  initialDate: string;
  minDate: string;
};

export function ManageActions({
  token,
  shopSlug,
  staffId,
  serviceId,
  currentStatus,
  initialDate,
  minDate,
}: ManageActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(initialDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedStartAt, setSelectedStartAt] = useState<string>("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const isConfirmed = status === "confirmed";
  const isCancelled = status === "cancelled_by_customer" || status === "cancelled_by_shop";
  const groupedSlots = groupSlotsByHour(slots);

  const fetchSlots = useCallback(async () => {
    setSlotsError(null);
    setSelectedStartAt("");
    setSlotsLoading(true);
    try {
      const url = `/api/availability?shop=${encodeURIComponent(shopSlug)}&staffId=${encodeURIComponent(staffId)}&serviceId=${encodeURIComponent(serviceId)}&date=${rescheduleDate}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setSlots([]);
        setSlotsError(data.error ?? "Failed to load slots");
        return;
      }
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
      setSlotsError("Failed to load slots");
    } finally {
      setSlotsLoading(false);
    }
  }, [shopSlug, staffId, serviceId, rescheduleDate]);

  useEffect(() => {
    if (rescheduleOpen && rescheduleDate) fetchSlots();
  }, [rescheduleOpen, rescheduleDate, fetchSlots]);

  const handleCancel = async () => {
    if (!isConfirmed || cancelLoading) return;
    setCancelError(null);
    setCancelLoading(true);
    try {
      const res = await fetch("/api/manage/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error ?? "Failed to cancel");
        return;
      }
      setStatus("cancelled_by_customer");
      setCancelSuccess(true);
      setCancelConfirmOpen(false);
      router.refresh();
    } catch {
      setCancelError("Something went wrong");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedStartAt || rescheduleLoading) return;
    setRescheduleError(null);
    setRescheduleLoading(true);
    try {
      const res = await fetch("/api/manage/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newStartAt: selectedStartAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setRescheduleError("That time was taken — pick another");
        } else {
          setRescheduleError(data.error ?? "Failed to reschedule");
        }
        return;
      }
      setRescheduleOpen(false);
      setSelectedStartAt("");
      setSlots([]);
      router.refresh();
    } catch {
      setRescheduleError("Something went wrong");
    } finally {
      setRescheduleLoading(false);
    }
  };

  return (
    <div className="mt-6 border-t border-zinc-200 pt-6">
      {cancelSuccess && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          Booking cancelled
        </p>
      )}

      {/* Action section */}
      <div className="space-y-4">
        {(isConfirmed && !cancelSuccess) && (
          <p className="text-sm text-zinc-600">
            Need to change plans? You can reschedule, or cancel if necessary.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {/* Primary: Reschedule */}
          {isConfirmed && !cancelSuccess && (
            <button
              type="button"
              onClick={() => {
                setRescheduleOpen(true);
                setRescheduleError(null);
                setRescheduleDate(minDate);
              }}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto"
            >
              Reschedule
            </button>
          )}

          {/* Secondary: Book another time — always available */}
          <Link
            href={`/${shopSlug}`}
            className="block w-full rounded-lg border-2 border-zinc-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 sm:w-auto sm:inline-block"
          >
            Book another time
          </Link>

          {/* Danger: Cancel booking — smaller, less prominent */}
          {isConfirmed && !cancelSuccess && (
            <>
              <button
                type="button"
                onClick={() => setCancelConfirmOpen(true)}
                className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
              >
                Cancel booking
              </button>
              <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
                <DialogContent className="sm:max-w-[420px]">
                  <DialogHeader>
                    <DialogTitle>Cancel this booking?</DialogTitle>
                    <DialogDescription>
                      This can&apos;t be undone. You can book again anytime.
                    </DialogDescription>
                  </DialogHeader>
                  {cancelError && (
                    <p className="text-sm text-red-600">{cancelError}</p>
                  )}
                  <DialogFooter className="gap-2 sm:gap-0">
                    <button
                      type="button"
                      onClick={() => setCancelConfirmOpen(false)}
                      className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:w-auto"
                    >
                      Keep booking
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={cancelLoading}
                      className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 sm:w-auto"
                    >
                      {cancelLoading ? "Cancelling…" : "Cancel booking"}
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Reschedule booking</DialogTitle>
                <DialogDescription>
                  Choose a new date and time for your booking.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Date</label>
                  <input
                    type="date"
                    min={minDate}
                    value={rescheduleDate}
                    onChange={(e) => {
                      setRescheduleDate(e.target.value);
                      setSlots([]);
                      setSelectedStartAt("");
                      setSlotsError(null);
                    }}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-500">Time</label>
                  {slotsLoading && (
                    <div className="grid grid-cols-4 gap-2">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-200" />
                      ))}
                    </div>
                  )}
                  {slotsError && (
                    <p className="text-sm text-red-600">{slotsError}</p>
                  )}
                  {!slotsLoading && !slotsError && slots.length === 0 && rescheduleDate && (
                    <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 py-6 text-center text-sm text-zinc-500">
                      No slots available this day. Try another date.
                    </p>
                  )}
                  {!slotsLoading && slots.length > 0 && (
                    <div className="max-h-[260px] overflow-auto pr-1">
                      <div className="space-y-4">
                        {groupedSlots.map((g) => (
                          <div key={g.hour}>
                            <div className="mb-2 text-xs font-semibold text-zinc-500">{g.hour}</div>
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                              {g.slots.map((slot) => (
                                <button
                                  key={slot.startAt}
                                  type="button"
                                  onClick={() => setSelectedStartAt(slot.startAt)}
                                  className={cn(
                                    "rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
                                    selectedStartAt === slot.startAt
                                      ? "border-zinc-900 bg-zinc-900 text-white"
                                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                                  )}
                                >
                                  {slot.labelLocal}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {rescheduleError && (
                  <p className="text-sm text-red-600">{rescheduleError}</p>
                )}
              </div>

              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setRescheduleOpen(false)}
                  className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:w-auto"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleReschedule}
                  disabled={!selectedStartAt || rescheduleLoading}
                  className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 sm:w-auto"
                >
                  {rescheduleLoading ? "Rescheduling…" : "Confirm reschedule"}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
    </div>
  );
}
