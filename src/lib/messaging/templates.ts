import { formatShopLocal } from "@/lib/time/tz";

const EVENT_TYPES = [
  "BOOKING_CONFIRMED",
  "BOOKING_UPDATED",
  "BOOKING_CANCELLED_CUSTOMER",
  "BOOKING_CANCELLED_SHOP",
  "REMINDER_NEXT_DAY",
] as const;

export type BookingEventType = (typeof EVENT_TYPES)[number];

export type TemplateData = {
  shop: {
    name: string;
    slug: string;
    timezone: string;
    phone?: string | null;
    address?: string | null;
  };
  booking: {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
  };
  staff?: { name: string };
  service?: { name: string; duration_minutes?: number };
  customer?: { name?: string | null };
  manageToken?: string | null;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function getAppBaseUrl(): string {
  const url = process.env.APP_BASE_URL;
  if (url == null || url.trim() === "") {
    throw new Error("Missing required env: APP_BASE_URL");
  }
  return url.replace(/\/$/, "");
}

/**
 * Format a single booking line in shop local time (date YYYY-MM-DD, time HH:mm).
 * Optionally append service and staff for consistency across templates.
 */
export function formatBookingLine(
  startAt: string,
  endAt: string,
  tz: string,
  options?: { serviceName?: string; staffName?: string }
): string {
  const date = formatShopLocal(startAt, tz, "yyyy-MM-dd");
  const startTime = formatShopLocal(startAt, tz, "HH:mm");
  const endTime = formatShopLocal(endAt, tz, "HH:mm");
  const line = `${date} ${startTime}–${endTime}`;
  const parts: string[] = [line];
  if (options?.serviceName) parts.push(options.serviceName);
  if (options?.staffName) parts.push(options.staffName);
  return parts.join(" • ");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildManageLink(baseUrl: string, manageToken: string): string {
  return `${baseUrl}/m/${manageToken}`;
}

function buildBookingLink(baseUrl: string, slug: string): string {
  return `${baseUrl}/${slug}`;
}

export function renderEmail(
  eventType: string,
  data: TemplateData
): RenderedEmail {
  if (!EVENT_TYPES.includes(eventType as BookingEventType)) {
    throw new Error(`Unknown event type: ${eventType}`);
  }
  const et = eventType as BookingEventType;
  const baseUrl = getAppBaseUrl();
  const { shop, booking } = data;
  const tz = shop.timezone;
  const bookingLine = formatBookingLine(
    booking.start_at,
    booking.end_at,
    tz,
    {
      serviceName: data.service?.name,
      staffName: data.staff?.name,
    }
  );
  const manageLink =
    data.manageToken != null && data.manageToken !== ""
      ? buildManageLink(baseUrl, data.manageToken)
      : null;
  const publicLink = buildBookingLink(baseUrl, shop.slug);

  const shopName = escapeHtml(shop.name);
  const customerName =
    data.customer?.name != null && data.customer.name !== ""
      ? escapeHtml(data.customer.name)
      : "Customer";

  switch (et) {
    case "BOOKING_CONFIRMED": {
      const subject = `Booking confirmed at ${shop.name}`;
      const html = [
        `<p>Hi ${customerName},</p>`,
        `<p>Your booking at <strong>${shopName}</strong> is confirmed.</p>`,
        `<p><strong>When:</strong> ${escapeHtml(bookingLine)}</p>`,
        manageLink
          ? `<p><a href="${escapeHtml(manageLink)}">View or manage your booking</a></p>`
          : "",
        `<p>Book again: <a href="${escapeHtml(publicLink)}">${escapeHtml(publicLink)}</a></p>`,
        shop.phone
          ? `<p>Contact: ${escapeHtml(shop.phone)}</p>`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      const text = [
        `Hi ${customerName},`,
        `Your booking at ${shop.name} is confirmed.`,
        `When: ${bookingLine}`,
        manageLink ? `View or manage: ${manageLink}` : "",
        `Book again: ${publicLink}`,
        shop.phone ? `Contact: ${shop.phone}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      return { subject, html, text };
    }

    case "BOOKING_UPDATED": {
      const subject = `Booking updated at ${shop.name}`;
      const html = [
        `<p>Hi ${customerName},</p>`,
        `<p>Your booking at <strong>${shopName}</strong> has been updated.</p>`,
        `<p><strong>New time:</strong> ${escapeHtml(bookingLine)}</p>`,
        manageLink
          ? `<p><a href="${escapeHtml(manageLink)}">View or manage your booking</a></p>`
          : "",
        `<p>Book again: <a href="${escapeHtml(publicLink)}">${escapeHtml(publicLink)}</a></p>`,
      ]
        .filter(Boolean)
        .join("\n");
      const text = [
        `Hi ${customerName},`,
        `Your booking at ${shop.name} has been updated.`,
        `New time: ${bookingLine}`,
        manageLink ? `View or manage: ${manageLink}` : "",
        `Book again: ${publicLink}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      return { subject, html, text };
    }

    case "BOOKING_CANCELLED_CUSTOMER": {
      const subject = `Booking cancelled at ${shop.name}`;
      const html = [
        `<p>Your booking at <strong>${shopName}</strong> has been cancelled.</p>`,
        `<p>It was scheduled for ${escapeHtml(bookingLine)}.</p>`,
        `<p>Book again: <a href="${escapeHtml(publicLink)}">${escapeHtml(publicLink)}</a></p>`,
      ].join("\n");
      const text = [
        `Your booking at ${shop.name} has been cancelled.`,
        `It was scheduled for ${bookingLine}.`,
        `Book again: ${publicLink}`,
      ].join("\n\n");
      return { subject, html, text };
    }

    case "BOOKING_CANCELLED_SHOP": {
      const subject = `Booking cancelled at ${shop.name}`;
      const html = [
        `<p>Hi ${customerName},</p>`,
        `<p>Your booking at <strong>${shopName}</strong> has been cancelled by the business.</p>`,
        `<p>It was scheduled for ${escapeHtml(bookingLine)}.</p>`,
        shop.phone
          ? `<p>Questions? Contact: ${escapeHtml(shop.phone)}</p>`
          : "",
        `<p>Book again: <a href="${escapeHtml(publicLink)}">${escapeHtml(publicLink)}</a></p>`,
      ]
        .filter(Boolean)
        .join("\n");
      const text = [
        `Hi ${customerName},`,
        `Your booking at ${shop.name} has been cancelled by the business.`,
        `It was scheduled for ${bookingLine}.`,
        shop.phone ? `Questions? Contact: ${shop.phone}` : "",
        `Book again: ${publicLink}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      return { subject, html, text };
    }

    case "REMINDER_NEXT_DAY": {
      const subject = `Reminder: your booking tomorrow at ${shop.name}`;
      const html = [
        `<p>Hi ${customerName},</p>`,
        `<p>This is a reminder of your booking at <strong>${shopName}</strong>.</p>`,
        `<p><strong>When:</strong> ${escapeHtml(bookingLine)}</p>`,
        manageLink
          ? `<p><a href="${escapeHtml(manageLink)}">View or manage your booking</a></p>`
          : "",
        shop.phone
          ? `<p>Contact: ${escapeHtml(shop.phone)}</p>`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      const text = [
        `Hi ${customerName},`,
        `Reminder: your booking at ${shop.name}.`,
        `When: ${bookingLine}`,
        manageLink ? `View or manage: ${manageLink}` : "",
        shop.phone ? `Contact: ${shop.phone}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      return { subject, html, text };
    }

    default: {
      const _: never = et;
      throw new Error(`Unknown event type: ${eventType}`);
    }
  }
}
