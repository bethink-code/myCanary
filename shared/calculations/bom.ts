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
  quantityPerUnit: number; // BOM ratio
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
