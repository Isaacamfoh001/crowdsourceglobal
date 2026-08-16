import { formatPrice } from "../../lib/format";
import type { PublicBulkPriceTier } from "../../modules/pricing/types";

export function BulkPricingTable({
  tiers,
  currency,
}: {
  tiers: PublicBulkPriceTier[];
  currency: string;
}) {
  if (tiers.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
            <th className="px-4 py-3">Quantity</th>
            <th className="px-4 py-3 text-right">Unit price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {tiers.map((tier) => (
            <tr key={tier.id}>
              <td className="px-4 py-3 text-stone-700">
                {tier.maxQuantity ? `${tier.minQuantity}–${tier.maxQuantity}` : `${tier.minQuantity}+`}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-stone-900">
                {formatPrice(tier.unitPrice, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
