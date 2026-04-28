/**
 * Pure stock movement types + validation + ledger-row transformation.
 *
 * A Movement is a user-submitted intent; the ledger is the source of truth.
 * This module:
 *   1. Declares every legal movement shape (discriminated union).
 *   2. Validates an input, returning human-readable error strings.
 *   3. Transforms an input to the concrete ledger rows to persist.
 *
 * No DB, no Express, no React. Pure functions only.
 */

// ─── Types ────────────────────────────────────────────────────

export type StockLocation = string; // "THH" | "88" typically; free-text-compatible

// Supply locations: physical places supplies sit. Sum of supply_transactions
// per location gives the current balance at that location.
export const SUPPLY_LOCATIONS = ["THH", "Zinchar", "NutriMed"] as const;
export type SupplyLocation = (typeof SUPPLY_LOCATIONS)[number];

export type ProductMovement =
  | {
      type: "OPENING_BALANCE";
      subjectKind: "product";
      skuCode: string;
      location: StockLocation;
      quantity: number;
      date: string; // ISO yyyy-mm-dd
    }
  | {
      type: "DELIVERY_RECEIVED";
      subjectKind: "product";
      skuCode: string;
      location: StockLocation;
      quantity: number;
      date: string;
      deliveryNoteRef?: string;
      batchNumber: string;
      manufactureDate: string;
      expiryDate: string;
      sizeVariant?: string;
    }
  | {
      type: "ADJUSTMENT_IN";
      subjectKind: "product";
      skuCode: string;
      location: StockLocation;
      quantity: number;
      date: string;
      reasonText: string;
    }
  | {
      type: "ADJUSTMENT_OUT";
      subjectKind: "product";
      skuCode: string;
      location: StockLocation;
      quantity: number;
      date: string;
      reasonText: string;
    }
  | {
      type: "TRANSFER";
      subjectKind: "product";
      skuCode: string;
      fromLocation: StockLocation;
      toLocation: StockLocation;
      quantity: number;
      date: string;
    }
  | {
      type: "SALES_OUT";
      subjectKind: "product";
      skuCode: string;
      location: StockLocation;
      quantity: number;
      date: string;
      invoiceRef?: string;
      channel?: string;
      reasonText?: string;
    };

export type SupplyMovement =
  | {
      type: "OPENING_BALANCE";
      subjectKind: "supply";
      supplyId: number;
      location: SupplyLocation;
      quantity: number;
      date: string;
    }
  | {
      type: "DELIVERY_RECEIVED";
      subjectKind: "supply";
      supplyId: number;
      location: SupplyLocation;
      quantity: number;
      date: string;
      reference?: string;
    }
  | {
      type: "ADJUSTMENT_IN";
      subjectKind: "supply";
      supplyId: number;
      location: SupplyLocation;
      quantity: number;
      date: string;
      reasonText: string;
    }
  | {
      type: "ADJUSTMENT_OUT";
      subjectKind: "supply";
      supplyId: number;
      location: SupplyLocation;
      quantity: number;
      date: string;
      reasonText: string;
    }
  | {
      type: "SUPPLY_TRANSFER";
      subjectKind: "supply";
      supplyId: number;
      fromLocation: SupplyLocation;
      toLocation: SupplyLocation;
      quantity: number;
      date: string;
    }
  | {
      type: "SUPPLY_SENT_TO_MANUFACTURER";
      subjectKind: "supply";
      supplyId: number;
      fromLocation: SupplyLocation;
      toLocation: SupplyLocation;
      quantity: number;
      date: string;
      manufacturerName?: string;
      reference?: string;
      relatedPoId?: number;
    };

export type MovementInput = ProductMovement | SupplyMovement;

// Ledger-row output shapes (match the DB tables)

export interface StockLedgerRow {
  skuCode: string;
  stockLocation: StockLocation;
  transactionType: string;
  quantity: number; // signed
  transactionDate: string;
  reference?: string | null;
  channel?: string | null;
  notes?: string | null;
}

export interface SupplyLedgerRow {
  supplyId: number;
  location: SupplyLocation;
  transactionType: string;
  quantity: number; // signed
  transactionDate: string;
  manufacturerName?: string | null;
  reference?: string | null;
  notes?: string | null;
  relatedPoId?: number | null;
}

export interface BatchRow {
  skuCode: string;
  sizeVariant: string;
  stockLocation: StockLocation;
  batchNumber: string;
  manufactureDate: string;
  expiryDate: string;
  initialQuantity: number;
  receivedDate: string;
  deliveryNoteRef?: string | null;
}

export interface LedgerEffect {
  stockRows: StockLedgerRow[];
  supplyRows: SupplyLedgerRow[];
  batchRow: BatchRow | null;
}

// ─── Validation ───────────────────────────────────────────────

function common(input: { quantity: number; date: string }): string[] {
  const errors: string[] = [];
  if (!(typeof input.quantity === "number") || !Number.isFinite(input.quantity)) {
    errors.push("quantity must be a number");
  } else if (input.quantity <= 0) {
    errors.push("quantity must be positive (direction is implied by movement type)");
  }
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    errors.push("date must be yyyy-mm-dd");
  }
  return errors;
}

