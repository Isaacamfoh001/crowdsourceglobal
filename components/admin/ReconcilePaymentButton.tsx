"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reconcilePaymentAsAdminAction } from "../../lib/actions/payment";
import { Button } from "../ui/Button";

/** Queries the provider's own status API and safely reconciles — never an unrestricted "mark paid." */
export function ReconcilePaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);
    const result = await reconcilePaymentAsAdminAction(paymentId);
    setIsPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={handleClick} disabled={isPending}>
        {isPending ? "Verifying with Moolre…" : "Verify with provider"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
