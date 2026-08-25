"use client";

import { useActionState } from "react";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";
import { StepActions } from "./StepActions";
import { saveContactAction } from "../../lib/actions/vendor-application";

export function ContactForm({
  initial,
}: {
  initial: { contactName: string | null; contactEmail: string | null; contactPhone: string | null };
}) {
  const [state, formAction, isPending] = useActionState(saveContactAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <Input
        label="Your name"
        name="contactName"
        defaultValue={initial.contactName ?? ""}
        autoComplete="name"
        required
        disabled={isPending}
      />
      <Input
        label="Contact email"
        name="contactEmail"
        type="email"
        defaultValue={initial.contactEmail ?? ""}
        autoComplete="email"
        hint="We'll use this for anything related to your vendor account."
        required
        disabled={isPending}
      />
      <Input
        label="Contact phone"
        name="contactPhone"
        type="tel"
        defaultValue={initial.contactPhone ?? ""}
        autoComplete="tel"
        placeholder="024 123 4567"
        required
        disabled={isPending}
      />

      <StepActions
        previousHref="/vendor/onboarding/seller-type"
        submitLabel="Continue"
        pendingLabel="Saving…"
        isPending={isPending}
      />
    </form>
  );
}