function requireText(value: unknown, field: string): string[] {
  return typeof value === "string" && value.trim().length > 0 ? [] : [`${field} is required`];
}

/**
 * Validate a movement input. Returns array of error strings, or [] if valid.
 */
export function validateMovement(input: MovementInput): string[] {
  const errors: string[] = [];
  errors.push(...common(input));

  if (input.subjectKind === "product") {
    errors.push(...requireText(input.skuCode, "skuCode"));
    if (input.type === "TRANSFER") {
      errors.push(...requireText(input.fromLocation, "fromLocation"));
      errors.push(...requireText(input.toLocation, "toLocation"));
      if (input.fromLocation === input.toLocation) errors.push("fromLocation and toLocation must differ");
    } else {
      errors.push(...requireText((input as { location: string }).location, "location"));
    }
    if (input.type === "DELIVERY_RECEIVED") {
      errors.push(...requireText(input.batchNumber, "batchNumber"));
      errors.push(...requireText(input.manufactureDate, "manufactureDate"));
      errors.push(...requireText(input.expiryDate, "expiryDate"));
    }
    if (input.type === "ADJUSTMENT_IN" || input.type === "ADJUSTMENT_OUT") {
      errors.push(...requireText(input.reasonText, "reasonText"));
    }
  } else {
    if (!Number.isInteger(input.supplyId) || input.supplyId <= 0) {
      errors.push("supplyId must be a positive integer");
    }
    if (input.type === "SUPPLY_TRANSFER" || input.type === "SUPPLY_SENT_TO_MANUFACTURER") {
      errors.push(...requireText(input.fromLocation, "fromLocation"));
      errors.push(...requireText(input.toLocation, "toLocation"));
      if (input.fromLocation === input.toLocation) errors.push("fromLocation and toLocation must differ");
      if (input.fromLocation && !SUPPLY_LOCATIONS.includes(input.fromLocation as SupplyLocation)) {
        errors.push(`fromLocation must be one of ${SUPPLY_LOCATIONS.join(", ")}`);
      }
      if (input.toLocation && !SUPPLY_LOCATIONS.includes(input.toLocation as SupplyLocation)) {
        errors.push(`toLocation must be one of ${SUPPLY_LOCATIONS.join(", ")}`);
      }
    } else {
      const loc = (input as { location: string }).location;
      errors.push(...requireText(loc, "location"));
      if (loc && !SUPPLY_LOCATIONS.includes(loc as SupplyLocation)) {
        errors.push(`location must be one of ${SUPPLY_LOCATIONS.join(", ")}`);
      }
    }
    if (input.type === "ADJUSTMENT_IN" || input.type === "ADJUSTMENT_OUT") {
      errors.push(...requireText(input.reasonText, "reasonText"));
    }
  }

  return errors;
}

// ─── Transformer ──────────────────────────────────────────────

/**
 * Map a movement input to the ledger rows (and optional batch) that should be persisted.
 * Pure: no DB calls. Rows carry no id or clientId; the storage layer adds those.
 */
