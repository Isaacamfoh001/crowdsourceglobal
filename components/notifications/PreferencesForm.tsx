"use client";

import { useActionState } from "react";
import { updateNotificationPreferencesAction } from "../../lib/actions/notifications";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import type { PreferencesView } from "../../modules/notifications/types";

const OPTIONS: { key: keyof PreferencesView; label: string; description: string }[] = [
  {
    key: "ordersDeliveryEmail",
    label: "Order and delivery updates",
    description: "Vendor order confirmations, collection, out for delivery, delivered, and issue updates.",
  },
  {
    key: "quotationsSourcingEmail",
    label: "Quotations and sourcing",
    description: "Instant and custom sourcing quotations, and sourcing clarification requests.",
  },
  {
    key: "messagesEmail",
    label: "CrownSource messages",
    description: "Email when CrownSourceGlobal replies to a message you sent.",
  },
];

export function PreferencesForm({ preferences }: { preferences: PreferencesView }) {
  const [state, formAction, isPending] = useActionState(updateNotificationPreferencesAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state && state.ok ? <FormMessage tone="success">Preferences saved.</FormMessage> : null}

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-display text-base font-medium text-stone-900">Email me about</h2>
        <div className="mt-4 flex flex-col gap-4">
          {OPTIONS.map((option) => (
            <label key={option.key} className="flex items-start gap-3">
              <input
                type="checkbox"
                name={option.key}
                defaultChecked={preferences[option.key]}
                disabled={isPending}
                className="mt-1 size-4 rounded border-stone-300 text-brand-700 focus:ring-2 focus:ring-brand-100"
              />
              <span>
                <span className="block text-sm font-medium text-stone-900">{option.label}</span>
                <span className="block text-xs text-stone-500">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6">
        <h2 className="font-display text-base font-medium text-stone-900">Always sent</h2>
        <p className="mt-1.5 text-sm text-stone-600">
          Account security emails (verification, password reset), order confirmations, vendor/listing moderation
          decisions, submission receipts, and definitive sourcing outcomes are always sent — these can&apos;t be
          turned off. In-app notifications for every event always appear in your notification center regardless
          of these settings.
        </p>
      </div>

      <Button type="submit" size="lg" className="self-start" disabled={isPending}>
        {isPending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
