import Link from "next/link";
import { Button } from "../ui/Button";

/**
 * Previous + Continue row for onboarding steps 2+ (M17.1.1). `previousHref`
 * is a deterministic route to the prior step, not history.back() — each
 * step's form already persists to the VendorApplication row on submit and
 * every step page re-reads it fresh, so navigating back never loses
 * already-saved answers. Step 1 (seller-type) passes no previousHref and
 * gets just the single submit button, matching the existing pattern.
 */
export function StepActions({
  previousHref,
  submitLabel,
  pendingLabel,
  isPending,
}: {
  previousHref?: string;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
}) {
  if (!previousHref) {
    return (
      <Button type="submit" size="lg" fullWidth disabled={isPending} className="mt-2">
        {isPending ? pendingLabel : submitLabel}
      </Button>
    );
  }

  return (
    <div className="mt-2 flex gap-3">
      <Link href={previousHref} className="flex-1">
        <Button type="button" variant="outline" size="lg" fullWidth>
          ← Previous
        </Button>
      </Link>
      <Button type="submit" size="lg" fullWidth disabled={isPending} className="flex-1">
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}
