import { formatShopLocal } from "@/lib/time/tz";
import type { IndustryTemplate } from "@/lib/templates/types";
import type { Branding } from "@/lib/templates/types";

export type OutboxPayload = Record<string, unknown> & {
  shopName?: string;
  shopSlug?: string;
  timezone?: string;
  startAt?: string;
  endAt?: string;
  staffName?: string;
  serviceName?: string;
  customerName?: string;
  customerEmail?: string | null;
  toEmail?: string | null;
  manageToken?: string | null;
  manageUrl?: string | null;
  rebookUrl?: string | null;
};

export type RenderedEmail = {
  to: string | null;
  subject: string;
  html: string;
  text: string;
};

const EVENT_TYPES = [
  "BOOKING_CONFIRMED",
  "BOOKING_UPDATED",
  "BOOKING_CANCELLED",
  "BOOKING_CANCELLED_CUSTOMER",
  "BOOKING_CANCELLED_SHOP",
  "REMINDER_NEXT_DAY",
] as const;

function formatBookingLine(
  startAt: string,
  endAt: string,
  tz: string,
  opts?: { staffName?: string; serviceName?: string }
): string {
  const date = formatShopLocal(startAt, tz, "yyyy-MM-dd");
  const start = formatShopLocal(startAt, tz, "HH:mm");
  const end = formatShopLocal(endAt, tz, "HH:mm");
  let line = `${date} ${start}–${end}`;
  if (opts?.serviceName) line += ` • ${opts.serviceName}`;
  if (opts?.staffName) line += ` • ${opts.staffName}`;
  return line;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getAccentColor(branding: Branding, template: IndustryTemplate): string {
  return branding.accentColor ?? template.ui.accentColorDefault ?? "#111827";
}

export function renderEmail(
  eventType: string,
  payload: OutboxPayload,
  template: IndustryTemplate,
  branding: Branding,
  appBaseUrl: string
): RenderedEmail {
  const tz = (payload.timezone as string) ?? "UTC";
  const shopName = (payload.shopName as string) ?? "Shop";
  const shopSlug = (payload.shopSlug as string) ?? "";
  const startAt = payload.startAt as string | undefined;
  const endAt = payload.endAt as string | undefined;
  const staffName = payload.staffName as string | undefined;
  const serviceName = payload.serviceName as string | undefined;
  const customerName =
    (payload.customerName as string) ?? (payload.customerEmail as string) ?? template.labels.customerLabel;
  const toEmail =
    (payload.toEmail as string | null | undefined) ??
    (payload.customerEmail as string | null | undefined) ??
    null;
  const manageUrl =
    (payload.manageUrl as string | null | undefined) ??
    (payload.manageToken
      ? `${appBaseUrl.replace(/\/$/, "")}/m/${payload.manageToken}`
      : null);
  const rebookUrl =
    (payload.rebookUrl as string | null | undefined) ??
    (shopSlug ? `${appBaseUrl.replace(/\/$/, "")}/${shopSlug}` : null);

  const bookingLine =
    startAt && endAt
      ? formatBookingLine(startAt, endAt, tz, { staffName, serviceName })
      : "";

  const accentColor = getAccentColor(branding, template);
  const customerLabel = template.labels.customerLabel;

  const stubSubject = `[${eventType}] from ${shopName}`;

  switch (eventType) {
    case "BOOKING_CONFIRMED": {
      const subject = `Booking confirmed at ${shopName}`;
      const manageLink = manageUrl ? `<a href="${escapeHtml(manageUrl)}" style="display:inline-block;padding:10px 20px;background:${escapeHtml(accentColor)};color:#fff;text-decoration:none;border-radius:6px;">View or manage your ${template.labels.bookingNoun.toLowerCase()}</a>` : "";
      const html = [
        `<p>Hi ${escapeHtml(String(customerName))},</p>`,
        `<p>Your ${template.labels.bookingNoun.toLowerCase()} at <strong>${escapeHtml(shopName)}</strong> is confirmed.</p>`,
        bookingLine ? `<p><strong>When:</strong> ${escapeHtml(bookingLine)}</p>` : "",
        manageLink ? `<p>${manageLink}</p>` : "",
        rebookUrl ? `<p>Book again: <a href="${escapeHtml(rebookUrl)}">${escapeHtml(rebookUrl)}</a></p>` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const text = [
        `Hi ${customerName},`,
        `Your ${template.labels.bookingNoun.toLowerCase()} at ${shopName} is confirmed.`,
        bookingLine ? `When: ${bookingLine}` : "",
        manageUrl ? `View or manage: ${manageUrl}` : "",
        rebookUrl ? `Book again: ${rebookUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      return { to: toEmail?.trim() || null, subject, html, text };
    }

    case "BOOKING_UPDATED": {
      const subject = `Booking updated at ${shopName}`;
      const manageLink = manageUrl ? `<a href="${escapeHtml(manageUrl)}" style="display:inline-block;padding:10px 20px;background:${escapeHtml(accentColor)};color:#fff;text-decoration:none;border-radius:6px;">View or manage your ${template.labels.bookingNoun.toLowerCase()}</a>` : "";
      const html = [
        `<p>Hi ${escapeHtml(String(customerName))},</p>`,
        `<p>Your ${template.labels.bookingNoun.toLowerCase()} at <strong>${escapeHtml(shopName)}</strong> has been updated.</p>`,
        bookingLine ? `<p><strong>New time:</strong> ${escapeHtml(bookingLine)}</p>` : "",
        manageLink ? `<p>${manageLink}</p>` : "",
        rebookUrl ? `<p>Book again: <a href="${escapeHtml(rebookUrl)}">${escapeHtml(rebookUrl)}</a></p>` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const text = [
        `Hi ${customerName},`,
        `Your ${template.labels.bookingNoun.toLowerCase()} at ${shopName} has been updated.`,
        bookingLine ? `New time: ${bookingLine}` : "",
        manageUrl ? `View or manage: ${manageUrl}` : "",
        rebookUrl ? `Book again: ${rebookUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      return { to: toEmail?.trim() || null, subject, html, text };
    }

    case "BOOKING_CANCELLED":
    case "BOOKING_CANCELLED_CUSTOMER":
    case "BOOKING_CANCELLED_SHOP": {
      const subject = `Booking cancelled at ${shopName}`;
      const html = [
        `<p>Hi ${escapeHtml(String(customerName))},</p>`,
        `<p>Your ${template.labels.bookingNoun.toLowerCase()} at <strong>${escapeHtml(shopName)}</strong> has been cancelled.</p>`,
        bookingLine ? `<p>It was scheduled for ${escapeHtml(bookingLine)}.</p>` : "",
        rebookUrl ? `<p>Book again: <a href="${escapeHtml(rebookUrl)}">${escapeHtml(rebookUrl)}</a></p>` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const text = [
        `Hi ${customerName},`,
        `Your ${template.labels.bookingNoun.toLowerCase()} at ${shopName} has been cancelled.`,
        bookingLine ? `It was scheduled for ${bookingLine}.` : "",
        rebookUrl ? `Book again: ${rebookUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      return { to: toEmail?.trim() || null, subject, html, text };
    }

    case "REMINDER_NEXT_DAY": {
      const subject = `Reminder: your booking tomorrow at ${shopName}`;
      const manageLink = manageUrl ? `<a href="${escapeHtml(manageUrl)}" style="display:inline-block;padding:10px 20px;background:${escapeHtml(accentColor)};color:#fff;text-decoration:none;border-radius:6px;">View or manage your ${template.labels.bookingNoun.toLowerCase()}</a>` : "";
      const html = [
        `<p>Hi ${escapeHtml(String(customerName))},</p>`,
        `<p>Reminder of your ${template.labels.bookingNoun.toLowerCase()} at <strong>${escapeHtml(shopName)}</strong>.</p>`,
        bookingLine ? `<p><strong>When:</strong> ${escapeHtml(bookingLine)}</p>` : "",
        manageLink ? `<p>${manageLink}</p>` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const text = [
        `Hi ${customerName},`,
        `Reminder: your ${template.labels.bookingNoun.toLowerCase()} at ${shopName}.`,
        bookingLine ? `When: ${bookingLine}` : "",
        manageUrl ? `View or manage: ${manageUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      return { to: toEmail?.trim() || null, subject, html, text };
    }

    default:
      return {
        to: toEmail?.trim() || null,
        subject: stubSubject,
        html: `<p>Event: ${escapeHtml(eventType)}</p>`,
        text: `Event: ${eventType}`,
      };
  }
}

export function getAppBaseUrl(): string {
  const url = process.env.APP_BASE_URL;
  if (url != null && url.trim() !== "") {
    return url.replace(/\/$/, "");
  }
  return "http://localhost:3001";
}
