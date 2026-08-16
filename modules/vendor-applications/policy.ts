import { redirect } from "next/navigation";
import { requireSession } from "../identity/policy";
import { vendorApplicationsService } from "./service";

/**
 * Guards the onboarding wizard step routes. Redirects to the status router
 * (`/vendor/onboarding`) whenever the application isn't in an editable
 * state, rather than letting a stale bookmark/back-button reopen a locked
 * step (CLAUDE.md's server-side-only-authorization rule applies to wizard
 * step gating too, not just top-level access).
 */
export async function requireEditableApplication(currentPath: string) {
  const session = await requireSession(currentPath);
  const application = await vendorApplicationsService.getForUser(session.user.id);
  if (!application) {
    redirect("/vendor/onboarding");
  }
  if (!["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(application.status)) {
    redirect("/vendor/onboarding");
  }
  return { session, application };
}
