"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { submitApplicationAction } from "../../lib/actions/vendor-application";
import { SELLER_TYPES, type VendorApplicationView } from "../../modules/vendor-applications/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-espresso-900/50">{label}</dt>
      <dd className="text-right font-medium text-espresso-950">{value || "—"}</dd>
    </div>
  );
}

export function ReviewForm({
  application,
  categoryNameBySlug,
}: {
  application: VendorApplicationView;
  categoryNameBySlug: Record<string, string>;
}) {
  const [state, formAction, isPending] = useActionState(submitApplicationAction, null);
  const sellerTypeLabel = SELLER_TYPES.find((t) => t.value === application.sellerType)?.label ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-espresso-950">Seller type</h2>
          <Link href="/vendor/onboarding/seller-type" className="text-xs font-medium text-forest-800 hover:underline">
            Edit
          </Link>
        </div>
        <dl className="mt-1 divide-y divide-ivory-100">
          <Row label="You sell as" value={sellerTypeLabel} />
        </dl>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-espresso-950">Contact</h2>
          <Link href="/vendor/onboarding/details" className="text-xs font-medium text-forest-800 hover:underline">
            Edit
          </Link>
        </div>
        <dl className="mt-1 divide-y divide-ivory-100">
          <Row label="Name" value={application.contactName ?? ""} />
          <Row label="Email" value={application.contactEmail ?? ""} />
          <Row label="Phone" value={application.contactPhone ?? ""} />
        </dl>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-espresso-950">Business</h2>
          <Link href="/vendor/onboarding/business" className="text-xs font-medium text-forest-800 hover:underline">
            Edit
          </Link>
        </div>
        <dl className="mt-1 divide-y divide-ivory-100">
          <Row label="Store name" value={application.displayName ?? ""} />
          {application.registrationNumber ? (
            <Row label="Registration number" value={application.registrationNumber} />
          ) : null}
          <Row
            label="Location"
            value={[application.city, application.region, application.country].filter(Boolean).join(", ")}
          />
        </dl>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-espresso-950">What you sell</h2>
          <Link href="/vendor/onboarding/operations" className="text-xs font-medium text-forest-800 hover:underline">
            Edit
          </Link>
        </div>
        <dl className="mt-1 divide-y divide-ivory-100">
          <Row
            label="Categories"
            value={application.categorySlugs.map((slug) => categoryNameBySlug[slug] ?? slug).join(", ")}
          />
          <Row label="Selling mode" value={application.sellingMode ?? ""} />
          <Row label="Bulk orders" value={application.bulkCapable ? "Yes" : "No"} />
        </dl>
      </section>

      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <form action={formAction}>
        <Button type="submit" size="lg" fullWidth disabled={isPending}>
          {isPending ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    </div>
  );
}
