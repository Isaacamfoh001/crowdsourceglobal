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
  const currentStep = tracking.steps.find((step) => step.current);
  const showDerivedBadge = packageStatus && !RAW_PROGRESSION_STATUSES.has(packageStatus.status);

  return (
    <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-[15px] font-medium text-espresso-950">
          {multiPackage ? `Package ${index + 1} — ` : ""}
          {tracking.vendorName}
        </p>
        <div className="flex items-center gap-2">
          {showDerivedBadge ? <OrderStatusBadge status={packageStatus.status} label={packageStatus.label} /> : null}
          {tracking.hasIssue ? (
            <span className="flex items-center gap-1 rounded-full bg-danger-100 px-2.5 py-1 text-xs font-semibold text-danger-700">
              <AlertTriangle className="size-3.5" strokeWidth={2} />
              Needs attention
            </span>
          ) : null}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {tracking.items.map((item) => (
          <li key={item.id} className="text-sm text-espresso-900/65">
            {item.description} × {item.quantity}
          </li>
        ))}
      </ul>

      {currentStep && !isDelivered ? (
        <p className="mt-4 rounded-lg bg-ivory-100 px-3.5 py-2.5 text-sm text-espresso-900/70">
          <span className="font-medium text-espresso-950">Next: </span>
          {currentStep.label}
        </p>
      ) : null}

      <ol className="mt-4 flex flex-col">
        {tracking.steps.map((step, stepIndex) => (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
            {stepIndex < tracking.steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={`absolute left-[7px] top-4 h-full w-px ${step.done ? "bg-espresso-800" : "bg-ivory-300"}`}
              />
            ) : null}
            <span className="relative z-10 flex size-4 shrink-0 items-center justify-center bg-ivory-50">
              {step.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-espresso-800" strokeWidth={2} />
              ) : step.current ? (
                <span className="flex size-4 shrink-0 items-center justify-center">
                  <span className="size-2.5 animate-pulse rounded-full bg-champagne-600" />
                </span>
              ) : (
                <Circle className="size-4 shrink-0 text-ivory-400" strokeWidth={2} />
              )}
            </span>
            <span className={`text-sm ${step.done || step.current ? "font-medium text-espresso-950" : "text-espresso-900/35"}`}>
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
