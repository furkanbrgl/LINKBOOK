// TODO: Zod schemas for API validation
// booking, availability, cancel, reschedule, etc.

import { z } from "zod";

export const bookingSchema = z.object({
  // TODO: add fields
  shopId: z.string().uuid(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
