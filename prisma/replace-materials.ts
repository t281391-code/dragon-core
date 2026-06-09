import { prisma } from "@/lib/prisma";

const NEW_MATERIALS = [
  { name: "ANDO-V 90MM",     unit: "ш", category: "Бүтээгдэхүүн" },
  { name: "ANDO-V 120MM",    unit: "ш", category: "Бүтээгдэхүүн" },
  { name: "ANDO-V 60MM",     unit: "ш", category: "Бүтээгдэхүүн" },
  { name: "ANDO-V 220MM",    unit: "ш", category: "Бүтээгдэхүүн" },
  { name: "ANDO-EV 32MM",    unit: "ш", category: "Бүтээгдэхүүн" },
  { name: "ANDO-EV 25MM",    unit: "ш", category: "Бүтээгдэхүүн" },
  { name: "ANDO-SPLIT 38MM", unit: "ш", category: "Бүтээгдэхүүн" },
];

async function main() {
  // Clear dependent records first
  await prisma.materialTransaction.deleteMany({});
  await prisma.productionLog.deleteMany({});
  await prisma.transport.deleteMany({});

  // Remove all existing materials
  await prisma.material.deleteMany({});

  // Insert new materials
  for (const mat of NEW_MATERIALS) {
    await prisma.material.create({
      data: {
        name: mat.name,
        unit: mat.unit,
        category: mat.category,
        currentStock: 0,
        minimumStock: 0,
        maximumStock: 0,
        location: ""
      }
    });
  }

  console.log("Materials replaced successfully:");
  NEW_MATERIALS.forEach(m => console.log(` • ${m.name} (${m.unit})`));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async err => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
