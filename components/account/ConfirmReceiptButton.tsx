"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { confirmCustomerReceiptAction } from "../../lib/actions/fulfilment";

export function ConfirmReceiptButton({
  orderId,
  fulfilmentId,
  alreadyConfirmed,
}: {
  orderId: string;
  fulfilmentId: string;
  alreadyConfirmed?: boolean;
}) {
  const [confirmed, setConfirmed] = useState(Boolean(alreadyConfirmed));
  const [isPending, startTransition] = useTransition();

  if (confirmed) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-forest-800">
        <CheckCircle2 className="size-4" strokeWidth={2} />
        You confirmed receipt of this package.
      </p>
    );
  }

  return (
    <form
      action={(formData) => {
        setConfirmed(true);
        startTransition(() => confirmCustomerReceiptAction(formData));
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-sm font-medium text-forest-800 underline decoration-champagne-400/70 hover:text-forest-900 disabled:opacity-50"
      >
        Confirm you&apos;ve received this
      </button>
    </form>
  );
}
