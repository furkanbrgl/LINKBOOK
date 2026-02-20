import type { EmailMessage } from "./types";
import { createPostmarkProvider } from "./providers/postmark";
import { createDevProvider } from "./providers/dev";

export type EmailProviderName = "postmark" | "dev";

function hasPostmarkEnv(): boolean {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const from = process.env.EMAIL_FROM;
  return (
    token != null && token.trim() !== "" && from != null && from.trim() !== ""
  );
}

export function getEmailProviderName(): EmailProviderName {
  const force = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (force === "dev") return "dev";
  if (force === "postmark") {
    if (!hasPostmarkEnv()) {
      throw new Error(
        "EMAIL_PROVIDER=postmark but POSTMARK_SERVER_TOKEN or EMAIL_FROM is missing"
      );
    }
    return "postmark";
  }
  return hasPostmarkEnv() ? "postmark" : "dev";
}

function getProvider() {
  const name = getEmailProviderName();
  return name === "postmark" ? createPostmarkProvider() : createDevProvider();
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const provider = getProvider();
  await provider.send(msg);
}
