import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";
import { db } from "./db";
import { products, stockTransactions, apBrandMappings, batches } from "../shared/schema";
import { eq, and, asc, desc, sql, like } from "drizzle-orm";
import { logAudit } from "./auditLog";
import { isAuthenticated, isAdmin } from "./routes";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Channel code lookup
const CHANNELS: Record<string, { name: string; debitLocation: string | null }> = {
  D: { name: "Direct", debitLocation: "THH" },
  W: { name: "Wholesale", debitLocation: "THH" },
  R: { name: "Retail", debitLocation: "THH" },
  C: { name: "PnP / 8/8", debitLocation: null }, // No THH debit
  G: { name: "AP-Branded", debitLocation: "THH" },
};

interface ParsedRow {
  rawItemCode: string;
  baseSku: string;
  channel: string;
  channelName: string;
  productName: string;
  quantity: number;
  mapped: boolean;
  skippedReason?: string;
}

export function registerXeroRoutes(router: Router) {
  // ─── Preview import (parse file, don't commit) ───
  router.post(
    "/api/xero/import/preview",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const fromDate = req.body.fromDate;
        const toDate = req.body.toDate;
        if (!fromDate || !toDate) {
          return res.status(400).json({ message: "fromDate and toDate are required" });
        }

        // Parse Excel
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<any>(sheet);

        // Load product lookup
        const allProducts = await db.select().from(products).where(eq(products.isActive, true));
        const productMap = new Map(allProducts.map((p) => [p.skuCode, p]));

        // Load AP brand mappings
        const apMappings = await db.select().from(apBrandMappings);
        const apMap = new Map(apMappings.map((m) => [m.apProductCode, m.thhSkuCode]));

        const parsed: ParsedRow[] = [];

        for (const row of rawRows) {
          // Try common column names for item code
          const rawItemCode = String(
            row["Item Code"] ?? row["ItemCode"] ?? row["item_code"] ?? row["Code"] ?? ""
          ).trim();
          if (!rawItemCode) continue;

          const quantity = Math.abs(
            Number(row["Quantity"] ?? row["quantity"] ?? row["Qty"] ?? 0)
          );
          if (quantity === 0) continue;

          const rawName = String(
            row["Item Name"] ?? row["Description"] ?? row["item_name"] ?? ""
          ).trim();

          // Strip channel suffix (last character)
          const channelCode = rawItemCode.slice(-1).toUpperCase();
          let baseSku = rawItemCode.slice(0, -1);
          const channelInfo = CHANNELS[channelCode];

          if (!channelInfo) {
            // Last char is not a valid channel — treat whole string as SKU
            parsed.push({
              rawItemCode,
              baseSku: rawItemCode,
              channel: "?",
              channelName: "Unknown Channel",
              productName: rawName,
              quantity,
              mapped: false,
              skippedReason: `Unknown channel suffix: ${channelCode}`,
            });
            continue;
          }

          // AP brand mapping: check if baseSku is an AP code
          const apMapping = apMap.get(baseSku);
          let effectiveChannel = channelCode;
          if (apMapping) {
            baseSku = apMapping;
            effectiveChannel = "G";
          }

          // Check if product exists
          const product = productMap.get(baseSku);

          if (!product) {
            parsed.push({
              rawItemCode,
              baseSku,
              channel: effectiveChannel,
              channelName: channelInfo.name,
              productName: rawName,
              quantity,
              mapped: false,
              skippedReason: `SKU "${baseSku}" not found in product master`,
            });
            continue;
          }

          // Channel C = PnP, skip THH debit
          if (effectiveChannel === "C") {
            parsed.push({
              rawItemCode,
              baseSku,
              channel: "C",
              channelName: "PnP / 8/8",
              productName: product.productName,
              quantity,
              mapped: true,
              skippedReason: "PnP channel — no THH stock debit",
            });
            continue;
          }

          parsed.push({
            rawItemCode,
            baseSku,
            channel: effectiveChannel,
            channelName: CHANNELS[effectiveChannel]?.name ?? effectiveChannel,
            productName: product.productName,
            quantity,
            mapped: true,
          });
        }

        res.json({
          fromDate,
          toDate,
          totalRows: rawRows.length,
          parsed,
        });
      } catch (err: any) {
        console.error("Xero import preview error:", err);
        res.status(500).json({ message: "Failed to parse file", error: err.message });
      }
    }
  );

  // ─── Commit import (create stock transactions) ───
  const commitSchema = z.object({
    fromDate: z.string(),
    toDate: z.string(),
    force: z.boolean().optional(),
    rows: z.array(
      z.object({
        baseSku: z.string(),
        channel: z.string(),
        quantity: z.number().positive(),
        invoiceNumber: z.string().optional(),
      })
    ),
  });

  router.post("/api/xero/import/commit", isAdmin, async (req, res) => {
    try {
      const parsed = commitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }

      const { fromDate, toDate, rows } = parsed.data;
      const userId = (req.user as any)?.id;
      const reference = `Xero import ${fromDate} to ${toDate}`;

      // Check for existing import with same period
      const existing = await db
        .select()
        .from(stockTransactions)
        .where(
          and(
            eq(stockTransactions.transactionType, "SALES_OUT"),
            eq(stockTransactions.reference, reference)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Allow re-import only if explicitly confirmed via force flag
        if (!req.body.force) {
          return res.status(409).json({
            message: `This period has already been imported (${fromDate} to ${toDate}).`,
            alreadyImported: true,
          });
        }
        // Delete existing transactions for this period before re-importing
        await db
          .delete(stockTransactions)
          .where(
            and(
              eq(stockTransactions.transactionType, "SALES_OUT"),
              eq(stockTransactions.reference, reference)
            )
          );
      }

      // Get the period month/year from the toDate
      const toDateObj = new Date(toDate);
      const periodMonth = toDateObj.getMonth() + 1;
      const periodYear = toDateObj.getFullYear();

      let created = 0;

      for (const row of rows) {
        // Skip PnP channel
        if (row.channel === "C") continue;

        // Determine debit location
        const debitLocation = CHANNELS[row.channel]?.debitLocation ?? "THH";

        // FIFO batch allocation
        const activeBatches = await db
          .select()
          .from(batches)
          .where(
            and(
              eq(batches.skuCode, row.baseSku),
              eq(batches.stockLocation, debitLocation),
              eq(batches.isActive, true)
            )
          )
          .orderBy(asc(batches.manufactureDate));

        let remainingQty = row.quantity;
        let batchId: number | null = activeBatches[0]?.id ?? null;

        // Create the SALES_OUT transaction
        // Use invoice number as reference for traceability, with import period as fallback
        const txReference = row.invoiceNumber
          ? `${row.invoiceNumber} (${reference})`
          : reference;

        await db.insert(stockTransactions).values({
          batchId,
          skuCode: row.baseSku,
          stockLocation: debitLocation,
          transactionType: "SALES_OUT",
          quantity: -row.quantity, // Negative for OUT
          transactionDate: toDate,
          periodMonth,
          periodYear,
          reference: txReference,
          channel: row.channel,
          createdBy: userId,
        });

        created++;
      }

      logAudit(req, "XERO_IMPORT", {
        resourceType: "StockTransaction",
        detail: `Imported ${created} transactions from Xero Sales by Item (${fromDate} to ${toDate})`,
      });

      res.json({ created, fromDate, toDate });
    } catch (err: any) {
      console.error("Xero import commit error:", err);
      res.status(500).json({ message: "Failed to commit import", error: err.message });
    }
  });

  // ─── Import History ───────────────────────────────
  router.get("/api/xero/import/history", isAuthenticated, async (_req, res) => {
    try {
      // Find all distinct Xero import references
      const imports = await db
        .select({
          reference: stockTransactions.reference,
          transactionCount: sql<number>`count(*)`.as("transaction_count"),
          totalUnits: sql<number>`sum(abs(${stockTransactions.quantity}))`.as("total_units"),
          importedAt: sql<string>`min(${stockTransactions.createdAt})`.as("imported_at"),
        })
        .from(stockTransactions)
        .where(
          and(
            eq(stockTransactions.transactionType, "SALES_OUT"),
            like(stockTransactions.reference, "Xero import %")
          )
        )
        .groupBy(stockTransactions.reference)
        .orderBy(desc(sql`min(${stockTransactions.createdAt})`));

      // For each import, parse the date range from the reference string
      const history = imports.map((imp) => {
        const match = imp.reference?.match(/Xero import (\S+) to (\S+)/);
        return {
          reference: imp.reference,
          fromDate: match?.[1] ?? null,
          toDate: match?.[2] ?? null,
          transactionCount: Number(imp.transactionCount),
          totalUnits: Number(imp.totalUnits),
          importedAt: imp.importedAt,
        };
      });

      res.json(history);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch import history", error: err.message });
    }
  });

  return router;
}
