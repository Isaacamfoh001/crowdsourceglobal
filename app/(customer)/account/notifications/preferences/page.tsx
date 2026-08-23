import Link from "next/link";
import { PreferencesForm } from "../../../../../components/notifications/PreferencesForm";
import { requireSession } from "../../../../../modules/identity/policy";
import { notificationsService } from "../../../../../modules/notifications/service";

export const metadata = { title: "Notification preferences" };
export const dynamic = "force-dynamic";

export default async function NotificationPreferencesPage() {
  const session = await requireSession("/account/notifications/preferences");
  const preferences = await notificationsService.getPreferences(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/account/notifications" className="text-sm font-medium text-forest-800 hover:underline">
          ← Back to notifications
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-espresso-950">Notification preferences</h1>
        <p className="mt-1 text-sm text-espresso-900/50">
          These settings apply across your whole CrownSourceGlobal account — as a customer, vendor, or staff
          member.
        </p>
      </div>

      <PreferencesForm preferences={preferences} />
    </div>
  );
}
