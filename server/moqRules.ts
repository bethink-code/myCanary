import { Router } from "express";
import { z } from "zod";
import { db } from "./db";
import { moqBundlingRules } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "./auditLog";
import { isAuthenticated } from "./routes";
import { getClientId } from "./clientContext";

const upsertSchema = z.object({
  manufacturerId: z.number().int().positive().nullable().optional(),
  primarySkuCode: z.string().min(1).max(50),
  bundledSkuCode: z.string().min(1).max(50),
  ratio: z.number().positive(),
  notes: z.string().max(2000).nullable().optional(),
});

export function registerMoqRuleRoutes(router: Router) {
  // ─── GET /api/moq-rules/bundling — list bundling rules for this client ───
  router.get("/api/moq-rules/bundling", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const rows = await db
        .select()
        .from(moqBundlingRules)
        .where(eq(moqBundlingRules.clientId, clientId))
        .orderBy(moqBundlingRules.primarySkuCode, moqBundlingRules.bundledSkuCode);
      res.json(rows.map((r) => ({ ...r, ratio: Number(r.ratio) })));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to list bundling rules", error: err.message });
    }
  });

  // ─── POST /api/moq-rules/bundling — create rule ───
  router.post("/api/moq-rules/bundling", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const parsed = upsertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      if (parsed.data.primarySkuCode === parsed.data.bundledSkuCode) {
        return res.status(400).json({ message: "primary and bundled SKU must differ" });
      }

      const [created] = await db
        .insert(moqBundlingRules)
        .values({
          clientId,
          manufacturerId: parsed.data.manufacturerId ?? null,
          primarySkuCode: parsed.data.primarySkuCode,
          bundledSkuCode: parsed.data.bundledSkuCode,
          ratio: parsed.data.ratio.toString(),
          notes: parsed.data.notes ?? null,
        })
        .returning();

      logAudit(req, "MOQ_BUNDLING_CREATED", {
        resourceType: "MoqBundlingRule",
        resourceId: String(created.id),
        detail: `When ordering ${created.primarySkuCode}, bundle ${created.bundledSkuCode} at ratio ${created.ratio}`,
        afterValue: created,
      });

      res.status(201).json({ ...created, ratio: Number(created.ratio) });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create bundling rule", error: err.message });
    }
  });

  // ─── PATCH /api/moq-rules/bundling/:id — update rule ───
  router.patch("/api/moq-rules/bundling/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const id = Number(req.params.id);
      const parsed = upsertSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }

      const [existing] = await db
        .select()
        .from(moqBundlingRules)
        .where(and(eq(moqBundlingRules.id, id), eq(moqBundlingRules.clientId, clientId)));
      if (!existing) return res.status(404).json({ message: "Rule not found" });

      const updates: Record<string, unknown> = {};
      if (parsed.data.manufacturerId !== undefined) updates.manufacturerId = parsed.data.manufacturerId ?? null;
      if (parsed.data.primarySkuCode !== undefined) updates.primarySkuCode = parsed.data.primarySkuCode;
      if (parsed.data.bundledSkuCode !== undefined) updates.bundledSkuCode = parsed.data.bundledSkuCode;
      if (parsed.data.ratio !== undefined) updates.ratio = parsed.data.ratio.toString();
      if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes ?? null;

      const [updated] = await db
        .update(moqBundlingRules)
        .set(updates)
        .where(and(eq(moqBundlingRules.id, id), eq(moqBundlingRules.clientId, clientId)))
        .returning();

      logAudit(req, "MOQ_BUNDLING_UPDATED", {
        resourceType: "MoqBundlingRule",
        resourceId: String(id),
        beforeValue: existing,
        afterValue: updated,
      });

      res.json({ ...updated, ratio: Number(updated.ratio) });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update bundling rule", error: err.message });
    }
  });

  // ─── DELETE /api/moq-rules/bundling/:id — delete rule ───
  router.delete("/api/moq-rules/bundling/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const id = Number(req.params.id);

      const [existing] = await db
        .select()
        .from(moqBundlingRules)
        .where(and(eq(moqBundlingRules.id, id), eq(moqBundlingRules.clientId, clientId)));
      if (!existing) return res.status(404).json({ message: "Rule not found" });

      await db
        .delete(moqBundlingRules)
        .where(and(eq(moqBundlingRules.id, id), eq(moqBundlingRules.clientId, clientId)));

      logAudit(req, "MOQ_BUNDLING_DELETED", {
        resourceType: "MoqBundlingRule",
        resourceId: String(id),
        detail: `Deleted bundling rule: ${existing.primarySkuCode} → ${existing.bundledSkuCode}`,
        beforeValue: existing,
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete bundling rule", error: err.message });
    }
  });
}
