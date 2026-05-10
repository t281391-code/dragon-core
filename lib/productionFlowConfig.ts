export const RAW_MATERIAL_CATEGORY = "Агуулах";
export const FINISHED_PRODUCT_CATEGORY = "Бэлэн бүтээгдэхүүн";
export const FINISHED_PRODUCT_LOCATION = "Үйлдвэрийн бэлэн бүтээгдэхүүн";
export const STOCK_UNIT_KG = "кг";
export const INTERMEDIATE_EXPLOSIVE_PRODUCT = "ҮЙЛ ТЭСРЭХ";

export const RAW_MATERIAL_LIMITS = [
  { name: "АМИАКИЙН ШҮҮ", maximumStock: 500_000 },
  { name: "ЦУУНЫ ХҮЧИЛ", maximumStock: 2_000 },
  { name: "ХҮХРИЙН ХҮЧИЛ", maximumStock: 100 },
  { name: "ШИЛЭН БӨМБӨЛӨГ", maximumStock: 8_000 },
  { name: "ТҮЛШ", maximumStock: 800_000 },
  { name: "НИТРИТ НАТРИ", maximumStock: 7_000 },
  { name: "ЭМУЛЬГАТОР", maximumStock: 100_000 },
  { name: "ХАТУУРУУЛАГЧ", maximumStock: 300_000 },
  { name: "ГИДРОКСИД", maximumStock: 200 },
  { name: "ЦАГААН ТОС", maximumStock: 400_000 },
] as const;

export type ProductRecipeItem = {
  materialName: string;
  quantityPerKg: number;
};

const V_RECIPE: ProductRecipeItem[] = [
  { materialName: INTERMEDIATE_EXPLOSIVE_PRODUCT, quantityPerKg: 1 },
];

const EV_RECIPE: ProductRecipeItem[] = [
  { materialName: INTERMEDIATE_EXPLOSIVE_PRODUCT, quantityPerKg: 1 },
];

const SPLIT_RECIPE: ProductRecipeItem[] = [
  { materialName: "АМИАКИЙН ШҮҮ", quantityPerKg: 0.8 },
  { materialName: "ЭМУЛЬГАТОР", quantityPerKg: 0.08 },
  { materialName: "ШИЛЭН БӨМБӨЛӨГ", quantityPerKg: 0.07 },
  { materialName: "ХАТУУРУУЛАГЧ", quantityPerKg: 0.05 },
];

export const PRODUCT_RECIPES: Record<string, ProductRecipeItem[]> = {
  "ANDO-V 60MM": V_RECIPE,
  "ANDO-V 90MM": V_RECIPE,
  "ANDO-V 120MM": V_RECIPE,
  "ANDO-EV 25MM": EV_RECIPE,
  "ANDO-EV 32MM": EV_RECIPE,
  "ANDO-SPLIT 38MM": SPLIT_RECIPE,
};

export const INTERMEDIATE_EXPLOSIVE_INPUTS = [
  "АМИАКИЙН ШҮҮ",
  "ЦАГААН ТОС",
  "ЭМУЛЬГАТОР",
] as const;

export function isIntermediateExplosiveProduct(productName: string) {
  return normalizeProductName(productName) === normalizeProductName(INTERMEDIATE_EXPLOSIVE_PRODUCT);
}

export function normalizeProductName(productName: string) {
  return productName.trim().toUpperCase().replace(/\s+/g, " ");
}

export function getProductRecipe(productName: string) {
  return PRODUCT_RECIPES[normalizeProductName(productName)] ?? [];
}

export function isFinishedProduct(material: { name: string; category?: string | null }) {
  return material.category === FINISHED_PRODUCT_CATEGORY || normalizeProductName(material.name).startsWith("ANDO-");
}
