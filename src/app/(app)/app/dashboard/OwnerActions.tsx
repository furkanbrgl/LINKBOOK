"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import {
  getShopLocalDate,
  toUTCFromShopLocal,
} from "@/lib/time/tz";

// ——— Shared helpers (use existing lib/time/tz) ———

/** Format a Date to YYYY-MM-DD in shop local time. */
function formatDateToShopLocal(date: Date, tz: string): string {
  return getShopLocalDate(date, tz);
}

/** Convert selected local date (YYYY-MM-DD) + time (HH:mm) + shop timezone → UTC ISO string. */
function localDateAndTimeToUtcISO(
  dateLocal: string,
  timeLocal: string,
  tz: string
): string {
  return toUTCFromShopLocal(dateLocal, timeLocal, tz);
}

// ——— 15-min time options for block (shop local display) ———
const BLOCK_TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    BLOCK_TIME_OPTIONS.push(
      `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
    );
  }
}

const BLOCK_DURATIONS = [15, 30, 45, 60, 90, 120];

type SlotOption = { startAt: string; labelLocal: string };

async function postJSON(
  url: string,
  body: Record<string, unknown>
): Promise<void> {
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
      // use default message
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
  const url = `/api/availability?shop=${encodeURIComponent(shopSlug)}&staffId=${encodeURIComponent(staffId)}&serviceId=${encodeURIComponent(serviceId)}&date=${date}`;
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
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
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

export function BookingActions({
  bookingId,
  status,
  staffId,
  serviceId,
  shopSlug,
  timezone,
  selectedDay,
}: {
  bookingId: string;
  status: string;
  staffId: string;
  serviceId: string;
  shopSlug: string;
  timezone: string;
  selectedDay: string;
}) {
  const router = useRouter();
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState(selectedDay);
  const [moveSlotStartAt, setMoveSlotStartAt] = useState("");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const cancelled =
    status === "cancelled_by_customer" || status === "cancelled_by_shop";

  const loadMoveSlots = useCallback(async () => {
    if (!moveDate) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    setSlots([]);
    setMoveSlotStartAt("");
    try {
      const list = await fetchSlots(shopSlug, staffId, serviceId, moveDate);
      setSlots(list);
    } finally {
      setSlotsLoading(false);
    }
  }, [shopSlug, staffId, serviceId, moveDate]);

  useEffect(() => {
    if (moveOpen && moveDate) loadMoveSlots();
  }, [moveOpen, moveDate, loadMoveSlots]);

  const handleCancel = async () => {
    if (cancelled || loading) return;
    setError(null);
    setLoading(true);
    try {
      await postJSON("/api/owner/cancel", { bookingId });
      setSuccess(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveOpen = () => {
    setMoveOpen(true);
    setError(null);
    setSuccess(false);
    setMoveDate(
      selectedDay || formatDateToShopLocal(new Date(), timezone)
    );
    setMoveSlotStartAt("");
  };

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveSlotStartAt || loading) return;
    setError(null);
    setLoading(true);
    try {
      await postJSON("/api/owner/move", {
        bookingId,
        newStartAt: moveSlotStartAt,
      });
      setSuccess(true);
      setMoveOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1">
      {success && (
        <span className="text-xs text-green-600 dark:text-green-400">Saved.</span>
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      )}
      {!cancelled && (
        <>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="rounded border border-red-200 px-2 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMoveOpen}
            disabled={loading}
            className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Move
          </button>
        </>
      )}
      {moveOpen && (
        <Modal title="Move booking" onClose={() => setMoveOpen(false)}>
          <form onSubmit={handleMoveSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Date
              </label>
              <input
                type="date"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Available slots
              </label>
              {slotsLoading && (
                <p className="text-xs text-neutral-500">Loading slots…</p>
              )}
              {!slotsLoading && slots.length === 0 && moveDate && (
                <p className="text-xs text-neutral-500">No available slots</p>
              )}
              {!slotsLoading && slots.length > 0 && (
                <select
                  value={moveSlotStartAt}
                  onChange={(e) => setMoveSlotStartAt(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  <option value="">Choose time</option>
                  {slots.map((s) => (
                    <option key={s.startAt} value={s.startAt}>
                      {s.labelLocal}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={
                  loading || slotsLoading || !moveSlotStartAt
                }
                className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {loading ? "Saving…" : slotsLoading ? "Loading slots…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setMoveOpen(false)}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:text-neutral-300"
              >
                Close
              </button>
            </div>
          </form>
        </Modal>
      )}
    </span>
  );
}

export function StaffActions({
  staffId,
  services,
  shopSlug,
  timezone,
  selectedDay,
}: {
  staffId: string;
  services: { id: string; name: string; duration_minutes?: number }[];
  shopSlug: string;
  timezone: string;
  selectedDay: string;
}) {
  const router = useRouter();
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Walk-in form
  const [walkinServiceId, setWalkinServiceId] = useState("");
  const [walkinDate, setWalkinDate] = useState(selectedDay);
  const [walkinSlotStartAt, setWalkinSlotStartAt] = useState("");
  const [walkinSlots, setWalkinSlots] = useState<SlotOption[]>([]);
  const [walkinSlotsLoading, setWalkinSlotsLoading] = useState(false);
  const [walkinName, setWalkinName] = useState("Walk-in");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [walkinEmail, setWalkinEmail] = useState("");

  // Block form
  const [blockDate, setBlockDate] = useState(selectedDay);
  const [blockStartTime, setBlockStartTime] = useState("09:00");
  const [blockDuration, setBlockDuration] = useState(60);
  const [blockNote, setBlockNote] = useState("");

  const loadWalkinSlots = useCallback(async () => {
    if (!walkinDate || !walkinServiceId) {
      setWalkinSlots([]);
      return;
    }
    setWalkinSlotsLoading(true);
    setWalkinSlots([]);
    setWalkinSlotStartAt("");
    try {
      const list = await fetchSlots(
        shopSlug,
        staffId,
        walkinServiceId,
        walkinDate
      );
      setWalkinSlots(list);
    } finally {
      setWalkinSlotsLoading(false);
    }
  }, [shopSlug, staffId, walkinServiceId, walkinDate]);

  useEffect(() => {
    if (walkinOpen && walkinDate && walkinServiceId) loadWalkinSlots();
    else if (walkinOpen) {
      setWalkinSlots([]);
      setWalkinSlotStartAt("");
    }
  }, [walkinOpen, walkinDate, walkinServiceId, loadWalkinSlots]);

  const defaultDate =
    selectedDay || formatDateToShopLocal(new Date(), timezone);

  const resetWalkin = () => {
    setWalkinServiceId("");
    setWalkinDate(defaultDate);
    setWalkinSlotStartAt("");
    setWalkinName("Walk-in");
    setWalkinPhone("");
    setWalkinEmail("");
    setError(null);
  };

  const resetBlock = () => {
    setBlockDate(defaultDate);
    setBlockStartTime("09:00");
    setBlockDuration(60);
    setBlockNote("");
    setError(null);
  };

  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinServiceId.trim() || !walkinSlotStartAt.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      await postJSON("/api/owner/walkin", {
        staffId,
        serviceId: walkinServiceId,
        startAt: walkinSlotStartAt.trim(),
        name: walkinName.trim() || undefined,
        phone: walkinPhone.trim() || undefined,
        email: walkinEmail.trim() || undefined,
      });
      setSuccess(true);
      setWalkinOpen(false);
      resetWalkin();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDate || !blockStartTime || loading) return;
    setError(null);
    const startAt = localDateAndTimeToUtcISO(
      blockDate,
      blockStartTime,
      timezone
    );
    const endAt = DateTime.fromISO(startAt, { zone: "utc" })
      .plus({ minutes: blockDuration })
      .toISO({ suppressMilliseconds: true });
    if (!endAt) {
      setError("Invalid time");
      return;
    }
    setLoading(true);
    try {
      await postJSON("/api/owner/block", {
        staffId,
        startAt,
        endAt,
        note: blockNote.trim() || undefined,
      });
      setSuccess(true);
      setBlockOpen(false);
      resetBlock();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1">
      {success && (
        <span className="text-xs text-green-600 dark:text-green-400">Saved.</span>
      )}
      <button
        type="button"
        onClick={() => {
          setWalkinOpen(true);
          setError(null);
          setSuccess(false);
          resetWalkin();
        }}
        className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        Walk-in
      </button>
      <button
        type="button"
        onClick={() => {
          setBlockOpen(true);
          setError(null);
          setSuccess(false);
          resetBlock();
        }}
        className="rounded border border-amber-200 px-2 py-1 text-sm text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950"
      >
        Block
      </button>

      {walkinOpen && (
        <Modal title="Walk-in" onClose={() => setWalkinOpen(false)}>
          <form onSubmit={handleWalkinSubmit} className="space-y-3">
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
                (walkinDate && walkinServiceId && walkinSlots.length === 0) && (
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
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={
                  loading ||
                  walkinSlotsLoading ||
                  !walkinServiceId ||
                  !walkinSlotStartAt
                }
                className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {loading
                  ? "Saving…"
                  : walkinSlotsLoading
                    ? "Loading slots…"
                    : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setWalkinOpen(false)}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:text-neutral-300"
              >
                Close
              </button>
            </div>
          </form>
        </Modal>
      )}

      {blockOpen && (
        <Modal title="Block time" onClose={() => setBlockOpen(false)}>
          <form onSubmit={handleBlockSubmit} className="space-y-3">
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
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {loading ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setBlockOpen(false)}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:text-neutral-300"
              >
                Close
              </button>
            </div>
          </form>
        </Modal>
      )}
    </span>
  );
}
