import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "./db";
import { supplies, supplyTransactions } from "../shared/schema";
import { eq, and, desc, sum, sql } from "drizzle-orm";
import { logAudit } from "./auditLog";
import { isAuthenticated } from "./routes";
import { getClientId } from "./clientContext";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Helpers ──────────────────────────────────────────

/** Parse a leading number from a cell that may contain text notes, e.g. "23.1 (25kg sent...)" → 23.1 */
function parseLeadingNumber(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (!s) return 0;
  const match = s.match(/^[\d.]+/);
  if (!match) return 0;
  const n = parseFloat(match[0]);
  return isNaN(n) ? 0 : n;
}

/** Get the current stock (sum of transactions) for a supply */
async function getCurrentStock(clientId: number, supplyId: number): Promise<number> {
  const row = await db
    .select({ total: sum(supplyTransactions.quantity).mapWith(Number) })
    .from(supplyTransactions)
    .where(
      and(
        eq(supplyTransactions.clientId, clientId),
        eq(supplyTransactions.supplyId, supplyId),
      )
    );
  return row[0]?.total ?? 0;
}

// ─── Import Parsing ───────────────────────────────────

const RAW_MATERIALS_SKIP = [
  "RAW MATERIALS",
  "ITEM:",
  "ITEM",
  "We supply",
  "Bulk tablets/powder",
  "Bulk tablets",
  "No longer ordered",
];

const PACKAGING_SKIP = [
  "PACKAGING:",
  "PACKAGING",
  "ITEM:",
  "ITEM",
  "Ordered by us",
];

interface ParsedSupplyRow {
  name: string;
  category: "RAW_MATERIAL" | "PACKAGING";
  subcategory: string | null;
  totalStock: number;
  reorderPoint: number | null;
  supplier: string | null;
  priceDescription: string | null;
  moq: string | null;
  leadTime: string | null;
  matched: boolean;
  matchedSupplyId: number | null;
}

function parseRawMaterialsTab(sheet: XLSX.WorkSheet): ParsedSupplyRow[] {
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  const parsed: ParsedSupplyRow[] = [];
  let currentSubcategory: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    const colA = String(row[0] ?? "").trim();

    // Detect section headers for subcategory
    if (colA.toLowerCase().startsWith("we supply")) {
      currentSubcategory = "We supply";
      continue;
    }
    if (colA.toLowerCase().startsWith("bulk tablets") || colA.toLowerCase().startsWith("bulk tablets/powder")) {
      currentSubcategory = "Bulk tablets";
      continue;
    }
    if (colA.toLowerCase().startsWith("no longer ordered")) {
      currentSubcategory = "No longer ordered";
      continue;
    }

    // Skip header rows or empty
    if (!colA || RAW_MATERIALS_SKIP.some((h) => colA.toUpperCase().startsWith(h.toUpperCase()))) {
      continue;
    }

    // Row: [Item, _, Used_in, Total, Reorder_point, Ordered, THHP_SOH, Storage_SOH, Zinchar_SOH, NM_SOH, SDK_SOH, Supplier, Price, MOQ, Lead_Time]
    const name = colA;
    const totalStock = parseLeadingNumber(row[3]);
    const reorderPoint = row[4] != null && String(row[4]).trim() !== "" ? Math.round(parseLeadingNumber(row[4])) : null;
    const supplier = row[11] ? String(row[11]).trim() || null : null;
    const priceDescription = row[12] ? String(row[12]).trim() || null : null;
    const moq = row[13] ? String(row[13]).trim() || null : null;
    const leadTime = row[14] ? String(row[14]).trim() || null : null;

    parsed.push({
      name,
      category: "RAW_MATERIAL",
      subcategory: currentSubcategory,
      totalStock,
      reorderPoint,
      supplier,
      priceDescription,
      moq,
      leadTime,
      matched: false,
      matchedSupplyId: null,
    });
  }

  return parsed;
}

