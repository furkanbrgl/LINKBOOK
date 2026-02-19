// TODO: Zod schemas for API validation
// booking, availability, cancel, reschedule, etc.

import { z } from "zod";
import { DateTime } from "luxon";

export const bookingSchema = z.object({
  // TODO: add fields
  shopId: z.string().uuid(),
});

export type BookingInput = z.infer<typeof bookingSchema>;

// Accept any ISO datetime (Z or +00:00, with or without ms) so API/DB formats pass
const isoDatetime = z.string().refine(
  (s) => DateTime.fromISO(s, { zone: "utc" }).isValid,
  { message: "Invalid ISO datetime" }
);

// v1 booking create payload
export const BookingCreateSchema = z.object({
  shopSlug: z.string().min(1),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startAt: isoDatetime,
  name: z.string().min(2).max(80),
  phone: z.string().min(6).max(32),
  email: z.string().email().optional().or(z.literal("")),
  honeypot: z.string().optional(), // non-empty = treat as bot
});

export type BookingCreateInput = z.infer<typeof BookingCreateSchema>;
