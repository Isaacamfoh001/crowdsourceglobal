"use client";

import { useActionState } from "react";
import { markAllNotificationsReadAction } from "../../lib/actions/notifications";
import { Button } from "../ui/Button";

export function MarkAllReadButton() {
  const [, formAction, isPending] = useActionState(markAllNotificationsReadAction, null);
  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Marking…" : "Mark all read"}
      </Button>
    </form>
  );
}