export function movementToLedger(input: MovementInput): LedgerEffect {
  const effect: LedgerEffect = { stockRows: [], supplyRows: [], batchRow: null };

  if (input.subjectKind === "product") {
    switch (input.type) {
      case "OPENING_BALANCE":
        effect.stockRows.push({
          skuCode: input.skuCode,
          stockLocation: input.location,
          transactionType: "OPENING_BALANCE",
          quantity: input.quantity,
          transactionDate: input.date,
          reference: "opening balance",
        });
        break;
      case "DELIVERY_RECEIVED":
        effect.batchRow = {
          skuCode: input.skuCode,
          sizeVariant: input.sizeVariant ?? "",
          stockLocation: input.location,
          batchNumber: input.batchNumber,
          manufactureDate: input.manufactureDate,
          expiryDate: input.expiryDate,
          initialQuantity: input.quantity,
          receivedDate: input.date,
          deliveryNoteRef: input.deliveryNoteRef ?? null,
        };
        effect.stockRows.push({
          skuCode: input.skuCode,
          stockLocation: input.location,
          transactionType: "DELIVERY_IN",
          quantity: input.quantity,
          transactionDate: input.date,
          reference: input.deliveryNoteRef ?? null,
        });
        break;
      case "ADJUSTMENT_IN":
        effect.stockRows.push({
          skuCode: input.skuCode,
          stockLocation: input.location,
          transactionType: "ADJUSTMENT",
          quantity: input.quantity,
          transactionDate: input.date,
          notes: input.reasonText,
        });
        break;
      case "ADJUSTMENT_OUT":
        effect.stockRows.push({
          skuCode: input.skuCode,
          stockLocation: input.location,
          transactionType: "ADJUSTMENT",
          quantity: -input.quantity,
          transactionDate: input.date,
          notes: input.reasonText,
        });
        break;
      case "TRANSFER": {
        const from = input.fromLocation;
        const to = input.toLocation;
        const ttype = `TRANSFER_${from}_TO_${to}`;
        effect.stockRows.push({
          skuCode: input.skuCode,
          stockLocation: from,
          transactionType: ttype,
          quantity: -input.quantity,
          transactionDate: input.date,
        });
        effect.stockRows.push({
          skuCode: input.skuCode,
          stockLocation: to,
          transactionType: ttype,
          quantity: input.quantity,
          transactionDate: input.date,
        });
        break;
      }
      case "SALES_OUT":
        effect.stockRows.push({
          skuCode: input.skuCode,
          stockLocation: input.location,
          transactionType: "SALES_OUT",
          quantity: -input.quantity,
          transactionDate: input.date,
          reference: input.invoiceRef ?? null,
          channel: input.channel ?? null,
          notes: input.reasonText ?? null,
        });
        break;
    }
  } else {
    switch (input.type) {
      case "OPENING_BALANCE":
        effect.supplyRows.push({
          supplyId: input.supplyId,
          location: input.location,
          transactionType: "RECEIVED",
          quantity: input.quantity,
          transactionDate: input.date,
          notes: "opening balance",
        });
        break;
      case "DELIVERY_RECEIVED":
        effect.supplyRows.push({
          supplyId: input.supplyId,
          location: input.location,
          transactionType: "RECEIVED",
          quantity: input.quantity,
          transactionDate: input.date,
          reference: input.reference ?? null,
        });
        break;
      case "ADJUSTMENT_IN":
        effect.supplyRows.push({
          supplyId: input.supplyId,
          location: input.location,
          transactionType: "ADJUSTMENT",
          quantity: input.quantity,
          transactionDate: input.date,
          notes: input.reasonText,
        });
        break;
      case "ADJUSTMENT_OUT":
        effect.supplyRows.push({
          supplyId: input.supplyId,
          location: input.location,
          transactionType: "ADJUSTMENT",
          quantity: -input.quantity,
          transactionDate: input.date,
          notes: input.reasonText,
        });
        break;
      case "SUPPLY_TRANSFER": {
        const ttype = `SUPPLY_TRANSFER_${input.fromLocation}_TO_${input.toLocation}`;
        effect.supplyRows.push({
          supplyId: input.supplyId,
          location: input.fromLocation,
          transactionType: ttype,
          quantity: -input.quantity,
          transactionDate: input.date,
        });
        effect.supplyRows.push({
          supplyId: input.supplyId,
          location: input.toLocation,
          transactionType: ttype,
          quantity: input.quantity,
          transactionDate: input.date,
        });
        break;
      }
      case "SUPPLY_SENT_TO_MANUFACTURER":
        effect.supplyRows.push({
          supplyId: input.supplyId,
          location: input.fromLocation,
          transactionType: "SENT_TO_MANUFACTURER",
          quantity: -input.quantity,
          transactionDate: input.date,
          manufacturerName: input.manufacturerName ?? null,
          reference: input.reference ?? null,
          relatedPoId: input.relatedPoId ?? null,
        });
        effect.supplyRows.push({
          supplyId: input.supplyId,
          location: input.toLocation,
          transactionType: "SENT_TO_MANUFACTURER",
          quantity: input.quantity,
          transactionDate: input.date,
          manufacturerName: input.manufacturerName ?? null,
          reference: input.reference ?? null,
          relatedPoId: input.relatedPoId ?? null,
        });
        break;
    }
  }

  return effect;
}

// ─── Registry metadata (for UI) ───────────────────────────────

export interface MovementTypeMeta {
  type: MovementInput["type"];
  direction: "in" | "out";
  subjectKinds: Array<"product" | "supply">;
  label: string;
  requiresReason: boolean;
}

export const MOVEMENT_TYPES: MovementTypeMeta[] = [
  { type: "OPENING_BALANCE", direction: "in", subjectKinds: ["product", "supply"], label: "Opening balance", requiresReason: false },
  { type: "DELIVERY_RECEIVED", direction: "in", subjectKinds: ["product", "supply"], label: "Delivery received", requiresReason: false },
  { type: "ADJUSTMENT_IN", direction: "in", subjectKinds: ["product", "supply"], label: "Adjustment (correction up)", requiresReason: true },
  { type: "ADJUSTMENT_OUT", direction: "out", subjectKinds: ["product", "supply"], label: "Adjustment (correction down / write-off)", requiresReason: true },
  { type: "TRANSFER", direction: "out", subjectKinds: ["product"], label: "Transfer between locations", requiresReason: false },
  { type: "SALES_OUT", direction: "out", subjectKinds: ["product"], label: "Sales / dispatch", requiresReason: false },
  { type: "SUPPLY_TRANSFER", direction: "out", subjectKinds: ["supply"], label: "Transfer between locations", requiresReason: false },
  { type: "SUPPLY_SENT_TO_MANUFACTURER", direction: "out", subjectKinds: ["supply"], label: "Send to manufacturer", requiresReason: false },
];
