// TODO: Email/SMS template definitions
// Map template keys to subject/body

export type TemplateKey = "booking-confirm" | "reminder" | "cancel";

export function getTemplate(_key: TemplateKey): { subject: string; body: string } {
  // TODO: implement
  return { subject: "", body: "" };
}
