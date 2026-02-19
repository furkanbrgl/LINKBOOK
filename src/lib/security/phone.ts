// TODO: Phone number validation/formatting
// E.164 format, country codes

export function formatPhone(_phone: string, _country?: string): string {
  // TODO: implement
  return _phone;
}

export function isValidPhone(_phone: string): boolean {
  // TODO: implement
  return false;
}

/** Normalize to E.164; returns { e164 } or { error }. */
export function normalizePhoneE164(
  input: string,
  defaultCountry: "TR" | "US" = "TR"
): { e164: string } | { error: string } {
  // Trim and strip spaces, parens, dashes
  let s = input.trim().replace(/[\s()\-]/g, "");
  if (defaultCountry === "TR") {
    if (s.startsWith("+")) {
      s = "+" + s.slice(1).replace(/\D/g, "");
    } else if (s.startsWith("05") && s.length >= 10) {
      s = "+90" + s.slice(1).replace(/\D/g, "");
    } else if (s.startsWith("5") && s.length === 10 && /^\d+$/.test(s)) {
      s = "+90" + s;
    } else {
      s = s.replace(/\D/g, "");
      if (s.startsWith("0") && s.length >= 10) s = "90" + s.slice(1);
      else if (s.length === 10 && s.startsWith("5")) s = "90" + s;
      else if (s.length === 11 && s.startsWith("90")) s = s;
      else s = "90" + s;
      s = "+" + s;
    }
    // TR mobile: +90 followed by 10 digits (13 chars with +)
    if (!/^\+90\d{10}$/.test(s)) return { error: "Invalid TR mobile number" };
    return { e164: s };
  }
  // General: if starts with +, require 8–15 digits after +
  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return { error: "Invalid international number" };
    return { e164: "+" + digits };
  }
  return { error: "Invalid phone number" };
}
