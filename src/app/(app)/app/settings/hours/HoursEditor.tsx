"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

/** Postgres: 0=Sun, 1=Mon, ..., 6=Sat. UI order Mon–Sun. */
const DAY_ORDER: number[] = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function timeToInputValue(t: string): string {
  if (!t) return "09:00";
  const parts = String(t).trim().split(":");
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    return `${h}:${m}`;
  }
  return "09:00";
}

type DayState = { closed: boolean; startLocal: string; endLocal: string };

function buildInitialState(
  staff: { id: string }[],
  hours: { staff_id: string; day_of_week: number; start_local: string; end_local: string }[]
): Record<string, Record<number, DayState>> {
  const byStaffDay = new Map<string, Map<number, DayState>>();
  for (const s of staff) {
    byStaffDay.set(s.id, new Map());
    for (const d of DAY_ORDER) {
      const row = hours.find((h) => h.staff_id === s.id && h.day_of_week === d);
      byStaffDay.get(s.id)!.set(d, {
        closed: !row,
        startLocal: row ? timeToInputValue(row.start_local) : "09:00",
        endLocal: row ? timeToInputValue(row.end_local) : "17:00",
      });
    }
  }
  const out: Record<string, Record<number, DayState>> = {};
  byStaffDay.forEach((days, staffId) => {
    out[staffId] = Object.fromEntries(days);
  });
  return out;
}

function compareTime(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  if (ah !== bh) return ah - bh;
  return am - bm;
}

export function HoursEditor({
  staff,
  initialHours,
  shopId: _shopId,
}: {
  staff: { id: string; name: string; active: boolean }[];
  initialHours: {
    staff_id: string;
    day_of_week: number;
    start_local: string;
    end_local: string;
  }[];
  shopId: string;
}) {
  const router = useRouter();
  const initialState = useMemo(
    () => buildInitialState(staff, initialHours),
    [staff, initialHours]
  );

  const [state, setState] = useState<Record<string, Record<number, DayState>>>(initialState);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successStaffId, setSuccessStaffId] = useState<string | null>(null);

  const updateDay = (
    staffId: string,
    dayOfWeek: number,
    patch: Partial<DayState>
  ) => {
    setState((prev) => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [dayOfWeek]: { ...prev[staffId][dayOfWeek], ...patch },
      },
    }));
    setError(null);
  };

  const validateStaffDays = (staffId: string): string | null => {
    const days = state[staffId];
    if (!days) return null;
    for (const d of DAY_ORDER) {
      const day = days[d];
      if (!day || day.closed) continue;
      if (compareTime(day.startLocal, day.endLocal) >= 0) {
        return `End time must be after start time (${DAY_LABELS[DAY_ORDER.indexOf(d)]}).`;
      }
    }
    return null;
  };

  const handleSave = async (staffId: string) => {
    const err = validateStaffDays(staffId);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSuccessStaffId(null);
    setSavingStaffId(staffId);
    try {
      const days = DAY_ORDER.map((dayOfWeek) => {
        const day = state[staffId][dayOfWeek];
        return {
          dayOfWeek,
          closed: day.closed,
          startLocal: day.closed ? undefined : day.startLocal,
          endLocal: day.closed ? undefined : day.endLocal,
        };
      });
      const res = await fetch("/api/owner/hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, days }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to save.");
        return;
      }
      setSuccessStaffId(staffId);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSavingStaffId(null);
    }
  };

  const inputClass =
    "rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200";
  const labelClass = "text-sm font-medium text-neutral-700 dark:text-neutral-300";

  if (staff.length === 0) {
    return (
      <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
        No staff. Add staff to set working hours.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {staff.map((s) => (
        <section
          key={s.id}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-700 dark:bg-neutral-800">
            <h2 className={labelClass}>
              {s.name}
              {!s.active && (
                <span className="ml-2 text-neutral-500">(inactive)</span>
              )}
            </h2>
            <button
              type="button"
              onClick={() => handleSave(s.id)}
              disabled={savingStaffId === s.id}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {savingStaffId === s.id ? "Saving…" : "Save"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="px-4 py-2 text-left font-medium text-neutral-600 dark:text-neutral-400">
                    Day
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-600 dark:text-neutral-400">
                    Closed
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-600 dark:text-neutral-400">
                    Start
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-600 dark:text-neutral-400">
                    End
                  </th>
                </tr>
              </thead>
              <tbody>
                {DAY_ORDER.map((dayOfWeek, idx) => {
                  const day = state[s.id]?.[dayOfWeek] ?? {
                    closed: true,
                    startLocal: "09:00",
                    endLocal: "17:00",
                  };
                  return (
                    <tr
                      key={dayOfWeek}
                      className="border-b border-neutral-100 dark:border-neutral-800"
                    >
                      <td className="px-4 py-2 font-medium text-neutral-800 dark:text-neutral-200">
                        {DAY_LABELS[idx]}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={day.closed}
                          onChange={(e) =>
                            updateDay(s.id, dayOfWeek, { closed: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 dark:border-neutral-600 dark:bg-neutral-800"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="time"
                          value={day.startLocal}
                          onChange={(e) =>
                            updateDay(s.id, dayOfWeek, { startLocal: e.target.value })
                          }
                          disabled={day.closed}
                          className={inputClass}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="time"
                          value={day.endLocal}
                          onChange={(e) =>
                            updateDay(s.id, dayOfWeek, { endLocal: e.target.value })
                          }
                          disabled={day.closed}
                          className={inputClass}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {successStaffId === s.id && (
            <p className="px-4 py-2 text-sm text-green-600 dark:text-green-400">
              Saved.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