function parsePackagingTab(sheet: XLSX.WorkSheet): ParsedSupplyRow[] {
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  const parsed: ParsedSupplyRow[] = [];
  let currentSubcategory: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    const colA = String(row[0] ?? "").trim();
    const colB = String(row[1] ?? "").trim();

    // Col A has category headers
    if (colA) {
      // Check if it's a skip header
      if (PACKAGING_SKIP.some((h) => colA.toUpperCase().startsWith(h.toUpperCase()))) {
        continue;
      }
      // Otherwise it's a subcategory header (e.g. "Labels", "Containers", "Cases")
      currentSubcategory = colA;
    }

    // Item name is in col B
    if (!colB || PACKAGING_SKIP.some((h) => colB.toUpperCase().startsWith(h.toUpperCase()))) {
      continue;
    }

    // Row: [Category_header, Item, Total, Reorder_point, Ordered, THH_SOH, Projetech_SOH, Storage_SOH, Zinchar_SOH, Pelchem_SOH, GEP_SOH, Nutrimed_SOH, SDK_SOH, Supplier, Price, MOQ, Lead_Time]
    const name = colB;
    const totalStock = parseLeadingNumber(row[2]);
    const reorderPoint = row[3] != null && String(row[3]).trim() !== "" ? Math.round(parseLeadingNumber(row[3])) : null;
    const supplier = row[13] ? String(row[13]).trim() || null : null;
    const priceDescription = row[14] ? String(row[14]).trim() || null : null;
    const moq = row[15] ? String(row[15]).trim() || null : null;
    const leadTime = row[16] ? String(row[16]).trim() || null : null;

    parsed.push({
      name,
      category: "PACKAGING",
      subcategory: currentSubcategory,
      totalStock,
      reorderPoint,
      supplier,
      priceDescription,
      moq,
      leadTime,
      matched: false,
      matchedSupplyId: null,
    });
  }

  return parsed;
}

// ─── Route Registration ───────────────────────────────

