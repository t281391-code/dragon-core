import type { Prisma } from "@prisma/client";
import {
  FINISHED_PRODUCT_CATEGORY,
  FINISHED_PRODUCT_LOCATION,
  getProductRecipe,
  isFinishedProduct,
  RAW_MATERIAL_CATEGORY,
  RAW_MATERIAL_LIMITS,
  STOCK_UNIT_KG,
} from "@/lib/productionFlowConfig";

export class StockFlowError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "StockFlowError";
    this.status = status;
  }
}

function roundStock(value: number) {
  return Math.round(value * 1000) / 1000;
}

function flowMarker(kind: "production" | "transport", id: string) {
  return `[flow:${kind}:${id}]`;
}

function limitForMaterial(materialName: string) {
  return RAW_MATERIAL_LIMITS.find((material) => material.name === materialName)?.maximumStock ?? 0;
}

function sourceDefaults(materialName: string) {
  return {
    category: RAW_MATERIAL_CATEGORY,
    unit: STOCK_UNIT_KG,
    location: RAW_MATERIAL_CATEGORY,
    maximumStock: limitForMaterial(materialName),
  };
}

async function ensureMaterial(
  tx: Prisma.TransactionClient,
  materialName: string,
  defaults: {
    category: string;
    unit: string;
    location: string;
    maximumStock?: number;
  }
) {
  const existing = await tx.material.findFirst({ where: { name: materialName } });
  if (existing) return existing;

  return tx.material.create({
    data: {
      name: materialName,
      category: defaults.category,
      unit: defaults.unit,
      currentStock: 0,
      minimumStock: 0,
      maximumStock: defaults.maximumStock ?? 0,
      location: defaults.location,
    },
  });
}

export async function getProductionRelationMaterialId(
  tx: Prisma.TransactionClient,
  materialId?: string | null,
  productName?: string
) {
  if (materialId) return materialId;

  const firstRecipeItem = productName ? getProductRecipe(productName)[0] : null;
  if (firstRecipeItem) {
    const material = await ensureMaterial(tx, firstRecipeItem.materialName, sourceDefaults(firstRecipeItem.materialName));
    return material.id;
  }

  const fallbackName = "Үйлдвэрлэлийн ерөнхий материал";
  const fallback = await ensureMaterial(tx, fallbackName, {
    category: "Үйлдвэрлэл",
    unit: STOCK_UNIT_KG,
    location: "Үйлдвэрлэл",
  });
  return fallback.id;
}

export async function applyProductionStockFlow(
  tx: Prisma.TransactionClient,
  input: {
    productionLogId: string;
    productName: string;
    outputQuantity: number;
    productionDate: Date;
    userId: string;
    materialUsage?: Array<{ materialName: string; quantity: number }>;
  }
) {
  const marker = flowMarker("production", input.productionLogId);
  const recipe = input.materialUsage?.length
    ? input.materialUsage.map((item) => ({ materialName: item.materialName, requiredQuantity: roundStock(item.quantity) }))
    : getProductRecipe(input.productName).map((item) => ({
        materialName: item.materialName,
        requiredQuantity: roundStock(input.outputQuantity * item.quantityPerKg),
      }));

  for (const item of recipe) {
    const requiredQuantity = item.requiredQuantity;
    if (requiredQuantity <= 0) continue;

    const material = await ensureMaterial(tx, item.materialName, sourceDefaults(item.materialName));

    if (material.currentStock < requiredQuantity) {
      throw new StockFlowError(
        `${item.materialName} үлдэгдэл хүрэлцэхгүй. Хэрэгтэй: ${requiredQuantity.toLocaleString("mn-MN")} ${material.unit}, байгаа: ${material.currentStock.toLocaleString("mn-MN")} ${material.unit}`
      );
    }

    await tx.material.update({
      where: { id: material.id },
      data: { currentStock: { decrement: requiredQuantity } },
    });
    await tx.materialTransaction.create({
      data: {
        materialId: material.id,
        type: "OUT",
        quantity: requiredQuantity,
        transactionDate: input.productionDate,
        createdById: input.userId,
        note: `Үйлдвэрлэлд зарцуулсан: ${input.productName} ${input.outputQuantity.toLocaleString("mn-MN")} кг ${marker}`,
      },
    });
  }

  const finishedMaterial = await ensureMaterial(tx, input.productName, {
    category: FINISHED_PRODUCT_CATEGORY,
    unit: STOCK_UNIT_KG,
    location: FINISHED_PRODUCT_LOCATION,
  });

  await tx.material.update({
    where: { id: finishedMaterial.id },
    data: {
      category: FINISHED_PRODUCT_CATEGORY,
      unit: STOCK_UNIT_KG,
      location: FINISHED_PRODUCT_LOCATION,
      currentStock: { increment: input.outputQuantity },
    },
  });
  await tx.materialTransaction.create({
    data: {
      materialId: finishedMaterial.id,
      type: "IN",
      quantity: input.outputQuantity,
      transactionDate: input.productionDate,
      createdById: input.userId,
      note: `Үйлдвэрлэлээс бэлэн болсон: ${input.productName} ${input.outputQuantity.toLocaleString("mn-MN")} кг ${marker}`,
    },
  });
}

