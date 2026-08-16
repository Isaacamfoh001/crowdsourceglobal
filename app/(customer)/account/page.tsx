import { requireSession } from "../../../modules/identity/policy";
import { identityService } from "../../../modules/identity/service";
import { SignOutButton } from "../../../components/auth/SignOutButton";

export const metadata = { title: "Your account — CrownSourceGlobal" };

export default async function AccountPage() {
  const session = await requireSession();
  const customerProfile = await identityService.getCustomerProfileByUserId(
    session.user.id,
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your account</h1>
        <SignOutButton />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="divide-y divide-slate-100">
          <div className="flex justify-between py-3">
            <dt className="text-sm font-medium text-slate-500">Name</dt>
            <dd className="text-sm text-slate-900">
              {customerProfile?.displayName ?? session.user.name}
            </dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-sm font-medium text-slate-500">Email</dt>
            <dd className="text-sm text-slate-900">{session.user.email}</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-sm font-medium text-slate-500">Email verified</dt>
            <dd className="text-sm text-slate-900">
              {session.user.emailVerified ? "Yes" : "No"}
            </dd>
          </div>
        </dl>
      </div>

      <p className="text-sm text-slate-400">
        Orders, quotes, custom requests, messages, and invoices will appear here in a
        later milestone.
      </p>
    </div>
  );
}
