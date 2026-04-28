import { Router } from "express";
import { z } from "zod";
import { db } from "./db";
import { supplyProductMappings, supplies } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "./auditLog";
import { isAuthenticated } from "./routes";
import { getClientId } from "./clientContext";

const upsertSchema = z.object({
  supplyId: z.number().int().positive(),
  skuCode: z.string().min(1).max(50),
  quantityPerUnit: z.number().positive(),
  notes: z.string().max(2000).nullable().optional(),
});

interface MappingRow {
  id: number;
  clientId: number;
  supplyId: number;
  skuCode: string;
  quantityPerUnit: string | number;
  notes: string | null;
}

function asClientShape(row: MappingRow) {
  return { ...row, quantityPerUnit: Number(row.quantityPerUnit) };
}

export function registerBomMappingRoutes(router: Router) {
  // ─── GET /api/supply-mappings/by-supply/:supplyId ───
  router.get("/api/supply-mappings/by-supply/:supplyId", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const supplyId = Number(req.params.supplyId);
      const rows = await db
        .select()
        .from(supplyProductMappings)
        .where(
          and(
            eq(supplyProductMappings.clientId, clientId),
            eq(supplyProductMappings.supplyId, supplyId),
          ),
        )
        .orderBy(supplyProductMappings.skuCode);
      res.json(rows.map(asClientShape));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load mappings", error: err.message });
    }
  });

  // ─── GET /api/supply-mappings/by-product/:skuCode ───
  router.get("/api/supply-mappings/by-product/:skuCode", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const skuCode = String(req.params.skuCode);
      const rows = await db
        .select({
          id: supplyProductMappings.id,
          clientId: supplyProductMappings.clientId,
          supplyId: supplyProductMappings.supplyId,
          skuCode: supplyProductMappings.skuCode,
          quantityPerUnit: supplyProductMappings.quantityPerUnit,
          notes: supplyProductMappings.notes,
          supplyName: supplies.name,
          supplyUnit: supplies.unitOfMeasure,
        })
        .from(supplyProductMappings)
        .leftJoin(supplies, eq(supplies.id, supplyProductMappings.supplyId))
        .where(
          and(
            eq(supplyProductMappings.clientId, clientId),
            eq(supplyProductMappings.skuCode, skuCode),
          ),
        )
        .orderBy(supplies.name);
      res.json(rows.map((r) => ({ ...r, quantityPerUnit: Number(r.quantityPerUnit) })));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load product BOM", error: err.message });
    }
  });

  // ─── GET /api/supply-mappings/matrix ───
  // Returns the dense BOM as cells the client can render in the matrix grid.
  router.get("/api/supply-mappings/matrix", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const rows = await db
        .select({
          id: supplyProductMappings.id,
          supplyId: supplyProductMappings.supplyId,
          skuCode: supplyProductMappings.skuCode,
          quantityPerUnit: supplyProductMappings.quantityPerUnit,
          notes: supplyProductMappings.notes,
        })
        .from(supplyProductMappings)
        .where(eq(supplyProductMappings.clientId, clientId));
      res.json(rows.map((r) => ({ ...r, quantityPerUnit: Number(r.quantityPerUnit) })));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load BOM matrix", error: err.message });
    }
  });

  // ─── POST /api/supply-mappings — upsert by (supplyId, skuCode) ───
  router.post("/api/supply-mappings", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const parsed = upsertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }

      const [existing] = await db
        .select()
        .from(supplyProductMappings)
        .where(
          and(
            eq(supplyProductMappings.clientId, clientId),
            eq(supplyProductMappings.supplyId, parsed.data.supplyId),
            eq(supplyProductMappings.skuCode, parsed.data.skuCode),
          ),
        );

      if (existing) {
        const [updated] = await db
          .update(supplyProductMappings)
          .set({
            quantityPerUnit: parsed.data.quantityPerUnit.toString(),
            notes: parsed.data.notes ?? null,
          })
          .where(eq(supplyProductMappings.id, existing.id))
          .returning();
        logAudit(req, "BOM_MAPPING_UPDATED", {
          resourceType: "SupplyProductMapping",
          resourceId: String(updated.id),
          beforeValue: existing,
          afterValue: updated,
        });
        return res.json(asClientShape(updated as MappingRow));
      }

      const [created] = await db
        .insert(supplyProductMappings)
        .values({
          clientId,
          supplyId: parsed.data.supplyId,
          skuCode: parsed.data.skuCode,
          quantityPerUnit: parsed.data.quantityPerUnit.toString(),
          notes: parsed.data.notes ?? null,
        })
        .returning();

      logAudit(req, "BOM_MAPPING_CREATED", {
        resourceType: "SupplyProductMapping",
        resourceId: String(created.id),
        detail: `Mapped supply #${parsed.data.supplyId} → ${parsed.data.skuCode} @ ${parsed.data.quantityPerUnit}`,
        afterValue: created,
      });

      res.status(201).json(asClientShape(created as MappingRow));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to upsert mapping", error: err.message });
    }
  });

  // ─── DELETE /api/supply-mappings/:id ───
  router.delete("/api/supply-mappings/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const id = Number(req.params.id);

      const [existing] = await db
        .select()
        .from(supplyProductMappings)
        .where(
          and(eq(supplyProductMappings.id, id), eq(supplyProductMappings.clientId, clientId)),
        );
      if (!existing) return res.status(404).json({ message: "Mapping not found" });

      await db
        .delete(supplyProductMappings)
        .where(
          and(eq(supplyProductMappings.id, id), eq(supplyProductMappings.clientId, clientId)),
        );

      logAudit(req, "BOM_MAPPING_DELETED", {
        resourceType: "SupplyProductMapping",
        resourceId: String(id),
        detail: `Removed supply #${existing.supplyId} → ${existing.skuCode}`,
        beforeValue: existing,
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete mapping", error: err.message });
    }
  });
}
