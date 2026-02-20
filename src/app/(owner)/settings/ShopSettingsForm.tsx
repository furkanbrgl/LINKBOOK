"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type ShopSettingsInitial = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  phone: string | null;
  address: string | null;
  reminder_next_day_enabled: boolean;
  reminder_next_day_send_time_local: string;
  is_active: boolean;
};

/** Normalize "19:00:00" or "19:00" to "19:00" for input type="time". */
function reminderTimeToInputValue(value: string): string {
  if (!value) return "";
  const parts = value.trim().split(":");
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    return `${h}:${m}`;
  }
  return value;
}

export function ShopSettingsForm({
  initialShop,
}: {
  initialShop: ShopSettingsInitial;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialShop.name);
  const [slug, setSlug] = useState(initialShop.slug);
  const [timezone, setTimezone] = useState(initialShop.timezone);
  const [phone, setPhone] = useState(initialShop.phone ?? "");
  const [address, setAddress] = useState(initialShop.address ?? "");
  const [reminderEnabled, setReminderEnabled] = useState(
    initialShop.reminder_next_day_enabled
  );
  const [reminderTime, setReminderTime] = useState(
    reminderTimeToInputValue(initialShop.reminder_next_day_send_time_local)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/owner/settings/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: initialShop.id,
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          timezone: timezone.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          reminder_next_day_enabled: reminderEnabled,
          reminder_next_day_send_time_local:
            reminderTime.length === 5 ? `${reminderTime}:00` : reminderTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.error === "slug_taken") {
          setError("Slug already taken.");
        } else {
          setError(
            typeof data.error === "string"
              ? data.error
              : "Failed to save settings."
          );
        }
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder:text-neutral-500";
  const labelClass =
    "mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300";

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
      <div>
        <label htmlFor="name" className={labelClass}>
          Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
          placeholder="Shop name"
        />
      </div>

      <div>
        <label htmlFor="slug" className={labelClass}>
          Slug
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          required
          className={inputClass}
          placeholder="my-shop"
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Lowercase letters, numbers, and hyphens only. Used in the public URL.
        </p>
      </div>

      <div>
        <p className={labelClass}>Public booking link</p>
        <Link
          href={`/${slug || initialShop.slug}`}
          className="text-sm font-medium text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          /{slug || initialShop.slug}
        </Link>
      </div>

      <div>
        <label htmlFor="timezone" className={labelClass}>
          Timezone
        </label>
        <input
          id="timezone"
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          required
          className={inputClass}
          placeholder="Europe/Istanbul"
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          IANA timezone e.g. Europe/Istanbul
        </p>
      </div>

      <div>
        <label htmlFor="phone" className={labelClass}>
          Phone (optional)
        </label>
        <input
          id="phone"
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
          placeholder="+90 5xx xxx xx xx"
        />
      </div>

      <div>
        <label htmlFor="address" className={labelClass}>
          Address (optional)
        </label>
        <textarea
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          className={inputClass}
          placeholder="Street, city, country"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="reminder_enabled"
          type="checkbox"
          checked={reminderEnabled}
          onChange={(e) => setReminderEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 dark:border-neutral-600 dark:bg-neutral-800"
        />
        <label
          htmlFor="reminder_enabled"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Send next-day reminder to customers
        </label>
      </div>

      <div>
        <label htmlFor="reminder_time" className={labelClass}>
          Reminder send time (local)
        </label>
        <input
          id="reminder_time"
          type="time"
          value={reminderTime}
          onChange={(e) => setReminderTime(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>
      )}

      <div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
