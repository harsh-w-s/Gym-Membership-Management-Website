"use client";

import { useTransition } from "react";

/**
 * Asks for confirmation, then calls a Server Action (already bound to the
 * record id). The action redirects away when it succeeds.
 */
export function DeleteButton({
  action,
  confirmText,
  label = "Delete",
}: {
  action: () => Promise<{ error?: string } | void>;
  confirmText: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirmText)) return;
        startTransition(async () => {
          const result = await action();
          if (result?.error) window.alert(result.error);
        });
      }}
      className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}
