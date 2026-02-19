"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Slot = { startAt: string; labelLocal: string };

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
  tz,
  staffId,
  serviceId,
  currentStatus,
  currentStartAt,
  serviceDurationMinutes,
  initialDate,
  minDate,
}: ManageActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [rescheduleDate, setRescheduleDate] = useState(initialDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedStartAt, setSelectedStartAt] = useState<string>("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const isConfirmed = status === "confirmed";
  const isCancelled = status === "cancelled_by_customer" || status === "cancelled_by_shop";

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
    } catch {
      setCancelError("Something went wrong");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleLoadSlots = async () => {
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
          if (data.error === "slot_taken") setRescheduleError("That slot was just taken");
          else if (data.error === "blocked") setRescheduleError("That time is blocked");
          else setRescheduleError(data.error ?? "Conflict");
        } else if (res.status === 400) {
          setRescheduleError(data.error ?? "Invalid request");
        } else {
          setRescheduleError(data.error ?? "Failed to reschedule");
        }
        return;
      }
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
    <div className="mt-6 space-y-6 border-t border-zinc-200 pt-6">
      {/* Cancel */}
      <div>
        {isConfirmed && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelLoading}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {cancelLoading ? "Cancelling…" : "Cancel booking"}
          </button>
        )}
        {isCancelled && (
          <p className="text-sm text-zinc-500">Cancelled</p>
        )}
        {cancelError && (
          <p className="mt-1 text-sm text-red-600">{cancelError}</p>
        )}
      </div>

      {/* Reschedule — only when confirmed */}
      {isConfirmed && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-800">Reschedule</h2>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">New date</label>
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
          <button
            type="button"
            onClick={handleLoadSlots}
            disabled={slotsLoading}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-200 disabled:opacity-50"
          >
            {slotsLoading ? "Loading…" : "Load slots"}
          </button>
          {slotsError && <p className="text-sm text-red-600">{slotsError}</p>}
          {slots.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">Choose time</p>
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.startAt}
                    type="button"
                    onClick={() => setSelectedStartAt(slot.startAt)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      selectedStartAt === slot.startAt
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {slot.labelLocal}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedStartAt && (
            <button
              type="button"
              onClick={handleReschedule}
              disabled={rescheduleLoading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {rescheduleLoading ? "Rescheduling…" : "Confirm reschedule"}
            </button>
          )}
          {rescheduleError && (
            <p className="text-sm text-red-600">{rescheduleError}</p>
          )}
        </div>
      )}
    </div>
  );
}
