"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  id: string;
  status: string;
};

export function OutboxRetryButton({ id, status }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  if (status === "sent") {
    return <span className="text-zinc-400">—</span>;
  }

  const handleRetry = async () => {
    setMessage(null);
    try {
      const res = await fetch("/api/admin/outbox/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok === true) {
        setMessage({ type: "ok", text: "Retry queued" });
        router.refresh();
      } else {
        setMessage({
          type: "err",
          text: data.reason === "already_sent" ? "Already sent" : data.error || "Failed",
        });
      }
    } catch {
      setMessage({ type: "err", text: "Request failed" });
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleRetry}
        className="rounded bg-zinc-800 px-2 py-1 text-xs text-white hover:bg-zinc-700"
      >
        Retry now
      </button>
      {message && (
        <span
          className={`text-xs ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
