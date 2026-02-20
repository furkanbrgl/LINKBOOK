"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
  active: boolean;
};

/** Convert price_cents to decimal string for display (e.g. 35050 → "350.50"). */
function centsToDisplay(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(/\.?0+$/, "");
}

/** Parse decimal string (e.g. "350.50") to cents, or null if empty/invalid. */
function displayToCents(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseFloat(t);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

async function postJSON(
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : "Request failed.",
    };
  }
  return { ok: true };
}

export function ServicesEditor({
  services: initialServices,
}: {
  services: ServiceRow[];
}) {
  const router = useRouter();
  const [services, setServices] = useState(initialServices);

  useEffect(() => {
    setServices(initialServices);
  }, [initialServices]);

  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState("60");
  const [newPrice, setNewPrice] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const inputClass =
    "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200";

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setCreateError("Name is required.");
      return;
    }
    const duration = parseInt(newDuration, 10);
    if (Number.isNaN(duration) || duration < 1) {
      setCreateError("Duration must be at least 1 minute.");
      return;
    }
    const price_cents = displayToCents(newPrice);
    if (newPrice.trim() !== "" && price_cents === null) {
      setCreateError("Price must be a valid number ≥ 0.");
      return;
    }
    setCreateError(null);
    setCreateLoading(true);
    try {
      const result = await postJSON("/api/owner/services/create", {
        name,
        duration_minutes: duration,
        price_cents: price_cents ?? undefined,
      });
      if (!result.ok) {
        setCreateError(result.error ?? "Failed to create.");
        return;
      }
      setNewName("");
      setNewDuration("60");
      setNewPrice("");
      router.refresh();
    } catch {
      setCreateError("Something went wrong.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleUpdate(
    row: ServiceRow,
    name: string,
    duration_minutes: number,
    price_cents: number | null,
    active: boolean
  ) {
    const trimmed = name.trim();
    if (!trimmed) {
      setRowError("Name is required.");
      return;
    }
    if (duration_minutes < 1) {
      setRowError("Duration must be at least 1 minute.");
      return;
    }
    if (price_cents !== null && price_cents < 0) {
      setRowError("Price must be ≥ 0.");
      return;
    }
    setRowError(null);
    setSuccessId(null);
    setSavingId(row.id);
    try {
      const result = await postJSON("/api/owner/services/update", {
        serviceId: row.id,
        name: trimmed,
        duration_minutes,
        price_cents,
        active,
      });
      if (!result.ok) {
        setRowError(result.error ?? "Failed to save.");
        return;
      }
      setServices((prev) =>
        prev.map((s) =>
          s.id === row.id
            ? { ...s, name: trimmed, duration_minutes, price_cents, active }
            : s
        )
      );
      setSuccessId(row.id);
      router.refresh();
    } catch {
      setRowError("Something went wrong.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(serviceId: string) {
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const result = await postJSON("/api/owner/services/delete", {
        serviceId,
      });
      if (!result.ok) {
        if (result.error?.includes("bookings")) {
          setDeleteError("Service has bookings; deactivate instead.");
        } else {
          setDeleteError(result.error ?? "Failed to delete.");
        }
        return;
      }
      setDeleteConfirmId(null);
      router.refresh();
    } catch {
      setDeleteError("Something went wrong.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Add service */}
      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
        <h2 className="mb-3 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Add service
        </h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="new-service-name" className="sr-only">
              Name
            </label>
            <input
              id="new-service-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Service name"
              className={inputClass}
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="new-service-duration" className="sr-only">
              Duration (min)
            </label>
            <input
              id="new-service-duration"
              type="number"
              min={1}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              placeholder="60"
              className={`${inputClass} w-20`}
            />
          </div>
          <div>
            <label htmlFor="new-service-price" className="sr-only">
              Price (₺)
            </label>
            <input
              id="new-service-price"
              type="text"
              inputMode="decimal"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="₺ optional"
              className={`${inputClass} w-28`}
            />
          </div>
          <button
            type="submit"
            disabled={createLoading}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {createLoading ? "Creating…" : "Create"}
          </button>
        </form>
        {createError && (
          <p
            className="mt-2 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {createError}
          </p>
        )}
      </section>

      {/* Services list */}
      <section className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-semibold text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          Services list
        </h2>
        {rowError && (
          <p
            className="px-4 py-2 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {rowError}
          </p>
        )}
        {services.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">
            No services yet. Add one above.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {services.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
              >
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((s) =>
                        s.id === row.id ? { ...s, name: e.target.value } : s
                      )
                    )
                  }
                  className={`${inputClass} min-w-[120px] max-w-[180px]`}
                  placeholder="Name"
                />
                <input
                  type="number"
                  min={1}
                  value={row.duration_minutes}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((s) =>
                        s.id === row.id
                          ? {
                              ...s,
                              duration_minutes: parseInt(e.target.value, 10) || 1,
                            }
                          : s
                      )
                    )
                  }
                  className={`${inputClass} w-20`}
                />
                <span className="text-neutral-500 dark:text-neutral-400">
                  min
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={centsToDisplay(row.price_cents)}
                  onChange={(e) => {
                    const v = e.target.value;
                    const cents = displayToCents(v);
                    setServices((prev) =>
                      prev.map((s) =>
                        s.id === row.id
                          ? { ...s, price_cents: cents } 
                          : s
                      )
                    );
                  }}
                  placeholder="₺"
                  className={`${inputClass} w-24`}
                />
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(e) =>
                      setServices((prev) =>
                        prev.map((s) =>
                          s.id === row.id
                            ? { ...s, active: e.target.checked } 
                            : s
                        )
                      )
                    }
                    className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 dark:border-neutral-600 dark:bg-neutral-800"
                  />
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Active
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdate(
                      row,
                      row.name,
                      row.duration_minutes,
                      row.price_cents,
                      row.active
                    )
                  }
                  disabled={savingId === row.id}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  {savingId === row.id ? "Saving…" : "Save"}
                </button>
                {deleteConfirmId === row.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      disabled={deleteLoading}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      {deleteLoading ? "Deleting…" : "Confirm delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmId(null);
                        setDeleteError(null);
                      }}
                      className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600 dark:text-neutral-400"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(row.id)}
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    Delete
                  </button>
                )}
                {successId === row.id && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    Saved.
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {deleteError && deleteConfirmId && (
          <p
            className="px-4 py-2 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {deleteError}
          </p>
        )}
      </section>
    </div>
  );
}
