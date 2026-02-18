// TODO: Postmark email provider implementation

import type { MessagingAdapter, MessagePayload } from "../adapter";

export function createPostmarkAdapter(): MessagingAdapter {
  return {
    async send(_payload: MessagePayload) {
      // TODO: implement
      return {};
    },
  };
}
