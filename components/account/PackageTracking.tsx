import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { ConfirmReceiptButton } from "./ConfirmReceiptButton";
import { OrderStatusBadge } from "./OrderStatusBadge";
import type { CustomerPackageTracking } from "../../modules/fulfilment/types";
import type { OrderDisplayStatus } from "../../modules/orders/display-status";

const RAW_PROGRESSION_STATUSES = new Set<OrderDisplayStatus>(["ORDER_CONFIRMED", "PREPARING", "COLLECTED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]);

export function PackageTracking({
  tracking,
  orderId,
  multiPackage,
  index,
  packageStatus,
}: {
  tracking: CustomerPackageTracking;
  orderId: string;
  multiPackage: boolean;
  index: number;
  /** (M11.1) Derived, resolution-aware status for this specific vendor's package — see modules/orders/display-status.ts. Only shown when it says something the plain step timeline below doesn't (an active case/return/refund/replacement). */
  packageStatus?: { status: OrderDisplayStatus; label: string };
}) {
  const lastStep = tracking.steps.at(-1);
  const isDelivered = Boolean(lastStep?.done);
  const showDerivedBadge = packageStatus && !RAW_PROGRESSION_STATUSES.has(packageStatus.status);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-[15px] font-medium text-stone-900">
          {multiPackage ? `Package ${index + 1} — ` : ""}
          {tracking.vendorName}
        </p>
        <div className="flex items-center gap-2">
          {showDerivedBadge ? <OrderStatusBadge status={packageStatus.status} label={packageStatus.label} /> : null}
          {tracking.hasIssue ? (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
              <AlertTriangle className="size-3.5" strokeWidth={2} />
              Needs attention
            </span>
          ) : null}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {tracking.items.map((item) => (
          <li key={item.id} className="text-sm text-stone-600">
            {item.description} × {item.quantity}
          </li>
        ))}
      </ul>

      <ol className="mt-4 flex flex-col gap-2">
        {tracking.steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2.5 text-sm">
            {step.done ? (
              <CheckCircle2 className="size-4 shrink-0 text-brand-700" strokeWidth={2} />
            ) : step.current ? (
              <span className="flex size-4 shrink-0 items-center justify-center">
                <span className="size-2.5 rounded-full bg-gold-500" />
              </span>
            ) : (
              <Circle className="size-4 shrink-0 text-stone-300" strokeWidth={2} />
            )}
            <span className={step.done || step.current ? "font-medium text-stone-900" : "text-stone-400"}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {isDelivered ? (
        <div className="mt-4">
          <ConfirmReceiptButton
            orderId={orderId}
            fulfilmentId={tracking.fulfilmentId}
            alreadyConfirmed={Boolean(tracking.customerConfirmedReceiptAt)}
          />
        </div>
      ) : null}
    </div>
  );
}
