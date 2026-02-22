"use client";

import { useState, useEffect, useCallback } from "react";
import { DateTime } from "luxon";
import { cn } from "@/lib/utils";
import type { IndustryTemplate, Branding } from "@/lib/templates";

type Shop = { id: string; name: string; slug: string; timezone: string; phone: string | null };
type Service = { id: string; name: string; duration_minutes: number };
type Staff = { id: string; name: string };
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

const DEFAULT_VISIBLE_SLOTS = 16;
type SuccessPayload = {
  shopSlug: string;
  startAt: string;
  manageToken: string;
  shopName: string;
  timezone: string;
  serviceName: string;
  staffName: string;
  durationMinutes: number;
};

function downloadIcs(opts: {
  title: string;
  startUtcIso: string;
  endUtcIso: string;
  description: string;
  location?: string;
}) {
  const formatIcsUtc = (iso: string) => {
    const d = new Date(iso);
    return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  };
  const dtstamp = formatIcsUtc(new Date().toISOString());
  const dtstart = formatIcsUtc(opts.startUtcIso);
  const dtend = formatIcsUtc(opts.endUtcIso);
  const loc = opts.location ? `LOCATION:${opts.location.replace(/\n/g, "\\n")}\r\n` : "";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Linkbook//Booking//EN",
    "BEGIN:VEVENT",
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${opts.title.replace(/\n/g, "\\n")}`,
    `DESCRIPTION:${opts.description.replace(/\n/g, "\\n").replace(/,/g, "\\,")}`,
    loc,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "booking.ics";
  a.click();
  URL.revokeObjectURL(url);
}

// Helper components
function ServiceCard({
  service,
  selected,
  onClick,
  accentColor,
}: {
  service: Service;
  selected: boolean;
  onClick: () => void;
  accentColor?: string | null;
}) {
  const selectedStyle = accentColor ? { borderColor: accentColor, backgroundColor: `${accentColor}12` } : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border-2 px-4 py-3 transition-colors",
        selected
          ? "border-zinc-900"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
      )}
      style={selected ? selectedStyle : undefined}
    >
      <span className="font-medium text-zinc-900">{service.name}</span>
      <span className="ml-2 text-sm text-zinc-500">{service.duration_minutes} min</span>
    </button>
  );
}

function ProviderChip({
  staff,
  selected,
  onClick,
  accentColor,
}: {
  staff: Staff;
  selected: boolean;
  onClick: () => void;
  accentColor?: string | null;
}) {
  const selectedStyle = accentColor ? { borderColor: accentColor, backgroundColor: accentColor, color: "#fff" } : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors",
        selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
      )}
      style={selected ? selectedStyle : undefined}
    >
      {staff.name}
    </button>
  );
}

function SlotChip({
  slot,
  selected,
  onClick,
  accentColor,
}: {
  slot: Slot;
  selected: boolean;
  onClick: () => void;
  accentColor?: string | null;
}) {
  const selectedStyle = accentColor ? { borderColor: accentColor, backgroundColor: accentColor, color: "#fff" } : undefined;
  const label = slot.labelLocal ?? (slot as { label?: string }).label ?? slot.startAt;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 min-h-10 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
        selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
      )}
      style={selected ? selectedStyle : undefined}
    >
      {label}
    </button>
  );
}

function StepCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-900 text-right">{value}</span>
    </div>
  );
}

export function BookingWizard({
  shop,
  services,
  staff,
  minDate,
  template,
  branding,
}: {
  shop: Shop;
  services: Service[];
  staff: Staff[];
  minDate: string;
  template: IndustryTemplate;
  branding: Branding;
}) {
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedStartAt, setSelectedStartAt] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessPayload | null>(null);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [copied, setCopied] = useState(false);

  const accentColor = branding?.accentColor ?? null;

  const visibleSlots = showAllSlots ? slots : slots.slice(0, DEFAULT_VISIBLE_SLOTS);
  const hasMoreSlots = slots.length > DEFAULT_VISIBLE_SLOTS;
  const groupedSlots = groupSlotsByHour(visibleSlots);

  const fetchSlots = useCallback(async () => {
    if (!selectedDate || !selectedServiceId || !selectedStaffId) {
      setSlots([]);
      setSelectedStartAt("");
      setShowAllSlots(false);
      return;
    }
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedStartAt("");
    try {
      const url = `/api/availability?shop=${encodeURIComponent(shop.slug)}&staffId=${encodeURIComponent(selectedStaffId)}&serviceId=${encodeURIComponent(selectedServiceId)}&date=${selectedDate}`;
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
  }, [shop.slug, selectedDate, selectedServiceId, selectedStaffId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  useEffect(() => {
    setShowAllSlots(false);
  }, [selectedDate, selectedServiceId, selectedStaffId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!selectedServiceId || !selectedStaffId || !selectedStartAt) {
      setSubmitError("Please select service, staff, date and time.");
      return;
    }
    if (!customerName.trim() || customerName.trim().length < 2) {
      setSubmitError("Name must be at least 2 characters.");
      return;
    }
    if (!phone.trim()) {
      setSubmitError("Phone is required.");
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug: shop.slug,
          serviceId: selectedServiceId,
          staffId: selectedStaffId,
          startAt: selectedStartAt,
          name: customerName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          honeypot: "",
        }),
      });
      const data = await res.json();

if (!res.ok) {
  if (res.status === 409) {
    setSubmitError("That time was just booked. Please pick another time.");
    await fetchSlots(); // refresh slots so the taken one disappears
    return;
  }
  setSubmitError(data.error ?? "Booking failed");
  return;
}
      const selectedService = services.find((s) => s.id === selectedServiceId);
      const serviceName = selectedService?.name ?? "";
      const durationMinutes = selectedService?.duration_minutes ?? 30;
      const staffName =
        (typeof data.staffName === "string" && data.staffName.trim()
          ? data.staffName
          : null) ??
        staff.find((s) => s.id === selectedStaffId)?.name ??
        "";
      setSuccess({
        shopSlug: data.shopSlug,
        startAt: data.startAt,
        manageToken: data.manageToken,
        shopName: shop.name,
        timezone: shop.timezone,
        serviceName,
        staffName,
        durationMinutes,
      });
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (success) {
    const dt = DateTime.fromISO(success.startAt, { zone: "utc" }).setZone(success.timezone);
    const formattedDateTime = dt.toFormat("EEE, d MMM yyyy · HH:mm");
    const manageUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/m/${success.manageToken}`
        : `/m/${success.manageToken}`;
    const rebookUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/${success.shopSlug}`
        : `/${success.shopSlug}`;
    const endAtIso = DateTime.fromISO(success.startAt, { zone: "utc" })
      .plus({ minutes: success.durationMinutes })
      .toISO();

    const handleCopy = async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(manageUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      } catch {
        /* fallback: link is shown and user can select manually */
      }
    };

    const handleAddToCalendar = () => {
      downloadIcs({
        title: `${success.shopName} — ${success.serviceName}`,
        startUtcIso: success.startAt,
        endUtcIso: endAtIso ?? success.startAt,
        description: `Manage: ${manageUrl}\nRebook: ${rebookUrl}`,
      });
    };

    const providerLabel = success.staffName?.trim() ? success.staffName : "No preference";

    return (
      <div className="mx-auto max-w-xl p-4 sm:p-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-800">Booking confirmed</h2>

          <div className="mt-4 space-y-2 divide-y divide-zinc-100">
            <div className="flex justify-between gap-4 py-2 text-sm">
              <span className="text-zinc-500">Shop</span>
              <span className="font-medium text-zinc-900 text-right">{success.shopName}</span>
            </div>
            <div className="flex justify-between gap-4 py-2 text-sm">
              <span className="text-zinc-500">Service</span>
              <span className="font-medium text-zinc-900 text-right">{success.serviceName}</span>
            </div>
            <div className="flex justify-between gap-4 py-2 text-sm">
              <span className="text-zinc-500">Provider</span>
              <span className="font-medium text-zinc-900 text-right">{providerLabel}</span>
            </div>
            <div className="flex justify-between gap-4 py-2 text-sm">
              <span className="text-zinc-500">When</span>
              <span className="font-medium text-zinc-900 text-right">{formattedDateTime}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border-2 border-zinc-800 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              {copied ? "Copied!" : "Copy manage link"}
            </button>
            <button
              type="button"
              onClick={handleAddToCalendar}
              className="rounded-lg border-2 border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              Add to calendar
            </button>
            <a
              href={`/${success.shopSlug}`}
              className="rounded-lg border-2 border-zinc-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              Book another time
            </a>
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            Need to reschedule or cancel? Use your manage link.
          </p>

          <div className="mt-3 flex justify-between gap-4 border-t border-zinc-100 py-3 text-sm">
            <span className="shrink-0 text-zinc-500">Manage link</span>
            <a
              href={manageUrl}
              className="break-all text-right text-blue-600 underline hover:text-blue-700"
            >
              {manageUrl}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const selectedStaff = staff.find((s) => s.id === selectedStaffId);
  const selectedSlot = slots.find((s) => s.startAt === selectedStartAt);
  const formattedDate =
  selectedDate
    ? DateTime.fromFormat(selectedDate, "yyyy-MM-dd", { zone: shop.timezone }).toFormat("EEE, d MMM")
    : null;
  const formattedTime = selectedSlot?.labelLocal ?? null;
  const isFormComplete =
    selectedServiceId &&
    selectedStaffId &&
    selectedDate &&
    selectedStartAt &&
    customerName.trim().length >= 2 &&
    phone.trim();
  const accentStyle = accentColor ? { backgroundColor: accentColor } : { backgroundColor: "#18181b" };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-10">
          {/* Left column: steps */}
          <div className="flex-1 space-y-6">
            <StepCard title={`1. ${template.labels.serviceLabel}`}>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((s) => (
                  <ServiceCard
                    key={s.id}
                    service={s}
                    selected={selectedServiceId === s.id}
                    onClick={() => {
                      setSelectedServiceId(s.id);
                      setSelectedStartAt("");
                    }}
                    accentColor={accentColor}
                  />
                ))}
              </div>
            </StepCard>

            <StepCard title={`2. ${template.labels.providerLabel}`}>
              <div className="flex flex-wrap gap-2">
                <ProviderChip
                  staff={{ id: "any", name: "No preference" }}
                  selected={selectedStaffId === "any"}
                  onClick={() => {
                    setSelectedStaffId("any");
                    setSelectedStartAt("");
                  }}
                  accentColor={accentColor}
                />
                {staff.map((s) => (
                  <ProviderChip
                    key={s.id}
                    staff={s}
                    selected={selectedStaffId === s.id}
                    onClick={() => {
                      setSelectedStaffId(s.id);
                      setSelectedStartAt("");
                    }}
                    accentColor={accentColor}
                  />
                ))}
              </div>
            </StepCard>

            <StepCard title="3. Date">
              <input
                type="date"
                min={minDate}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedStartAt("");
                }}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-zinc-900"
                required
              />
            </StepCard>

            <StepCard title="4. Time">
              {slotsLoading && selectedDate && selectedServiceId && selectedStaffId && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded-lg bg-zinc-200"
                    />
                  ))}
                </div>
              )}
              {slotsError && (
                <p className="text-sm text-red-600">{slotsError}</p>
              )}
              {!slotsLoading && !slotsError && selectedDate && selectedServiceId && selectedStaffId && slots.length === 0 && (
                <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 py-8 text-center text-sm text-zinc-500">
                  No slots available this day. Try another date.
                </p>
              )}
              {!slotsLoading && slots.length > 0 && (
                <>
                  <div className={cn(showAllSlots && "max-h-[340px] overflow-auto pr-1")}>
                    <div className="space-y-4">
                      {groupedSlots.map((g) => (
                        <div key={g.hour}>
                          <div className="mb-2 text-xs font-semibold text-zinc-500">{g.hour}</div>
                          <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                            {g.slots.map((slot) => (
                              <SlotChip
                                key={slot.startAt}
                                slot={slot}
                                selected={selectedStartAt === slot.startAt}
                                onClick={() => setSelectedStartAt(slot.startAt)}
                                accentColor={accentColor}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {hasMoreSlots && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setShowAllSlots((prev) => !prev)}
                        className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900"
                      >
                        {showAllSlots
                          ? "Show fewer times"
                          : `Show more times (${slots.length - DEFAULT_VISIBLE_SLOTS} more)`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </StepCard>
            {(!selectedServiceId || !selectedStaffId || !selectedDate) && (
  <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 py-6 text-center text-sm text-zinc-500">
    Select a {template.labels.serviceLabel.toLowerCase()}, {template.labels.providerLabel.toLowerCase()}, and date to see available times.
  </p>
)}
            <StepCard title={`5. ${template.labels.customerLabel} details`}>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    {template.labels.customerLabel} name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    minLength={2}
                    maxLength={80}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
                    placeholder="Your name"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
                    placeholder="+90 5xx xxx xx xx"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
                    placeholder="you@example.com"
                  />
                </div>
                <input type="text" name="honeypot" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden />
              </div>
            </StepCard>
          </div>

          {/* Right column: summary card */}
          <div className="md:w-[360px] md:flex-shrink-0">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm md:sticky md:top-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                {template.ui.scheduleTitle}
              </h3>
              <div className="divide-y divide-zinc-100">
                <SummaryRow label="Shop" value={shop.name} />
                <SummaryRow label={template.labels.serviceLabel} value={selectedService?.name ?? null} />
                <SummaryRow label={template.labels.providerLabel} value={selectedStaff?.name ?? null} />
                <SummaryRow label="Date" value={formattedDate} />
                <SummaryRow label="Time" value={formattedTime} />
                <SummaryRow
                  label="Duration"
                  value={selectedService ? `${selectedService.duration_minutes} min` : null}
                />
              </div>

              {submitError && (
                <p className="mt-4 text-sm text-red-600">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitLoading || !isFormComplete}
                className="mt-5 w-full rounded-lg py-3 font-medium text-white transition-opacity disabled:opacity-50 disabled:pointer-events-none"
                style={accentStyle}
              >
                {submitLoading ? "Booking…" : template.ui.ctaConfirm}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
