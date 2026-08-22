// One-off maintenance script: clears every demo lead/customer (and
// everything that hangs off them — activities, appointments, follow-ups,
// tasks, communications, notes, offers, sales, trade-ins, notifications,
// automation run history), then consolidates the seeded multi-salesperson
// demo team down to a single real account renamed to the actual user.
//
// Safe to re-run: every step is idempotent (deleteMany on an empty table
// is a no-op; the rename just re-applies the same values).
//
// Usage: npx tsx scripts/cleanup-and-rename.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEEP_EMAIL = "alex.rivera@driveline-motors.com";
const REMOVE_EMAILS = ["sam.carter@driveline-motors.com", "taylor.nguyen@driveline-motors.com", "jordan.blake@driveline-motors.com"];
const NEW_FIRST_NAME = "Chinonso";
const NEW_LAST_NAME = "Ugochukwu";

async function main() {
  console.log("Deleting demo notifications...");
  const notifs = await prisma.notification.deleteMany({});
  console.log(`  ${notifs.count} deleted`);

  console.log("Deleting automation run history...");
  const runs = await prisma.automationRun.deleteMany({});
  console.log(`  ${runs.count} deleted`);

  console.log("Deleting all customers (cascades leads, appointments, follow-ups, tasks, communications, notes, offers, sales, trade-ins, activities, test drives)...");
  const customers = await prisma.customer.deleteMany({});
  console.log(`  ${customers.count} deleted`);

  console.log("Removing unused seeded salesperson accounts...");
  for (const email of REMOVE_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`  ${email}: not found, skipping`);
      continue;
    }
    await prisma.user.delete({ where: { email } });
    console.log(`  ${email}: deleted`);
  }

  console.log(`Renaming ${KEEP_EMAIL} to ${NEW_FIRST_NAME} ${NEW_LAST_NAME}...`);
  const kept = await prisma.user.findUnique({ where: { email: KEEP_EMAIL } });
  if (!kept) {
    console.warn(`  WARNING: ${KEEP_EMAIL} not found — nothing to rename. Auto-login will fail until a user with this email exists.`);
  } else {
    await prisma.user.update({
      where: { email: KEEP_EMAIL },
      data: { firstName: NEW_FIRST_NAME, lastName: NEW_LAST_NAME },
    });
    console.log(`  Done. Login email stays ${KEEP_EMAIL} (unchanged), display name is now ${NEW_FIRST_NAME} ${NEW_LAST_NAME}.`);
  }

  const remaining = await prisma.user.findMany({ select: { firstName: true, lastName: true, email: true, role: { select: { name: true } } } });
  console.log("\nRemaining users:");
  for (const u of remaining) console.log(`  ${u.firstName} ${u.lastName} <${u.email}> (${u.role.name})`);

  const counts = await Promise.all([
    prisma.customer.count(),
    prisma.lead.count(),
    prisma.appointment.count(),
    prisma.followUp.count(),
    prisma.task.count(),
    prisma.activity.count(),
  ]);
  console.log(`\nPost-cleanup counts — Customer: ${counts[0]}, Lead: ${counts[1]}, Appointment: ${counts[2]}, FollowUp: ${counts[3]}, Task: ${counts[4]}, Activity: ${counts[5]}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
