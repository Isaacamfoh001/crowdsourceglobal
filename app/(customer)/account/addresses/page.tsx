import { AddressManager } from "../../../../components/account/AddressManager";
import { requireSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { addressesService } from "../../../../modules/addresses/service";
import { notFound } from "next/navigation";

export const metadata = { title: "Saved addresses" };
export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const session = await requireSession("/account/addresses");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) notFound();

  const addresses = await addressesService.listForCustomer(customerProfile.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-espresso-950">Saved addresses</h1>
        <p className="mt-1 text-[15px] text-espresso-900/50">Manage the delivery addresses you can select at checkout.</p>
      </div>
      <div className="max-w-xl rounded-lg border border-ivory-300 bg-ivory-50 p-6">
        <AddressManager addresses={addresses} />
      </div>
    </div>
  );
}
