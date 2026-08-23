"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { initiateCardPaymentAction, checkMobileMoneyPaymentStatusAction } from "../../lib/actions/payment";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import type { PaymentStatusView } from "../../modules/payments/types";

const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 30; // ~2 minutes of bounded polling

type Step = "idle" | "resuming" | "failed";

/**
 * Card acceptance (M10B) — Paystack-hosted Checkout only. This component
 * never collects or sees a card number, CVV, PIN, or OTP: it initiates a
 * transaction server-side, then does a full-page redirect to Paystack's own
 * page, exactly like a bank/payment-gateway redirect flow. The customer
 * returns to `/checkout/[orderId]/payment/callback`, which independently
 * re-verifies before ever confirming anything.
 */
export function CardPaymentForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [payment, setPayment] = useState<PaymentStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollCount = useRef(0);

  useEffect(() => {
    if (step !== "resuming" || !payment) return;
    pollCount.current = 0;

    const interval = setInterval(async () => {
      pollCount.current += 1;
      const result = await checkMobileMoneyPaymentStatusAction(orderId, payment.paymentId);
      if (!result.ok) return;

      setPayment(result.value);
      if (result.value.status === "SUCCEEDED") {
        clearInterval(interval);
        router.push(`/account/orders/${orderId}?confirmed=true`);
        return;
      }
      if (result.value.status === "FAILED" || result.value.status === "CANCELLED") {
        clearInterval(interval);
        setError(result.value.failureReasonSafe ?? "Payment could not be completed.");
        setStep("failed");
        return;
      }
      if (pollCount.current >= MAX_POLLS) {
        clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, payment?.paymentId]);

  async function handlePay() {
    setError(null);
    setIsSubmitting(true);
    const result = await initiateCardPaymentAction(orderId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.value.authorizationUrl) {
      window.location.href = result.value.authorizationUrl;
      return;
    }
    // Resuming an already-active attempt — Paystack only hands back a fresh
    // authorization_url once, at initiation.
    setPayment(result.value.payment);
    if (result.value.payment.status === "FAILED" || result.value.payment.status === "CANCELLED") {
      setError(result.value.payment.failureReasonSafe ?? "Payment could not be completed.");
      setStep("failed");
    } else {
      setStep("resuming");
    }
  }

  if (step === "resuming") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="size-10 animate-spin rounded-full border-4 border-ivory-300 border-t-espresso-900/65" aria-hidden />
        <p className="text-sm font-medium text-espresso-900" role="status">
          A card payment is already in progress for this order.
        </p>
        <p className="text-xs text-espresso-900/50">Complete it in the tab you opened, or wait a moment and check again.</p>
        <p className="text-xs text-espresso-900/35">Order reference: {payment?.reference}</p>
      </div>
    );
  }

  if (step === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="error">{error ?? "Payment could not be completed."}</FormMessage>
        <Button type="button" size="lg" fullWidth onClick={() => setStep("idle")}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <p className="text-sm text-espresso-900/65">
        You&apos;ll be securely redirected to enter your card details. CrownSourceGlobal never sees or
        stores your card number.
      </p>
      <Button type="button" size="lg" fullWidth onClick={handlePay} disabled={isSubmitting}>
        {isSubmitting ? "Redirecting…" : "Pay with Visa / Mastercard"}
      </Button>
    </div>
  );
}
