/**
 * Make sure the people named in ADMIN_EMAILS actually are administrators.
 *
 * Registration handles the case where the address signs up after the variable
 * is set. This handles the other order — an account that already exists, on a
 * database that predates the variable — which is the ordinary case when you
 * have just discovered you locked yourself out of your own admin pages.
 *
 * Idempotent, and runs on every boot: the list in the environment is the truth,
 * so setting it and restarting is the whole procedure. It only ever promotes.
 * Demoting on removal would mean a typo in an env var silently stripping
 * somebody's access, and that is a worse failure than a stale admin.
 */
import { PrismaClient } from "@prisma/client";
import { config } from "./config";

const prisma = new PrismaClient();

export async function bootstrapAdmins(): Promise<void> {
  if (config.adminEmails.length === 0) return;

  try {
    const { count } = await prisma.user.updateMany({
      where: {
        email: { in: config.adminEmails, mode: "insensitive" },
        role: { not: "ADMIN" },
      },
      data: { role: "ADMIN" },
    });
    if (count > 0) console.log(`Promoted ${count} user(s) to ADMIN from ADMIN_EMAILS.`);

    // Said out loud, because the silent version of this is somebody setting the
    // variable, seeing nothing in the log, and having no way to tell whether it
    // worked or the address was misspelt.
    const present = await prisma.user.findMany({
      where: { email: { in: config.adminEmails, mode: "insensitive" } },
      select: { email: true },
    });
    const missing = config.adminEmails.filter(
      (e) => !present.some((u) => u.email.toLowerCase() === e),
    );
    if (missing.length > 0) {
      console.log(
        `ADMIN_EMAILS lists ${missing.join(", ")}, which has no account yet — ` +
          `it becomes an admin on registering.`,
      );
    }
  } catch (err) {
    // Never fatal. The API is still worth serving without this, and a database
    // hiccup here should not be the thing that stops the app from starting.
    console.error("Could not apply ADMIN_EMAILS:", err instanceof Error ? err.message : err);
  }
}
