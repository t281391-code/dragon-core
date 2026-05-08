export type EquipmentSeed = {
  name: string;
  type: string;
  maxRpm: number;
  department: string;
};

export const DEFAULT_EQUIPMENT: EquipmentSeed[] = [
  { name: "Mono pump", type: "PUMP", maxRpm: 2950, department: "PRODUCTION" },
  { name: "Final mixer", type: "MIXER", maxRpm: 36000, department: "PRODUCTION" },
  { name: "Solution pump", type: "PUMP", maxRpm: 2950, department: "PRODUCTION" },
  { name: "Oil mixer", type: "MIXER", maxRpm: 1800, department: "PRODUCTION" },
];

export const PRODUCT_EQUIPMENT_MAP: Record<string, string[]> = {
  "ANDO-EV 25MM": ["Solution pump"],
  "ANDO-EV 32MM": ["Solution pump"],
  "ANDO-SPLIT 38MM": ["Solution pump", "Final mixer"],
  "ANDO-V 60MM": ["Mono pump", "Final mixer"],
  "ANDO-V 90MM": ["Mono pump", "Final mixer"],
  "ANDO-V 120MM": ["Mono pump", "Final mixer"],
  "EV 25MM": ["Solution pump"],
  "EV 32MM": ["Solution pump"],
  "SPLIT 38MM": ["Solution pump", "Final mixer"],
  "ANFO 60MM": ["Mono pump", "Final mixer"],
  "ANFO 90MM": ["Mono pump", "Final mixer"],
  "ANFO 120MM": ["Mono pump", "Final mixer"],
  "OIL MIX": ["Oil mixer"],
};

export function normalizeProductType(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function getSuggestedEquipmentNames(productType: string) {
  return PRODUCT_EQUIPMENT_MAP[normalizeProductType(productType)] ?? [];
}
