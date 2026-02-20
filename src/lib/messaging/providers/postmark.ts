import type { EmailMessage, EmailProvider } from "../types";

const POSTMARK_EMAIL_URL = "https://api.postmarkapp.com/email";

function getEnv(name: string): string {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

export function createPostmarkProvider(): EmailProvider {
  const token = getEnv("POSTMARK_SERVER_TOKEN");
  const from = getEnv("EMAIL_FROM");

  return {
    async send(msg: EmailMessage): Promise<void> {
      const res = await fetch(POSTMARK_EMAIL_URL, {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          From: from,
          To: msg.to,
          Subject: msg.subject,
          HtmlBody: msg.html,
          TextBody: msg.text ?? undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `Postmark send failed: ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`
        );
      }
    },
  };
}
