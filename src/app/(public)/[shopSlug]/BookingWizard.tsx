"use client";

import { useState, useEffect, useCallback } from "react";
import { DateTime } from "luxon";

type Shop = { id: string; name: string; slug: string; timezone: string; phone: string | null };
type Service = { id: string; name: string; duration_minutes: number };
type Staff = { id: string; name: string };
type Slot = { startAt: string; labelLocal: string };
type SuccessPayload = {
  shopSlug: string;
  startAt: string;
  manageToken: string;
  shopName: string;
  timezone: string;
  serviceName: string;
  staffName: string;
};

export function BookingWizard({
  shop,
  services,
  staff,
  minDate,
}: {
  shop: Shop;
  services: Service[];
  staff: Staff[];
  minDate: string;
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

  const fetchSlots = useCallback(async () => {
    if (!selectedDate || !selectedServiceId || !selectedStaffId) {
      setSlots([]);
      setSelectedStartAt("");
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
        setSubmitError(data.error ?? "Booking failed");
        return;
      }
      const serviceName = services.find((s) => s.id === selectedServiceId)?.name ?? "";
      const staffName = staff.find((s) => s.id === selectedStaffId)?.name ?? "";
      setSuccess({
        shopSlug: data.shopSlug,
        startAt: data.startAt,
        manageToken: data.manageToken,
        shopName: shop.name,
        timezone: shop.timezone,
        serviceName,
        staffName,
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
    return (
      <div className="p-4 sm:p-6 max-w-md mx-auto">
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200">
          <h2 className="text-lg font-semibold text-zinc-800">Booking confirmed</h2>
          <p className="mt-2 text-zinc-600">{success.shopName}</p>
          <p className="text-zinc-600">{success.serviceName} · {success.staffName}</p>
          <p className="mt-2 text-zinc-800 font-medium">{formattedDateTime}</p>
          <p className="mt-4 text-sm text-zinc-600">Manage your booking:</p>
          <a
            href={manageUrl}
            className="mt-1 block text-sm font-medium text-blue-600 underline break-all"
          >
            {manageUrl}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold text-zinc-800 mb-6">{shop.name}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Service */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Service</label>
          <select
            value={selectedServiceId}
            onChange={(e) => { setSelectedServiceId(e.target.value); setSlots([]); setSelectedStartAt(""); }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 bg-white"
            required
          >
            <option value="">Choose service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration_minutes} min)
              </option>
            ))}
          </select>
        </div>

        {/* Staff */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Staff</label>
          <select
            value={selectedStaffId}
            onChange={(e) => { setSelectedStaffId(e.target.value); setSlots([]); setSelectedStartAt(""); }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 bg-white"
            required
          >
            <option value="">Choose staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Date</label>
          <input
            type="date"
            min={minDate}
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedStartAt(""); }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 bg-white"
            required
          />
        </div>

        {/* Slots */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Time</label>
          {slotsLoading && <p className="text-sm text-zinc-500">Loading slots…</p>}
          {slotsError && <p className="text-sm text-red-600">{slotsError}</p>}
          {!slotsLoading && !slotsError && selectedDate && selectedServiceId && selectedStaffId && slots.length === 0 && (
            <p className="text-sm text-zinc-500">No slots available this day.</p>
          )}
          {!slotsLoading && slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.startAt}
                  type="button"
                  onClick={() => setSelectedStartAt(slot.startAt)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${selectedStartAt === slot.startAt ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
                >
                  {slot.labelLocal}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Customer */}
        <div className="space-y-3 pt-2 border-t border-zinc-200">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
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
            <label className="block text-sm font-medium text-zinc-700 mb-1">Phone</label>
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
            <label className="block text-sm font-medium text-zinc-700 mb-1">Email (optional)</label>
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

        {submitError && (
          <p className="text-sm text-red-600">{submitError}</p>
        )}

        <button
          type="submit"
          disabled={submitLoading || !selectedStartAt}
          className="w-full rounded-lg bg-zinc-900 py-3 text-white font-medium disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitLoading ? "Booking…" : "Confirm booking"}
        </button>
      </form>
    </div>
  );
}
