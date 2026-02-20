"use client";

import { useState } from "react";

export function OnboardingShareCard({
  publicPath,
  absolutePublicUrl,
}: {
  publicPath: string;
  absolutePublicUrl: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const urlToCopy = absolutePublicUrl ?? publicPath;
  const urlToShow = absolutePublicUrl ?? publicPath;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const qrUrl =
    absolutePublicUrl != null
      ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(absolutePublicUrl)}`
      : null;

  const whatsAppUrl =
    absolutePublicUrl != null
      ? `https://wa.me/?text=${encodeURIComponent("Book here: " + absolutePublicUrl)}`
      : null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
      <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
        Public booking link
      </h2>
      <p className="mt-1 font-mono text-sm text-neutral-600 break-all dark:text-neutral-400">
        {urlToShow}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        {whatsAppUrl && (
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            Share on WhatsApp
          </a>
        )}
      </div>
      {qrUrl && (
        <div className="mt-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            QR code
          </p>
          <img
            src={qrUrl}
            alt="QR code for booking link"
            className="h-[180px] w-[180px] rounded border border-neutral-200 dark:border-neutral-600"
            width={180}
            height={180}
          />
        </div>
      )}
    </div>
  );
}
