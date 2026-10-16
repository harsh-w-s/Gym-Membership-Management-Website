"use client";

import { useState } from "react";

/**
 * The wa.me URL (with the URL-encoded message) is built on the server;
 * this button just opens it in a new tab. The owner then hits "Send" in WhatsApp.
 */
export function WhatsAppRemindButton({ url, clientName }: { url: string; clientName: string }) {
  const [opened, setOpened] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        window.open(url, "_blank", "noopener,noreferrer");
        setOpened(true);
      }}
      aria-label={`Remind ${clientName} via WhatsApp`}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 active:scale-[0.98]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.42 1.3-1.96 1.35-.5.05-1.13.07-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.3-.13.59.17.29.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.3 1.42.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.7-.17 1.38Z" />
      </svg>
      {opened ? "Opened — open again" : "Remind Client via WhatsApp"}
    </button>
  );
}