export function registerSupplyRoutes(router: Router) {

  // ─── GET /api/supplies — list all with current stock ───
  router.get("/api/supplies", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);

      const rows = await db
        .select({
          id: supplies.id,
          clientId: supplies.clientId,
          name: supplies.name,
          category: supplies.category,
          subcategory: supplies.subcategory,
          unitOfMeasure: supplies.unitOfMeasure,
          supplier: supplies.supplier,
          supplierContact: supplies.supplierContact,
          priceDescription: supplies.priceDescription,
          moq: supplies.moq,
          leadTime: supplies.leadTime,
          reorderPoint: supplies.reorderPoint,
          isActive: supplies.isActive,
          notes: supplies.notes,
          createdAt: supplies.createdAt,
          currentStock: sql<number>`COALESCE(SUM(${supplyTransactions.quantity}), 0)`.mapWith(Number),
        })
        .from(supplies)
        .leftJoin(
          supplyTransactions,
          and(
            eq(supplyTransactions.supplyId, supplies.id),
            eq(supplyTransactions.clientId, supplies.clientId),
          )
        )
        .where(eq(supplies.clientId, clientId))
        .groupBy(supplies.id)
        .orderBy(supplies.name);

      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch supplies", error: err.message });
    }
  });

  // ─── GET /api/supplies/:id — detail + transaction history ───
  router.get("/api/supplies/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const supplyId = parseInt(req.params.id, 10);
      if (isNaN(supplyId)) {
        return res.status(400).json({ message: "Invalid supply ID" });
      }

      const [supply] = await db
        .select()
        .from(supplies)
        .where(and(eq(supplies.id, supplyId), eq(supplies.clientId, clientId)));

      if (!supply) {
        return res.status(404).json({ message: "Supply not found" });
      }

      const currentStock = await getCurrentStock(clientId, supplyId);

      const transactions = await db
        .select()
        .from(supplyTransactions)
        .where(
          and(
            eq(supplyTransactions.clientId, clientId),
            eq(supplyTransactions.supplyId, supplyId),
          )
        )
        .orderBy(desc(supplyTransactions.createdAt))
        .limit(50);

      res.json({ ...supply, currentStock, transactions });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch supply detail", error: err.message });
    }
  });

  // ─── POST /api/supplies — create new supply item ───
  router.post("/api/supplies", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const { name, category, subcategory, unitOfMeasure, supplier, supplierContact, priceDescription, moq, leadTime, reorderPoint, notes } = req.body;

      if (!name || !category) {
        return res.status(400).json({ message: "name and category are required" });
      }

      const [created] = await db
        .insert(supplies)
        .values({
          clientId,
          name,
          category,
          subcategory: subcategory || null,
          unitOfMeasure: unitOfMeasure || null,
          supplier: supplier || null,
          supplierContact: supplierContact || null,
          priceDescription: priceDescription || null,
          moq: moq || null,
          leadTime: leadTime || null,
          reorderPoint: reorderPoint != null ? Number(reorderPoint) : null,
          notes: notes || null,
        })
        .returning();

      logAudit(req, "SUPPLY_CREATED", {
        resourceType: "Supply",
        resourceId: String(created.id),
        detail: `Created supply: ${name} (${category})`,
        afterValue: created,
      });

      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create supply", error: err.message });
    }
  });

  // ─── PATCH /api/supplies/:id — update supply details ───
  router.patch("/api/supplies/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const supplyId = parseInt(req.params.id, 10);
      if (isNaN(supplyId)) {
        return res.status(400).json({ message: "Invalid supply ID" });
      }

      const [existing] = await db
        .select()
        .from(supplies)
        .where(and(eq(supplies.id, supplyId), eq(supplies.clientId, clientId)));

      if (!existing) {
        return res.status(404).json({ message: "Supply not found" });
      }

      const { name, category, subcategory, unitOfMeasure, supplier, supplierContact, priceDescription, moq, leadTime, reorderPoint, isActive, notes } = req.body;

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (category !== undefined) updates.category = category;
      if (subcategory !== undefined) updates.subcategory = subcategory || null;
      if (unitOfMeasure !== undefined) updates.unitOfMeasure = unitOfMeasure || null;
      if (supplier !== undefined) updates.supplier = supplier || null;
      if (supplierContact !== undefined) updates.supplierContact = supplierContact || null;
      if (priceDescription !== undefined) updates.priceDescription = priceDescription || null;
      if (moq !== undefined) updates.moq = moq || null;
      if (leadTime !== undefined) updates.leadTime = leadTime || null;
      if (reorderPoint !== undefined) updates.reorderPoint = reorderPoint != null ? Number(reorderPoint) : null;
      if (isActive !== undefined) updates.isActive = isActive;
      if (notes !== undefined) updates.notes = notes || null;

      const [updated] = await db
        .update(supplies)
        .set(updates)
        .where(and(eq(supplies.id, supplyId), eq(supplies.clientId, clientId)))
        .returning();

      logAudit(req, "SUPPLY_UPDATED", {
        resourceType: "Supply",
        resourceId: String(supplyId),
        detail: `Updated supply: ${updated.name}`,
        beforeValue: existing,
        afterValue: updated,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update supply", error: err.message });
    }
  });

  // ─── POST /api/supplies/:id/receive — record received stock ───
  router.post("/api/supplies/:id/receive", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const supplyId = parseInt(req.params.id, 10);
      if (isNaN(supplyId)) {
        return res.status(400).json({ message: "Invalid supply ID" });
      }

      const { quantity, reference, notes, transactionDate } = req.body;
      if (!quantity || quantity <= 0) {
        return res.status(400).json({ message: "quantity must be a positive number" });
      }

      const [supply] = await db
        .select()
        .from(supplies)
        .where(and(eq(supplies.id, supplyId), eq(supplies.clientId, clientId)));

      if (!supply) {
        return res.status(404).json({ message: "Supply not found" });
      }

      const user = req.user as any;
      const txnDate = transactionDate || new Date().toISOString().split("T")[0];

      const [txn] = await db
        .insert(supplyTransactions)
        .values({
          clientId,
          supplyId,
          transactionType: "RECEIVED",
          quantity: Math.abs(Math.round(quantity)),
          transactionDate: txnDate,
          reference: reference || null,
          notes: notes || null,
          createdBy: user?.id ?? null,
        })
        .returning();

      logAudit(req, "SUPPLY_RECEIVED", {
        resourceType: "SupplyTransaction",
        resourceId: String(txn.id),
        detail: `Received ${quantity} of ${supply.name}`,
        afterValue: txn,
      });

      res.status(201).json(txn);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to record supply receipt", error: err.message });
    }
  });

  // ─── POST /api/supplies/:id/send — sent to manufacturer ───
  router.post("/api/supplies/:id/send", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const supplyId = parseInt(req.params.id, 10);
      if (isNaN(supplyId)) {
        return res.status(400).json({ message: "Invalid supply ID" });
      }

      const { quantity, manufacturerName, relatedPoId, reference, notes } = req.body;
      if (!quantity || quantity <= 0) {
        return res.status(400).json({ message: "quantity must be a positive number" });
      }
      if (!manufacturerName) {
        return res.status(400).json({ message: "manufacturerName is required" });
      }

      const [supply] = await db
        .select()
        .from(supplies)
        .where(and(eq(supplies.id, supplyId), eq(supplies.clientId, clientId)));

      if (!supply) {
        return res.status(404).json({ message: "Supply not found" });
      }

      const user = req.user as any;
      const txnDate = new Date().toISOString().split("T")[0];

      const [txn] = await db
        .insert(supplyTransactions)
        .values({
          clientId,
          supplyId,
          transactionType: "SENT_TO_MANUFACTURER",
          quantity: -Math.abs(Math.round(quantity)),
          transactionDate: txnDate,
          manufacturerName,
          relatedPoId: relatedPoId || null,
          reference: reference || null,
          notes: notes || null,
          createdBy: user?.id ?? null,
        })
        .returning();

      logAudit(req, "SUPPLY_SENT", {
        resourceType: "SupplyTransaction",
        resourceId: String(txn.id),
        detail: `Sent ${quantity} of ${supply.name} to ${manufacturerName}`,
        afterValue: txn,
      });

      res.status(201).json(txn);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to record supply dispatch", error: err.message });
    }
  });

  // ─── POST /api/supplies/:id/adjust — stock adjustment ───
  router.post("/api/supplies/:id/adjust", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const supplyId = parseInt(req.params.id, 10);
      if (isNaN(supplyId)) {
        return res.status(400).json({ message: "Invalid supply ID" });
      }

      const { newQuantity, reason, notes } = req.body;
      if (newQuantity == null || newQuantity < 0) {
        return res.status(400).json({ message: "newQuantity must be a non-negative number" });
      }
      if (!reason) {
        return res.status(400).json({ message: "reason is required" });
      }
      if (!notes) {
        return res.status(400).json({ message: "notes are required for adjustments" });
      }

      const [supply] = await db
        .select()
        .from(supplies)
        .where(and(eq(supplies.id, supplyId), eq(supplies.clientId, clientId)));

      if (!supply) {
        return res.status(404).json({ message: "Supply not found" });
      }

      const currentStock = await getCurrentStock(clientId, supplyId);
      const delta = Math.round(newQuantity) - currentStock;

      if (delta === 0) {
        return res.json({ message: "No adjustment needed — stock already at that level", noChange: true });
      }

      const user = req.user as any;
      const txnDate = new Date().toISOString().split("T")[0];

      const [txn] = await db
        .insert(supplyTransactions)
        .values({
          clientId,
          supplyId,
          transactionType: "ADJUSTMENT",
          quantity: delta,
          transactionDate: txnDate,
          reference: `Adjustment: ${currentStock} → ${Math.round(newQuantity)}`,
          notes: `[${reason}] ${notes}`,
          createdBy: user?.id ?? null,
        })
        .returning();

      logAudit(req, "SUPPLY_ADJUSTMENT", {
        resourceType: "SupplyTransaction",
        resourceId: String(txn.id),
        detail: `${reason}: ${supply.name} adjusted from ${currentStock} to ${Math.round(newQuantity)} (${delta > 0 ? "+" : ""}${delta}). ${notes}`,
        beforeValue: { currentStock },
        afterValue: { newQuantity: Math.round(newQuantity), delta },
      });

      res.json(txn);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create supply adjustment", error: err.message });
    }
  });

  // ─── POST /api/supplies/import/preview — parse xlsx file ───
  router.post(
    "/api/supplies/import/preview",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const clientId = getClientId(req);
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });

        // Load existing supplies for matching
        const existingSupplies = await db
          .select()
          .from(supplies)
          .where(eq(supplies.clientId, clientId));

        const nameMap = new Map(
          existingSupplies.map((s) => [s.name.toLowerCase().trim(), s])
        );

        let parsed: ParsedSupplyRow[] = [];

        // Parse RAW MATERIALS tab
        const rawSheet = workbook.Sheets["RAW MATERIALS"] ?? workbook.Sheets["Raw Materials"];
        if (rawSheet) {
          parsed = parsed.concat(parseRawMaterialsTab(rawSheet));
        }

        // Parse PACKAGING tab
        const packagingSheet = workbook.Sheets["PACKAGING"] ?? workbook.Sheets["Packaging"];
        if (packagingSheet) {
          parsed = parsed.concat(parsePackagingTab(packagingSheet));
        }

        if (parsed.length === 0) {
          return res.status(400).json({
            message: "No supply items found. Ensure the file has RAW MATERIALS and/or PACKAGING tabs.",
          });
        }

        // Match against existing supplies
        for (const row of parsed) {
          const existing = nameMap.get(row.name.toLowerCase().trim());
          if (existing) {
            row.matched = true;
            row.matchedSupplyId = existing.id;
          }
        }

        res.json({
          totalRows: parsed.length,
          matched: parsed.filter((r) => r.matched).length,
          unmatched: parsed.filter((r) => !r.matched).length,
          rows: parsed,
        });
      } catch (err: any) {
        res.status(500).json({ message: "Failed to parse import file", error: err.message });
      }
    }
  );

  // ─── POST /api/supplies/import/commit — import supply items ───
  router.post("/api/supplies/import/commit", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const user = req.user as any;
      const { items } = req.body as { items: ParsedSupplyRow[] };

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "items array is required" });
      }

      const txnDate = new Date().toISOString().split("T")[0];
      const created: any[] = [];
      const updated: any[] = [];

      for (const item of items) {
        if (item.matched && item.matchedSupplyId) {
          // Update existing supply
          const [upd] = await db
            .update(supplies)
            .set({
              subcategory: item.subcategory || undefined,
              supplier: item.supplier || undefined,
              priceDescription: item.priceDescription || undefined,
              moq: item.moq || undefined,
              leadTime: item.leadTime || undefined,
              reorderPoint: item.reorderPoint ?? undefined,
            })
            .where(and(eq(supplies.id, item.matchedSupplyId), eq(supplies.clientId, clientId)))
            .returning();

          // Create opening balance transaction if stock > 0
          if (item.totalStock > 0) {
            await db.insert(supplyTransactions).values({
              clientId,
              supplyId: item.matchedSupplyId,
              transactionType: "ADJUSTMENT",
              quantity: Math.round(item.totalStock),
              transactionDate: txnDate,
              reference: "Import: opening balance",
              notes: "Imported from Animal Farm spreadsheet",
              createdBy: user?.id ?? null,
            });
          }

          updated.push(upd);
        } else {
          // Create new supply
          const [newSupply] = await db
            .insert(supplies)
            .values({
              clientId,
              name: item.name,
              category: item.category,
              subcategory: item.subcategory || null,
              supplier: item.supplier || null,
              priceDescription: item.priceDescription || null,
              moq: item.moq || null,
              leadTime: item.leadTime || null,
              reorderPoint: item.reorderPoint ?? null,
            })
            .returning();

          // Create opening balance transaction if stock > 0
          if (item.totalStock > 0) {
            await db.insert(supplyTransactions).values({
              clientId,
              supplyId: newSupply.id,
              transactionType: "RECEIVED",
              quantity: Math.round(item.totalStock),
              transactionDate: txnDate,
              reference: "Import: opening balance",
              notes: "Imported from Animal Farm spreadsheet",
              createdBy: user?.id ?? null,
            });
          }

          created.push(newSupply);
        }
      }

      logAudit(req, "SUPPLIES_IMPORTED", {
        resourceType: "Supply",
        detail: `Imported ${created.length} new supplies, updated ${updated.length} existing`,
        afterValue: { created: created.length, updated: updated.length },
      });

      res.json({
        created: created.length,
        updated: updated.length,
        total: created.length + updated.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to commit supply import", error: err.message });
    }
  });
}
