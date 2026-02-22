"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { OutboxRetryButton } from "./OutboxRetryButton";

const STATUS_VALUES = ["pending", "sent", "failed", "cancelled"] as const;
const EVENT_TYPES = [
  "BOOKING_CONFIRMED",
  "BOOKING_UPDATED",
  "BOOKING_CANCELLED",
  "BOOKING_CANCELLED_CUSTOMER",
  "BOOKING_CANCELLED_SHOP",
  "REMINDER_NEXT_DAY",
] as const;

type Row = {
  id: string;
  shop_id: string;
  booking_id: string | null;
  event_type: string;
  status: string;
  attempt_count: number;
  next_attempt_at: string | null;
  last_error: string | null;
  sent_at: string | null;
  created_at: string | null;
  payload_json: Record<string, unknown> | null;
  shopSlug: string;
  shopName: string;
};

function formatIso(str: string | null | undefined): string {
  if (!str) return "—";
  return str.slice(0, 19).replace("T", " ") + (str.endsWith("Z") ? "Z" : "");
}

export default function AdminOutboxPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [eventType, setEventType] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number]))
        params.set("status", status);
      if (eventType && EVENT_TYPES.includes(eventType as (typeof EVENT_TYPES)[number]))
        params.set("eventType", eventType);
      if (shopSlug.trim()) params.set("shop", shopSlug.trim());
      params.set("limit", "200");

      const res = await fetch(`/api/admin/outbox?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.replace("/login");
          return;
        }
        setError(data.error ?? "Failed to load outbox");
        setRows([]);
        return;
      }

      setRows(data.items ?? []);
    } catch {
      setError("Request failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, eventType, shopSlug, router]);

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch on mount only; Apply button triggers refetch
  }, []);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRows();
  };

  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-800">Admin Outbox</h1>

      {error && <p className="mt-2 text-red-600">{error}</p>}

      <form onSubmit={handleApply} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="sent">sent</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Event type</span>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {EVENT_TYPES.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Shop slug</span>
          <input
            type="text"
            value={shopSlug}
            onChange={(e) => setShopSlug(e.target.value)}
            placeholder="shop-slug"
            className="w-40 rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
        >
          Apply
        </button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-600">
              <th className="p-2 font-medium">created_at</th>
              <th className="p-2 font-medium">shop</th>
              <th className="p-2 font-medium">event_type</th>
              <th className="p-2 font-medium">status</th>
              <th className="p-2 font-medium">attempts</th>
              <th className="p-2 font-medium">next_attempt_at</th>
              <th className="p-2 font-medium">sent_at</th>
              <th className="p-2 font-medium">booking_id</th>
              <th className="p-2 font-medium">recipient</th>
              <th className="p-2 font-medium">subject</th>
              <th className="p-2 font-medium">last_error</th>
              <th className="p-2 font-medium">preview</th>
              <th className="p-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className="p-4 text-center text-zinc-500">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-4 text-center text-zinc-500">
                  No results
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const p = row.payload_json as Record<string, unknown> | null;
                const recipient = String(p?.toEmail ?? p?.customerEmail ?? "-");
                const subject = String(p?.subject ?? "-");
                const lastErrorDisplay =
                  row.last_error != null
                    ? String(row.last_error).slice(0, 120) +
                      (row.last_error.length > 120 ? "…" : "")
                    : "—";

                return (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50"
                  >
                    <td className="p-2 text-zinc-700">
                      {formatIso(row.created_at)}
                    </td>
                    <td className="p-2 text-zinc-700">{row.shopSlug}</td>
                    <td className="p-2 text-zinc-700">{row.event_type}</td>
                    <td className="p-2 text-zinc-700">{row.status}</td>
                    <td className="p-2 text-zinc-700">{row.attempt_count}</td>
                    <td className="p-2 text-zinc-700">
                      {formatIso(row.next_attempt_at)}
                    </td>
                    <td className="p-2 text-zinc-700">
                      {formatIso(row.sent_at)}
                    </td>
                    <td className="p-2 font-mono text-zinc-600">
                      {row.booking_id
                        ? String(row.booking_id).slice(0, 8) + "…"
                        : "—"}
                    </td>
                    <td
                      className="max-w-[180px] truncate p-2 text-zinc-700"
                      title={recipient !== "-" ? recipient : undefined}
                    >
                      {recipient}
                    </td>
                    <td
                      className="max-w-[200px] truncate p-2 text-zinc-700"
                      title={subject !== "-" ? subject : undefined}
                    >
                      {subject}
                    </td>
                    <td
                      className="max-w-[200px] truncate p-2 text-zinc-600"
                      title={row.last_error ?? ""}
                    >
                      {lastErrorDisplay}
                    </td>
                    <td className="p-2">
                      <details className="text-xs">
                        <summary className="cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-neutral-300">
                          Preview
                        </summary>
                        <div className="mt-2 space-y-2 rounded border border-neutral-200 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900">
                          <div>
                            <span className="text-neutral-500">To:</span>{" "}
                            {recipient}
                          </div>
                          <div>
                            <span className="text-neutral-500">Subject:</span>{" "}
                            {subject}
                          </div>
                          {typeof p?.text === "string" && (
                            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-2 text-xs dark:bg-neutral-800">
                              {p.text}
                            </pre>
                          )}
                          {!p?.text && (
                            <div className="text-neutral-500">
                              No text body stored for this item.
                            </div>
                          )}
                          {typeof p?.manageUrl === "string" && (
                            <div>
                              <span className="text-neutral-500">
                                Manage:
                              </span>{" "}
                              <a
                                className="text-blue-600 underline"
                                href={p.manageUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open
                              </a>
                            </div>
                          )}
                          {typeof p?.rebookUrl === "string" && (
                            <div>
                              <span className="text-neutral-500">
                                Rebook:
                              </span>{" "}
                              <a
                                className="text-blue-600 underline"
                                href={p.rebookUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open
                              </a>
                            </div>
                          )}
                        </div>
                      </details>
                    </td>
                    <td className="p-2">
                      <OutboxRetryButton
                        id={row.id}
                        status={row.status}
                        onRetry={fetchRows}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
