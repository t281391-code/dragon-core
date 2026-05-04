import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

const roles = ["ADMIN", "MODERATOR", "USER"] as const;
const departments = ["WAREHOUSE", "PRODUCTION", "SAFETY", "LOGISTICS"] as const;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

async function main() {
  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  for (const name of departments) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "ADMIN" }
  });

  const warehouseDepartment = await prisma.department.findUniqueOrThrow({
    where: { name: "WAREHOUSE" }
  });

  await prisma.user.upsert({
    where: { email: "admin@dragoncity.local" },
    update: {
      roleId: adminRole.id,
      departmentId: warehouseDepartment.id,
      isActive: true
    },
    create: {
      fullName: "System Administrator",
      email: "admin@dragoncity.local",
      passwordHash: hashPassword("Admin123!"),
      roleId: adminRole.id,
      departmentId: warehouseDepartment.id,
      isActive: true
    }
  });
}

main()
  .then(async () => {
    console.log("Seed data created successfully.");
    console.log("Admin email: admin@dragoncity.local");
    console.log("Admin password: Admin123!");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
