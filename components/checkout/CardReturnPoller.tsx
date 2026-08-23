"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { checkMobileMoneyPaymentStatusAction } from "../../lib/actions/payment";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 40; // ~2 minutes of bounded polling

/**
 * Shown on the card return-from-Paystack landing page when the independent
 * server-side re-verify (already run once by the page itself) hasn't yet
 * reached a terminal state. Keeps polling CrownSourceGlobal's own server —
 * never Paystack directly — until SUCCEEDED/FAILED/CANCELLED or the bound.
 */
export function CardReturnPoller({ orderId, paymentId }: { orderId: string; paymentId: string }) {
  const router = useRouter();
  const pollCount = useRef(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      pollCount.current += 1;
      const result = await checkMobileMoneyPaymentStatusAction(orderId, paymentId);
      if (!result.ok) return;

      if (result.value.status === "SUCCEEDED") {
        clearInterval(interval);
        router.push(`/account/orders/${orderId}?confirmed=true`);
        return;
      }
      if (result.value.status === "FAILED" || result.value.status === "CANCELLED") {
        clearInterval(interval);
        router.push(`/checkout/${orderId}/payment`);
        return;
      }
      if (pollCount.current >= MAX_POLLS) {
        clearInterval(interval);
        router.push(`/account/orders/${orderId}`);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="mt-6 flex justify-center">
    <div className="size-10 animate-spin rounded-full border-4 border-ivory-300 border-t-espresso-900/65" aria-hidden />
  </div>;
}
