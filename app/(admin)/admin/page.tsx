import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../modules/administration/policy";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireAdminSession("/admin");
  redirect("/admin/vendor-applications");
}
