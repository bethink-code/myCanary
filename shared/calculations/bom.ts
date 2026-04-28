/**
 * Pure BOM (Bill of Materials) calculations.
 *
 * Translates a production plan ("manufacture 500 of SKU X, 300 of SKU Y")
 * into the supply consumption it implies ("we need 6.5 kg of magnesium
 * oxide and 800 labels"), using the supply→product mapping matrix.
 */

export interface BomLine {
  supplyId: number;
  skuCode: string;
  quantityPerUnit: number; // already-converted per-pack ratio
}

export type QuantityBasis = "per_unit" | "per_batch";
export type BatchSizeUnit = "tablets" | "units" | "kg";

export interface ProductBatchInfo {
  batchSizeMinimum: number | null;
  batchSizeUnit: BatchSizeUnit | null;
  packSizeUnits: number | null; // tablets/units per pack (chews=30, sprays=1)
  packSizeG: number | null; // grams per pack (formulas/mixes)
}

/**
 * Number of finished packs in one manufacturer batch.
 * Returns null when the conversion can't be done (missing batch size or
 * mismatched units).
 *
 *   batch in tablets/units → packs = batchMin / packSizeUnits
 *   batch in kg            → packs = batchMin * 1000 / packSizeG
 */
export function packsPerBatch(p: ProductBatchInfo): number | null {
  if (p.batchSizeMinimum == null || p.batchSizeUnit == null) return null;
  if (p.batchSizeUnit === "kg") {
    if (!p.packSizeG || p.packSizeG <= 0) return null;
    return (p.batchSizeMinimum * 1000) / p.packSizeG;
  }
  // tablets or units
  if (!p.packSizeUnits || p.packSizeUnits <= 0) return null;
  return p.batchSizeMinimum / p.packSizeUnits;
}

/**
 * Convert a per-batch BOM quantity into a per-pack quantity for a given
 * product. Returns null when conversion isn't possible (e.g. no batch
 * size set on the product); callers should treat that as "skip this BOM
 * row from PO drafting and warn Beryl".
 */
export function perPackFromBatch(perBatchQty: number, p: ProductBatchInfo): number | null {
  const ppb = packsPerBatch(p);
  if (ppb == null || ppb <= 0) return null;
  return perBatchQty / ppb;
}

/**
 * Resolve a stored BOM row to its per-pack quantity, applying the basis
 * conversion if needed. Returns null if the row is per_batch but the
 * product is missing batch info — caller decides how to handle.
 */
export function resolveBomPerPack(
  row: { quantityPerUnit: number; quantityBasis: QuantityBasis },
  product: ProductBatchInfo,
): number | null {
  if (row.quantityBasis === "per_unit") return row.quantityPerUnit;
  return perPackFromBatch(row.quantityPerUnit, product);
}

export interface ProductionPlanLine {
  skuCode: string;
  quantity: number; // units of finished product
}

export interface SupplyConsumption {
  supplyId: number;
  quantityNeeded: number; // sum of (quantityPerUnit * production qty) across all SKUs that use this supply
}

/**
 * Given a BOM matrix and a production plan, compute the total consumption
 * per supply. Output is one row per distinct supplyId.
 *
 * Example:
 *   BOM: { supply 1 → SKU A (0.5 kg/unit), supply 1 → SKU B (1.0 kg/unit) }
 *   Plan: [SKU A: 100, SKU B: 200]
 *   → [{ supplyId: 1, quantityNeeded: 100*0.5 + 200*1.0 = 250 }]
 */
export function calcSupplyConsumption(
  bom: BomLine[],
  plan: ProductionPlanLine[],
): SupplyConsumption[] {
  const planBySku = new Map<string, number>();
  for (const line of plan) {
    planBySku.set(line.skuCode, (planBySku.get(line.skuCode) ?? 0) + line.quantity);
  }

  const consumed = new Map<number, number>();
  for (const bomLine of bom) {
    const planQty = planBySku.get(bomLine.skuCode);
    if (!planQty) continue;
    const qty = planQty * bomLine.quantityPerUnit;
    consumed.set(bomLine.supplyId, (consumed.get(bomLine.supplyId) ?? 0) + qty);
  }

  return Array.from(consumed.entries())
    .map(([supplyId, quantityNeeded]) => ({ supplyId, quantityNeeded }))
    .sort((a, b) => a.supplyId - b.supplyId);
}

export interface MatrixCell {
  supplyId: number;
  skuCode: string;
  quantityPerUnit: number | null;
}

/**
 * Convert raw BOM rows to a sparse cell representation suitable for the
 * Settings → BOM Matrix grid. Returns one cell per (supply, sku) that has
 * a non-zero mapping; missing cells are absent (rendered blank in UI).
 */
export function bomToMatrixCells(bom: BomLine[]): MatrixCell[] {
  return bom.map((line) => ({
    supplyId: line.supplyId,
    skuCode: line.skuCode,
    quantityPerUnit: line.quantityPerUnit,
  }));
}
