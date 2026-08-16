import "dotenv/config";
import { prisma } from "../lib/db";

/**
 * Development-only admin bootstrap. Run directly against the local database
 * — there is no network-exposed route that can grant admin access, and no
 * hardcoded email. Usage:
 *
 *   npm run admin:grant -- <email> [SUPER_ADMIN|OPS_ADMIN|FINANCE_ADMIN]
 *
 * The user must already have signed up normally (email/password or Google)
 * before running this — it only attaches an AdminUser row to an existing
 * User, it does not create accounts.
 */
async function main() {
  const [email, roleArg] = process.argv.slice(2);
  if (!email) {
    console.error("Usage: npm run admin:grant -- <email> [SUPER_ADMIN|OPS_ADMIN|FINANCE_ADMIN]");
    process.exit(1);
  }

  const role = (roleArg ?? "SUPER_ADMIN").toUpperCase();
  if (!["SUPER_ADMIN", "OPS_ADMIN", "FINANCE_ADMIN"].includes(role)) {
    console.error(`Invalid role "${roleArg}". Use SUPER_ADMIN, OPS_ADMIN, or FINANCE_ADMIN.`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email "${email}". They must sign up first.`);
    process.exit(1);
  }

  const adminUser = await prisma.adminUser.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: role as "SUPER_ADMIN" | "OPS_ADMIN" | "FINANCE_ADMIN" },
    update: { role: role as "SUPER_ADMIN" | "OPS_ADMIN" | "FINANCE_ADMIN" },
  });

  console.log(`Granted ${adminUser.role} to ${email} (userId: ${user.id}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
