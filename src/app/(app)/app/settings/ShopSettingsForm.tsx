"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const INDUSTRY_OPTIONS = [
  { value: "generic", label: "Generic" },
  { value: "barber", label: "Barber" },
  { value: "dental", label: "Dental" },
] as const;

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
  industry_template: "generic" | "barber" | "dental";
  branding: { logoUrl?: string | null; accentColor?: string | null; coverImageUrl?: string | null };
  template_overrides: {
    labels?: { providerLabel?: string; serviceLabel?: string; customerLabel?: string };
    ui?: { ctaConfirm?: string };
    bookingCopy?: { heroTitle?: string; heroSubtitle?: string };
  } | null;
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
  const [industryTemplate, setIndustryTemplate] = useState<
    "generic" | "barber" | "dental"
  >(initialShop.industry_template);
  const [accentColor, setAccentColor] = useState(
    initialShop.branding?.accentColor ?? ""
  );
  const [providerLabel, setProviderLabel] = useState(
    initialShop.template_overrides?.labels?.providerLabel ?? ""
  );
  const [serviceLabel, setServiceLabel] = useState(
    initialShop.template_overrides?.labels?.serviceLabel ?? ""
  );
  const [customerLabel, setCustomerLabel] = useState(
    initialShop.template_overrides?.labels?.customerLabel ?? ""
  );
  const [ctaConfirm, setCtaConfirm] = useState(
    initialShop.template_overrides?.ui?.ctaConfirm ?? ""
  );
  const [heroTitle, setHeroTitle] = useState(
    initialShop.template_overrides?.bookingCopy?.heroTitle ?? ""
  );
  const [heroSubtitle, setHeroSubtitle] = useState(
    initialShop.template_overrides?.bookingCopy?.heroSubtitle ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const templateLabel =
    INDUSTRY_OPTIONS.find((o) => o.value === industryTemplate)?.label ??
    industryTemplate;
  const overridesCount = [
    providerLabel.trim(),
    serviceLabel.trim(),
    customerLabel.trim(),
    ctaConfirm.trim(),
    heroTitle.trim(),
    heroSubtitle.trim(),
  ].filter(Boolean).length;

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
          industry_template: industryTemplate,
          branding: {
            ...(accentColor.trim() && {
              accentColor: accentColor.trim(),
            }),
          },
          ...(providerLabel.trim() ||
          serviceLabel.trim() ||
          customerLabel.trim() ||
          ctaConfirm.trim() ||
          heroTitle.trim() ||
          heroSubtitle.trim()
            ? {
                template_overrides: {
                  ...(providerLabel.trim() ||
                  serviceLabel.trim() ||
                  customerLabel.trim()
                    ? {
                        labels: {
                          ...(providerLabel.trim() && { providerLabel: providerLabel.trim() }),
                          ...(serviceLabel.trim() && { serviceLabel: serviceLabel.trim() }),
                          ...(customerLabel.trim() && { customerLabel: customerLabel.trim() }),
                        },
                      }
                    : {}),
                  ...(ctaConfirm.trim() ? { ui: { ctaConfirm: ctaConfirm.trim() } } : {}),
                  ...(heroTitle.trim() || heroSubtitle.trim()
                    ? {
                        bookingCopy: {
                          ...(heroTitle.trim() && { heroTitle: heroTitle.trim() }),
                          ...(heroSubtitle.trim() && { heroSubtitle: heroSubtitle.trim() }),
                        },
                      }
                    : {}),
                },
              }
            : {}),
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
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${slug || initialShop.slug}`}
            className="text-sm font-medium text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            /{slug || initialShop.slug}
          </Link>
          <a
            href={`/${slug || initialShop.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
          >
            Preview booking page
          </a>
        </div>
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

      <Accordion type="multiple" defaultValue={["template", "branding"]}>
        <AccordionItem value="template">
          <AccordionTrigger className="text-neutral-800 dark:text-neutral-200">
            <span className="flex items-center">
              <span className="font-semibold">Template</span>
              <span className="ml-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                {templateLabel}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div>
              <label htmlFor="industry_template" className={labelClass}>
                Industry template
              </label>
              <select
                id="industry_template"
                value={industryTemplate}
                onChange={(e) =>
                  setIndustryTemplate(
                    e.target.value as "generic" | "barber" | "dental"
                  )
                }
                className={inputClass}
              >
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Changes labels/copy. Does not modify your services or bookings.
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const message =
                    overridesCount > 0
                      ? "Reset to Generic template? This will also clear wording overrides."
                      : "Reset to Generic template?";
                  if (!confirm(message)) return;
                  const alsoClear = overridesCount > 0;
                  setLoading(true);
                  setError(null);
                  try {
                    const res = await fetch("/api/owner/settings/shop", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        shopId: initialShop.id,
                        industry_template: "generic",
                        ...(alsoClear ? { reset_template_overrides: true } : {}),
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setError(
                        typeof data.error === "string" ? data.error : "Failed to reset."
                      );
                      return;
                    }
                    setIndustryTemplate("generic");
                    if (alsoClear) {
                      setProviderLabel("");
                      setServiceLabel("");
                      setCustomerLabel("");
                      setCtaConfirm("");
                      setHeroTitle("");
                      setHeroSubtitle("");
                    }
                    router.refresh();
                  } catch {
                    setError("Something went wrong.");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
              >
                Reset template
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="branding">
          <AccordionTrigger className="text-neutral-800 dark:text-neutral-200">
            <span className="flex items-center">
              <span className="font-semibold">Branding</span>
              {accentColor.trim() && (
                <span
                  className="ml-2 inline-block h-3 w-3 shrink-0 rounded-full border border-neutral-300 dark:border-neutral-600"
                  style={{ backgroundColor: accentColor.trim() }}
                  aria-hidden
                />
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div>
              <label htmlFor="accent_color" className={labelClass}>
                Accent color
              </label>
              <input
                id="accent_color"
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className={inputClass}
                placeholder="#111827"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Hex color e.g. #0f766e (optional)
              </p>
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("Reset all branding (accent color, etc.)?")) return;
                  setLoading(true);
                  setError(null);
                  try {
                    const res = await fetch("/api/owner/settings/shop", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        shopId: initialShop.id,
                        reset_branding: true,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setError(
                        typeof data.error === "string" ? data.error : "Failed to reset."
                      );
                      return;
                    }
                    setAccentColor("");
                    router.refresh();
                  } catch {
                    setError("Something went wrong.");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
              >
                Reset branding
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="wording">
          <AccordionTrigger className="text-neutral-800 dark:text-neutral-200">
            <span className="flex items-center">
              <span className="font-semibold">Wording</span>
              <span className="ml-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                Overrides: {overridesCount} field{overridesCount !== 1 ? "s" : ""}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
        <div className="space-y-3">
          <div>
            <label htmlFor="provider_label" className={labelClass}>
              Provider label
            </label>
            <input
              id="provider_label"
              type="text"
              value={providerLabel}
              onChange={(e) => setProviderLabel(e.target.value)}
              className={inputClass}
              placeholder="e.g. Staff, Barber"
            />
          </div>
          <div>
            <label htmlFor="service_label" className={labelClass}>
              Service label
            </label>
            <input
              id="service_label"
              type="text"
              value={serviceLabel}
              onChange={(e) => setServiceLabel(e.target.value)}
              className={inputClass}
              placeholder="e.g. Service, Treatment"
            />
          </div>
          <div>
            <label htmlFor="customer_label" className={labelClass}>
              Customer label
            </label>
            <input
              id="customer_label"
              type="text"
              value={customerLabel}
              onChange={(e) => setCustomerLabel(e.target.value)}
              className={inputClass}
              placeholder="e.g. Customer, Guest"
            />
          </div>
          <div>
            <label htmlFor="cta_confirm" className={labelClass}>
              Confirm button text
            </label>
            <input
              id="cta_confirm"
              type="text"
              value={ctaConfirm}
              onChange={(e) => setCtaConfirm(e.target.value)}
              className={inputClass}
              placeholder="e.g. Confirm booking"
            />
          </div>
          <div>
            <label htmlFor="hero_title" className={labelClass}>
              Hero title
            </label>
            <input
              id="hero_title"
              type="text"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Book your appointment"
            />
          </div>
          <div>
            <label htmlFor="hero_subtitle" className={labelClass}>
              Hero subtitle
            </label>
            <input
              id="hero_subtitle"
              type="text"
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Choose a time that works for you"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Reset all wording overrides to template defaults?")) return;
              setLoading(true);
              setError(null);
              try {
                const res = await fetch("/api/owner/settings/shop", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    shopId: initialShop.id,
                    reset_template_overrides: true,
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  setError(typeof data.error === "string" ? data.error : "Failed to reset.");
                  return;
                }
                setProviderLabel("");
                setServiceLabel("");
                setCustomerLabel("");
                setCtaConfirm("");
                setHeroTitle("");
                setHeroSubtitle("");
                router.refresh();
              } catch {
                setError("Something went wrong.");
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
          >
            Reset wording
          </button>
        </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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
