import Link from "next/link";
import { ReceivingLocationForm } from "../../../../../components/admin/ReceivingLocationForm";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { logisticsService } from "../../../../../modules/logistics/service";
import { setReceivingLocationActiveAction } from "../../../../../lib/actions/logistics";

export const metadata = { title: "Receiving locations — Admin" };
export const dynamic = "force-dynamic";

export default async function ReceivingLocationsPage() {
  await requireAdminSession("/admin/operations/receiving-locations", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const locations = await logisticsService.listAll();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/operations" className="text-sm font-medium text-brand-700 hover:underline">
          ← Operations
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-stone-900">Receiving locations</h1>
        <p className="mt-1 text-[15px] text-stone-500">
          Where international vendors ship inbound packages. New international Fulfilments are assigned the
          oldest active location by default — reassign per-order in Operations if needed.
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-display text-base font-medium text-stone-900">Add a location</h2>
        <div className="mt-3">
          <ReceivingLocationForm />
        </div>
      </div>

      <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
        {locations.map((location) => (
          <div key={location.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-stone-900">{location.name}</p>
              <p className="text-xs text-stone-500">
                {location.addressLine1}, {[location.city, location.region, location.country].filter(Boolean).join(", ")}
              </p>
            </div>
            <form action={setReceivingLocationActiveAction}>
              <input type="hidden" name="id" value={location.id} />
              <input type="hidden" name="active" value={String(!location.active)} />
              <button
                type="submit"
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  location.active ? "bg-brand-100 text-brand-800" : "bg-stone-200 text-stone-600"
                }`}
              >
                {location.active ? "Active" : "Inactive"}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