export async function reverseProductionStockFlow(
  tx: Prisma.TransactionClient,
  productionLogId: string
) {
  await reverseMarkedMaterialTransactions(tx, flowMarker("production", productionLogId));
}

function normalizeQuantityToStockUnit(quantity: number, inputUnit: string | null | undefined, stockUnit: string) {
  const from = (inputUnit || stockUnit).trim().toLowerCase();
  const to = stockUnit.trim().toLowerCase();

  if ((from === "тн" || from === "tn" || from === "ton" || from === "тонн") && (to === "кг" || to === "kg")) {
    return quantity * 1000;
  }

  if ((from === "кг" || from === "kg") && (to === "тн" || to === "tn" || to === "ton" || to === "тонн")) {
    return quantity / 1000;
  }

  return quantity;
}

export async function applyTransportStockFlow(
  tx: Prisma.TransactionClient,
  input: {
    transportId: string;
    materialId: string;
    quantity: number;
    inputUnit?: string | null;
    destinationSite: string;
    transportDate: Date;
    userId: string;
  }
) {
  const material = await tx.material.findUnique({ where: { id: input.materialId } });
  if (!material || !isFinishedProduct(material)) return input.quantity;

  const stockQuantity = roundStock(normalizeQuantityToStockUnit(input.quantity, input.inputUnit, material.unit));
  if (material.currentStock < stockQuantity) {
    throw new StockFlowError(
      `${material.name} бэлэн үлдэгдэл хүрэлцэхгүй. Ачих: ${stockQuantity.toLocaleString("mn-MN")} ${material.unit}, байгаа: ${material.currentStock.toLocaleString("mn-MN")} ${material.unit}`
    );
  }

  await tx.material.update({
    where: { id: material.id },
    data: { currentStock: { decrement: stockQuantity } },
  });
  await tx.materialTransaction.create({
    data: {
      materialId: material.id,
      type: "OUT",
      quantity: stockQuantity,
      transactionDate: input.transportDate,
      createdById: input.userId,
      note: `Тээвэрлэлтэд ачсан: ${material.name} → ${input.destinationSite} ${flowMarker("transport", input.transportId)}`,
    },
  });

  return stockQuantity;
}

export async function reverseTransportStockFlow(
  tx: Prisma.TransactionClient,
  transportId: string
) {
  await reverseMarkedMaterialTransactions(tx, flowMarker("transport", transportId));
}

async function reverseMarkedMaterialTransactions(tx: Prisma.TransactionClient, marker: string) {
  const transactions = await tx.materialTransaction.findMany({
    where: { note: { contains: marker } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      materialId: true,
      type: true,
      quantity: true,
      material: { select: { currentStock: true, name: true, unit: true } },
    },
  });

  for (const transaction of transactions) {
    if (transaction.type === "IN" && transaction.material.currentStock < transaction.quantity) {
      throw new StockFlowError(
        `${transaction.material.name} үлдэгдэл буцаах боломжгүй. Одоогийн үлдэгдэл: ${transaction.material.currentStock.toLocaleString("mn-MN")} ${transaction.material.unit}`
      );
    }

    await tx.material.update({
      where: { id: transaction.materialId },
      data: {
        currentStock: {
          increment: transaction.type === "OUT" ? transaction.quantity : -transaction.quantity,
        },
      },
    });
    await tx.materialTransaction.delete({ where: { id: transaction.id } });
  }
}
