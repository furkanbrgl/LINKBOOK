import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { generateManageToken, hashToken } from "./tokens";

/**
 * Rotates/creates a manage token for a booking and returns the raw token.
 * Upserts into manage_tokens (on booking_id); expires in 90 days; clears revoked_at.
 */
export async function issueManageToken(
  supabase: SupabaseClient,
  bookingId: string
): Promise<string> {
  const rawToken = generateManageToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = DateTime.utc().plus({ days: 90 }).toISO();
  if (!expiresAt) {
    throw new Error("Failed to compute token expiry");
  }

  const { error } = await supabase.from("manage_tokens").upsert(
    {
      booking_id: bookingId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      revoked_at: null,
    },
    { onConflict: "booking_id" }
  );

  if (error) {
    throw new Error(error.message ?? "Failed to upsert manage token");
  }

  return rawToken;
}
