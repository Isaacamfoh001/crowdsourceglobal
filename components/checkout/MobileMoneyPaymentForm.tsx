"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  initiateMobileMoneyPaymentAction,
  submitMobileMoneyOtpAction,
  checkMobileMoneyPaymentStatusAction,
} from "../../lib/actions/payment";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import type { MobileMoneyNetworkCode, PaymentStatusView } from "../../modules/payments/types";

const NETWORKS: { value: MobileMoneyNetworkCode; label: string }[] = [
  { value: "MTN", label: "MTN Mobile Money" },
  { value: "TELECEL", label: "Telecel Cash" },
  { value: "AT", label: "AirtelTigo Money" },
];

const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 30; // ~2 minutes of bounded polling

type Step = "form" | "otp" | "pending" | "stalled" | "failed";

export function MobileMoneyPaymentForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [network, setNetwork] = useState<MobileMoneyNetworkCode>("MTN");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [payment, setPayment] = useState<PaymentStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollCount = useRef(0);

  useEffect(() => {
    if (step !== "pending" || !payment) return;
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
        setStep("stalled");
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, payment?.paymentId]);

  async function handleInitiate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await initiateMobileMoneyPaymentAction(orderId, network, phone);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPayment(result.value);
    if (result.value.status === "FAILED") {
      setError(result.value.failureReasonSafe ?? "Payment could not be started.");
      setStep("failed");
    } else if (result.value.requiresOtp) {
      setStep("otp");
    } else {
      setStep("pending");
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payment) return;
    setError(null);
    setIsSubmitting(true);
    const result = await submitMobileMoneyOtpAction(orderId, payment.paymentId, phone, otp);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPayment(result.value);
    if (result.value.status === "FAILED") {
      setError(result.value.failureReasonSafe ?? "Payment could not be completed.");
      setStep("failed");
    } else {
      setStep("pending");
    }
  }

  async function handleManualCheck() {
    if (!payment) return;
    setIsSubmitting(true);
    const result = await checkMobileMoneyPaymentStatusAction(orderId, payment.paymentId);
    setIsSubmitting(false);
    if (!result.ok) return;
    setPayment(result.value);
    if (result.value.status === "SUCCEEDED") {
      router.push(`/account/orders/${orderId}?confirmed=true`);
    } else if (result.value.status === "FAILED" || result.value.status === "CANCELLED") {
      setError(result.value.failureReasonSafe ?? "Payment could not be completed.");
      setStep("failed");
    } else {
      setStep("pending");
    }
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-espresso-900/65">
          Enter the verification code sent to your phone via SMS to authorize this payment.
        </p>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-espresso-800" htmlFor="otp">
          Verification code
          <input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="rounded-lg border border-ivory-400 px-3 py-2.5 text-base focus:border-espresso-900/50 focus:outline-none"
            autoFocus
          />
        </label>
        <Button type="submit" size="lg" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Verifying…" : "Confirm code"}
        </Button>
      </form>
    );
  }

  if (step === "pending" || step === "stalled") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div
          className={step === "pending" ? "size-10 animate-spin rounded-full border-4 border-ivory-300 border-t-espresso-900/65" : "size-10 rounded-full border-4 border-warning-200"}
          aria-hidden
        />
        <p className="text-sm font-medium text-espresso-900" role="status">
          {step === "stalled"
            ? "This is taking longer than expected."
            : payment?.providerStatus === "TP17"
              ? "Verification successful. We're confirming your payment."
              : "Check your phone and approve the payment prompt."}
        </p>
        {payment?.phoneMasked ? <p className="text-xs text-espresso-900/50">Sent to {payment.phoneMasked}</p> : null}
        <p className="text-xs text-espresso-900/35">Order reference: {payment?.reference}</p>
        {step === "stalled" ? (
          <Button type="button" variant="outline" onClick={handleManualCheck} disabled={isSubmitting}>
            {isSubmitting ? "Checking…" : "Check payment status"}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={handleManualCheck} disabled={isSubmitting}>
            Check now
          </Button>
        )}
      </div>
    );
  }

  if (step === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="error">{error ?? "Payment could not be completed."}</FormMessage>
        <Button type="button" size="lg" fullWidth onClick={() => setStep("form")}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleInitiate} className="flex flex-col gap-4">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-espresso-800">Mobile Money network</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {NETWORKS.map((n) => (
            <label
              key={n.value}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium ${
                network === n.value ? "border-espresso-900 bg-espresso-950 text-white" : "border-ivory-400 text-espresso-800"
              }`}
            >
              <input
                type="radio"
                name="network"
                value={n.value}
                checked={network === n.value}
                onChange={() => setNetwork(n.value)}
                className="sr-only"
              />
              {n.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-espresso-800" htmlFor="phone">
        Mobile Money number
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          required
          placeholder="024 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-lg border border-ivory-400 px-3 py-2.5 text-base focus:border-espresso-900/50 focus:outline-none"
        />
      </label>

      <Button type="submit" size="lg" fullWidth disabled={isSubmitting}>
        {isSubmitting ? "Starting payment…" : "Pay with Mobile Money"}
      </Button>
    </form>
  );
}
