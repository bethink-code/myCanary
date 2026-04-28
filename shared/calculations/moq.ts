/**
 * Pure MOQ rule application for PO drafting.
 *
 * Given a desired quantity and the relevant rule context (product MOQ,
 * supply MOQ, manufacturer minimums, etc.), return the adjusted quantity
 * the system should propose, plus human-readable reasons explaining
 * each adjustment.
 *
 * No DB, no Express. Used by both the future PO drafting endpoint and
 * the future PATCH endpoints that recalc on edit.
 */

export interface ProductMoq {
  caseRoundingRequired: boolean;
  unitsPerCase: number | null;
  minOrderQty: number | null;
}

export interface SupplyMoq {
  moqStructured: number | null;
  caseRoundingRequired: boolean;
  unitsPerCase: number | null;
}

export interface ManufacturerMoq {
  minOrderValueZar: number | null;
  orderFrequencyCapDays: number | null;
}

export interface MoqContext {
  product?: ProductMoq;
  supply?: SupplyMoq;
  manufacturer?: ManufacturerMoq;
}

export interface MoqAdjustment {
  adjustedQty: number;
  reasons: string[];
}

/** Round `qty` up to the nearest multiple of `step`. */
function roundUpTo(qty: number, step: number): number {
  if (step <= 0) return qty;
  return Math.ceil(qty / step) * step;
}

/**
 * Apply per-line MOQ rules (case rounding + per-product/supply minimum) to
 * a single desired quantity. Manufacturer-level rules (min order value,
 * frequency cap) are applied at the PO level, not the line level —
 * see `checkOrderFrequency` and PO-level totalisers.
 */
export function applyMoqRules(desiredQty: number, ctx: MoqContext): MoqAdjustment {
  let qty = Math.max(0, Math.floor(desiredQty));
  const reasons: string[] = [];

  // 1. Per-product/supply minimum order qty
  const min =
    ctx.product?.minOrderQty ??
    ctx.supply?.moqStructured ??
    null;
  if (min != null && min > 0 && qty < min) {
    reasons.push(`raised to MOQ ${min}`);
    qty = min;
  }

  // 2. Case rounding (rounds up to nearest unitsPerCase)
  const caseRounding =
    ctx.product?.caseRoundingRequired || ctx.supply?.caseRoundingRequired || false;
  const unitsPerCase = ctx.product?.unitsPerCase ?? ctx.supply?.unitsPerCase ?? null;
  if (caseRounding && unitsPerCase && unitsPerCase > 1) {
    const rounded = roundUpTo(qty, unitsPerCase);
    if (rounded !== qty) {
      reasons.push(`rounded up to nearest ${unitsPerCase} (case size)`);
      qty = rounded;
    }
  }

  return { adjustedQty: qty, reasons };
}

export interface BundlingRule {
  primarySkuCode: string;
  bundledSkuCode: string;
  ratio: number; // bundled qty per primary qty unit
}

export interface DraftLine {
  skuCode: string;
  quantity: number;
}

export interface BundledLine extends DraftLine {
  reason?: string;
}

/**
 * Apply bundling rules to a draft set of PO lines.
 *
 * For each rule whose primary SKU appears in the draft, ensure the bundled
 * SKU is also present at qty >= primary_qty * ratio. If the bundled SKU
 * is already there at sufficient qty, it stays untouched. If absent, it
 * is added. If present but below the required qty, it is raised.
 */
export function applyBundlingRules(
  draftLines: DraftLine[],
  rules: BundlingRule[],
): BundledLine[] {
  const out: BundledLine[] = draftLines.map((l) => ({ ...l }));
  const bySku = new Map<string, BundledLine>();
  for (const line of out) bySku.set(line.skuCode, line);

  for (const rule of rules) {
    const primary = bySku.get(rule.primarySkuCode);
    if (!primary || primary.quantity <= 0) continue;

    const requiredBundledQty = Math.ceil(primary.quantity * rule.ratio);
    const existing = bySku.get(rule.bundledSkuCode);

    if (!existing) {
      const newLine: BundledLine = {
        skuCode: rule.bundledSkuCode,
        quantity: requiredBundledQty,
        reason: `bundled with ${rule.primarySkuCode} (ratio ${rule.ratio})`,
      };
      out.push(newLine);
      bySku.set(rule.bundledSkuCode, newLine);
    } else if (existing.quantity < requiredBundledQty) {
      existing.quantity = requiredBundledQty;
      existing.reason = `raised to bundle with ${rule.primarySkuCode} (ratio ${rule.ratio})`;
    }
  }

  return out;
}

export interface FrequencyCheck {
  allowed: boolean;
  daysUntilAllowed: number;
}

/**
 * Check whether a new PO is allowed given the manufacturer's frequency cap.
 * `lastPoDate` is the most recent PO date for this manufacturer (any
 * status — even DRAFT counts; the cap is about frequency of action, not
 * delivery).
 */
export function checkOrderFrequency(
  lastPoDate: string | null,
  manufacturer: { orderFrequencyCapDays: number | null },
  today: Date = new Date(),
): FrequencyCheck {
  const cap = manufacturer.orderFrequencyCapDays;
  if (cap == null || cap <= 0 || !lastPoDate) {
    return { allowed: true, daysUntilAllowed: 0 };
  }
  const daysSince = Math.floor(
    (today.getTime() - new Date(lastPoDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSince >= cap) return { allowed: true, daysUntilAllowed: 0 };
  return { allowed: false, daysUntilAllowed: cap - daysSince };
}
