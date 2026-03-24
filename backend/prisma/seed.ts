import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const demo = await prisma.user.upsert({
    where: { email: "demo@247app.com" },
    update: {},
    create: {
      email: "demo@247app.com",
      username: "demo",
      displayName: "Demo User",
      passwordHash,
      bio: "Exploring the 24/7 platform",
    },
  });

  console.log(`Seeded demo user (id=${demo.id}).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
