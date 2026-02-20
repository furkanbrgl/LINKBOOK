"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type StaffRow = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export function StaffEditor({ staff: initialStaff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const [staff, setStaff] = useState(initialStaff);

  useEffect(() => {
    setStaff(initialStaff);
  }, [initialStaff]);
  const [newName, setNewName] = useState("");
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
    setCreateError(null);
    setCreateLoading(true);
    try {
      const res = await fetch("/api/owner/staff/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(typeof data.error === "string" ? data.error : "Failed to create.");
        return;
      }
      setNewName("");
      router.refresh();
    } catch {
      setCreateError("Something went wrong.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleUpdate(row: StaffRow, name: string, active: boolean) {
    const trimmed = name.trim();
    if (!trimmed) {
      setRowError("Name is required.");
      return;
    }
    setRowError(null);
    setSuccessId(null);
    setSavingId(row.id);
    try {
      const res = await fetch("/api/owner/staff/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: row.id, name: trimmed, active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRowError(typeof data.error === "string" ? data.error : "Failed to save.");
        return;
      }
      setStaff((prev) =>
        prev.map((s) =>
          s.id === row.id ? { ...s, name: trimmed, active } : s
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

  async function handleDelete(staffId: string) {
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/owner/staff/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setDeleteError("Staff has bookings; deactivate instead.");
        } else {
          setDeleteError(typeof data.error === "string" ? data.error : "Failed to delete.");
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
      {/* Add staff */}
      <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
          Add staff
        </h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="new-staff-name" className="sr-only">
              Name
            </label>
            <input
              id="new-staff-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Staff name"
              className={inputClass}
              maxLength={200}
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
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {createError}
          </p>
        )}
      </section>

      {/* Staff list */}
      <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-semibold text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          Staff list
        </h2>
        {rowError && (
          <p className="px-4 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {rowError}
          </p>
        )}
        {staff.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">
            No staff yet. Add one above.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {staff.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
              >
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) =>
                    setStaff((prev) =>
                      prev.map((s) =>
                        s.id === row.id ? { ...s, name: e.target.value } : s
                      )
                    )
                  }
                  className={`${inputClass} min-w-[120px] max-w-[200px]`}
                  placeholder="Name"
                />
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(e) =>
                      setStaff((prev) =>
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
                  onClick={() => handleUpdate(row, row.name, row.active)}
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
          <p className="px-4 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {deleteError}
          </p>
        )}
      </section>
    </div>
  );
}
