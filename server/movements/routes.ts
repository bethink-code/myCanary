/**
 * Unified movements API — thin plumbing.
 * Every stock/supply change goes through POST /api/movements.
 */

import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { isAuthenticated } from "../routes";
import { getClientId } from "../clientContext";
import { logAudit } from "../auditLog";
import { recordMovement } from "./storage";
import type { MovementInput } from "../../shared/calculations/movements";

export const movementsRouter = Router();

const baseProduct = {
  subjectKind: z.literal("product"),
  skuCode: z.string().min(1).max(50),
  quantity: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
};
const baseSupply = {
  subjectKind: z.literal("supply"),
  supplyId: z.number().int().positive(),
  quantity: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
};

// Discriminated unions matching the pure types. Zod validates shape; the
// pure validateMovement() handles semantic rules (e.g. fromLocation != to).
const movementSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("OPENING_BALANCE"), ...baseProduct, location: z.string().min(1).max(10) }),
  z.object({
    type: z.literal("DELIVERY_RECEIVED"),
    ...baseProduct,
    location: z.string().min(1).max(10),
    deliveryNoteRef: z.string().max(100).optional(),
    batchNumber: z.string().min(1).max(100),
    manufactureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sizeVariant: z.string().max(50).optional(),
  }),
  z.object({
    type: z.literal("ADJUSTMENT_IN"),
    ...baseProduct,
    location: z.string().min(1).max(10),
    reasonText: z.string().min(1).max(500),
  }),
  z.object({
    type: z.literal("ADJUSTMENT_OUT"),
    ...baseProduct,
    location: z.string().min(1).max(10),
    reasonText: z.string().min(1).max(500),
  }),
  z.object({
    type: z.literal("TRANSFER"),
    ...baseProduct,
    fromLocation: z.string().min(1).max(10),
    toLocation: z.string().min(1).max(10),
  }),
  z.object({
    type: z.literal("SALES_OUT"),
    ...baseProduct,
    location: z.string().min(1).max(10),
    invoiceRef: z.string().max(100).optional(),
    channel: z.string().max(5).optional(),
    reasonText: z.string().max(500).optional(),
  }),
  z.object({ type: z.literal("OPENING_BALANCE"), ...baseSupply }),
  z.object({
    type: z.literal("DELIVERY_RECEIVED"),
    ...baseSupply,
    reference: z.string().max(255).optional(),
  }),
  z.object({
    type: z.literal("ADJUSTMENT_IN"),
    ...baseSupply,
    reasonText: z.string().min(1).max(500),
  }),
  z.object({
    type: z.literal("ADJUSTMENT_OUT"),
    ...baseSupply,
    reasonText: z.string().min(1).max(500),
  }),
  z.object({
    type: z.literal("SUPPLY_SENT_TO_MANUFACTURER"),
    ...baseSupply,
    manufacturerName: z.string().max(255).optional(),
    reference: z.string().max(255).optional(),
    relatedPoId: z.number().int().positive().optional(),
  }),
]);

movementsRouter.post("/", isAuthenticated, async (req, res) => {
  try {
    const clientId = getClientId(req);
    const user = req.user as { id: number };

    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid movement input", errors: parsed.error.flatten() });
    }

    const input = parsed.data as MovementInput;
    const result = await recordMovement(clientId, user.id, input);

    const subjectLabel =
      input.subjectKind === "product"
        ? input.skuCode
        : `supply #${(input as { supplyId: number }).supplyId}`;

    logAudit(req, `MOVEMENT_${input.type}`, {
      resourceType: input.subjectKind === "product" ? "Product" : "Supply",
      resourceId: subjectLabel,
      detail: `${input.quantity} units · ${input.date}`,
      afterValue: result as unknown as Record<string, unknown>,
    });

    res.json(result);
  } catch (err: any) {
    if (err.code === "INVALID_MOVEMENT") {
      return res.status(400).json({ message: err.message, errors: err.errors });
    }
    res.status(500).json({ message: "Failed to record movement", error: err.message });
  }
});

export function registerMovementRoutes(router: ExpressRouter) {
  router.use("/api/movements", movementsRouter);
}
