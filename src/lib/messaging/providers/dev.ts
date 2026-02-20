import type { EmailMessage, EmailProvider } from "../types";

const TRUNCATE_LEN = 500;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "...";
}

export function createDevProvider(): EmailProvider {
  return {
    async send(msg: EmailMessage): Promise<void> {
      console.log("DEV EMAIL SEND");
      console.log("to:", msg.to);
      console.log("subject:", msg.subject);
      console.log("text:", msg.text != null ? truncate(msg.text, TRUNCATE_LEN) : "(none)");
      console.log("html:", truncate(msg.html, TRUNCATE_LEN));
    },
  };
}
