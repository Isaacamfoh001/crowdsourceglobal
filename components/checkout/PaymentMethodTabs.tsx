"use client";

import { useState } from "react";
import { MobileMoneyPaymentForm } from "./MobileMoneyPaymentForm";
import { CardPaymentForm } from "./CardPaymentForm";

type Method = "momo" | "card";

/**
 * Method selection lives entirely client-side, above provider-agnostic
 * customer-facing forms — Paystack/Moolre identity never surfaces here
 * (CLAUDE.md — provider is an implementation detail, not a customer concept).
 */
export function PaymentMethodTabs({
  orderId,
  showMobileMoney,
  showCard,
}: {
  orderId: string;
  showMobileMoney: boolean;
  showCard: boolean;
}) {
  const [method, setMethod] = useState<Method>(showMobileMoney ? "momo" : "card");

  if (!showMobileMoney) return <CardPaymentForm orderId={orderId} />;
  if (!showCard) return <MobileMoneyPaymentForm orderId={orderId} />;

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMethod("momo")}
          className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
            method === "momo" ? "border-espresso-900 bg-espresso-950 text-white" : "border-ivory-400 text-espresso-800"
          }`}
        >
          Mobile Money
        </button>
        <button
          type="button"
          onClick={() => setMethod("card")}
          className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
            method === "card" ? "border-espresso-900 bg-espresso-950 text-white" : "border-ivory-400 text-espresso-800"
          }`}
        >
          Card
        </button>
      </div>
      {method === "momo" ? <MobileMoneyPaymentForm orderId={orderId} /> : <CardPaymentForm orderId={orderId} />}
    </div>
  );
}
