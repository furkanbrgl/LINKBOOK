// TODO: Token generation/verification for manage links
// Secure, signed tokens for booking management

import { randomBytes, createHash } from "node:crypto";

/** Random 32 bytes as hex (64 chars) for manage link. */
export function generateManageToken(): string {
  return randomBytes(32).toString("hex");
}

/** SHA256(token + TOKEN_PEPPER) as hex; throws if TOKEN_PEPPER is missing. */
export function hashToken(token: string): string {
  const pepper = process.env.TOKEN_PEPPER;
  if (!pepper) throw new Error("TOKEN_PEPPER is not set");
  return createHash("sha256").update(token + pepper).digest("hex");
}

export function verifyManageToken(_token: string): string | null {
  // TODO: implement - returns bookingId or null
  return null;
}
