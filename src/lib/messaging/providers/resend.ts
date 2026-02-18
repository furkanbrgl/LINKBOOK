// TODO: Resend email provider implementation

import type { MessagingAdapter, MessagePayload } from "../adapter";

export function createResendAdapter(): MessagingAdapter {
  return {
    async send(_payload: MessagePayload) {
      // TODO: implement
      return {};
    },
  };
}
