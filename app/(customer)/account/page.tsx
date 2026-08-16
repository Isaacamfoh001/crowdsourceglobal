import { requireSession } from "../../../modules/identity/policy";
import { identityService } from "../../../modules/identity/service";
import { SignOutButton } from "../../../components/auth/SignOutButton";
import { Logo } from "../../../components/layout/Logo";

export const metadata = { title: "Your account — CrownSourceGlobal" };

export default async function AccountPage() {
  const session = await requireSession();
  const customerProfile = await identityService.getCustomerProfileByUserId(
    session.user.id,
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Logo />
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
        <h1 className="text-2xl font-medium text-stone-900">Your account</h1>

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
              <dd className="text-sm text-stone-900">
                {session.user.emailVerified ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
        </div>

        <p className="text-sm text-stone-400">
          Orders, quotes, custom requests, messages, and invoices will appear here in a
          later milestone.
        </p>
      </div>
    </div>
  );
}
