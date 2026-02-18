// TODO: Messaging adapter interface
// Abstract over Resend/Postmark providers

export type MessagePayload = {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
};

export interface MessagingAdapter {
  send(payload: MessagePayload): Promise<{ id?: string; error?: Error }>;
}
