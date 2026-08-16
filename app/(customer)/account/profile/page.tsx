import { requireSession } from "../../../../modules/identity/policy";
import { identityService } from "../../../../modules/identity/service";

export const metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireSession("/account/profile");
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-stone-900">Your profile</h1>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft">
        <dl className="divide-y divide-stone-100">
          <div className="flex justify-between py-3">
            <dt className="text-sm font-medium text-stone-500">Name</dt>
            <dd className="text-sm text-stone-900">
              {customerProfile?.displayName ?? session.user.name}
            </dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-sm font-medium text-stone-500">Email</dt>
            <dd className="text-sm text-stone-900">{session.user.email}</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-sm font-medium text-stone-500">Email verified</dt>
            <dd className="text-sm text-stone-900">{session.user.emailVerified ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </div>

      <p className="text-sm text-stone-400">
        Profile editing, saved addresses, and business details will appear here in a later
        milestone.
      </p>
    </div>
  );
}
