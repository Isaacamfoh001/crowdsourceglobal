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
    <div className="overflow-x-auto border border-ivory-400">
      <table className="w-full min-w-[280px] text-sm">
        <thead>
          <tr className="bg-ivory-100 text-left text-xs font-semibold uppercase tracking-wide text-espresso-900/50">
            <th className="px-4 py-3">Quantity</th>
            <th className="px-4 py-3 text-right">Unit price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ivory-200">
          {tiers.map((tier) => (
            <tr key={tier.id}>
              <td className="px-4 py-3 text-espresso-900/80">
                {tier.maxQuantity ? `${tier.minQuantity}–${tier.maxQuantity}` : `${tier.minQuantity}+`}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-espresso-950">
                {formatPrice(tier.unitPrice, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
