import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "משרד הדגמה", slug: "demo" },
  });

  await prisma.user.upsert({
    where: { email: "advisor@demo.local" },
    update: {},
    create: {
      email: "advisor@demo.local",
      name: "יועץ הדגמה",
      passwordHash,
      role: "PRINCIPAL",
      organizationId: org.id,
    },
  });

  console.log("Seeded demo org + user → advisor@demo.local / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
