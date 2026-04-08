import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";
import { db } from "./db";
import {
  products,
  stockTransactions,
  pnpOrders,
  pnpOrderLines,
  pnpProductMappings,
  notifications,
  batches,
} from "../shared/schema";
import { eq, and, desc, asc, sql, sum } from "drizzle-orm";
import { logAudit } from "./auditLog";
import { isAuthenticated } from "./routes";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// PnP DC reference data
const PNP_DCS: Record<string, string> = {
  MA15: "PnP Eastport Inland DC (Gauteng)",
  MA05: "Philippi DC Groceries (Western Cape)",
  KC37: "Cornubia (KwaZulu-Natal)",
  KC19: "Hyper Midlands Mall (KwaZulu-Natal)",
  EF05: "Family Queenstown (Eastern Cape)",
};

const DC_CODES = Object.keys(PNP_DCS);

export function registerPnpRoutes(router: Router) {
  // ─── Upload & parse PnP order file ───
  router.post(
    "/api/pnp/upload",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const weekEndingDate = req.body.weekEndingDate;
        const appointmentTime = req.body.appointmentTime;
        if (!weekEndingDate) {
          return res.status(400).json({ message: "weekEndingDate is required" });
        }

        // Parse file — support xlsx/xls/csv
        let workbook: XLSX.WorkBook;
        const fileName = req.file.originalname?.toLowerCase() ?? "";
        if (fileName.endsWith(".csv")) {
          const csvText = req.file.buffer.toString("utf-8");
          workbook = XLSX.read(csvText, { type: "string" });
        } else {
          workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<any>(sheet);

        // Load PnP product mappings
        const mappings = await db.select().from(pnpProductMappings);
        const mappingByName = new Map(mappings.map((m) => [m.pnpProductName.toLowerCase(), m.skuCode]));

        // Load all active products for substring fallback
        const allProducts = await db.select().from(products).where(eq(products.isActive, true));

        interface ParsedLine {
          pnpProductName: string;
          skuCode: string | null;
          matched: boolean;
          dcQuantities: Record<string, number>;
        }

        const lines: ParsedLine[] = [];

        for (const row of rawRows) {
          // Try common column names for the product name
          const productName = String(
            row["Product"] ?? row["Product Name"] ?? row["Description"] ?? row["Item"] ?? row["product"] ?? ""
          ).trim();
          if (!productName) continue;

          // Parse DC quantities from columns
          const dcQuantities: Record<string, number> = {};
          let hasAnyQty = false;
          for (const dc of DC_CODES) {
            // Try exact column name, or column containing the DC code
            let qty = 0;
            if (row[dc] !== undefined) {
              qty = Math.max(0, Math.round(Number(row[dc]) || 0));
            } else {
              // Search for a column that contains the DC code
              for (const colKey of Object.keys(row)) {
                if (colKey.toUpperCase().includes(dc)) {
                  qty = Math.max(0, Math.round(Number(row[colKey]) || 0));
                  break;
                }
              }
            }
            dcQuantities[dc] = qty;
            if (qty > 0) hasAnyQty = true;
          }

          if (!hasAnyQty) continue;

          // Try to match product name to SKU
          let skuCode: string | null = null;
          let matched = false;

          // 1. Exact mapping match
          const exactMatch = mappingByName.get(productName.toLowerCase());
          if (exactMatch) {
            skuCode = exactMatch;
            matched = true;
          }

          // 2. Substring match against mappings
          if (!matched) {
            for (const [mapName, mapSku] of mappingByName.entries()) {
              if (productName.toLowerCase().includes(mapName) || mapName.includes(productName.toLowerCase())) {
                skuCode = mapSku;
                matched = true;
                break;
              }
            }
          }

          // 3. Substring match against product names
          if (!matched) {
            for (const prod of allProducts) {
              const pName = prod.productName.toLowerCase();
              const searchName = productName.toLowerCase();
              if (pName.includes(searchName) || searchName.includes(pName)) {
                skuCode = prod.skuCode;
                matched = true;
                break;
              }
            }
          }

          lines.push({
            pnpProductName: productName,
            skuCode,
            matched,
            dcQuantities,
          });
        }

        res.json({
          weekEndingDate,
          appointmentTime: appointmentTime || null,
          fileName: req.file.originalname,
          lines,
        });
      } catch (err: any) {
        console.error("PnP upload parse error:", err);
        res.status(500).json({ message: "Failed to parse file", error: err.message });
      }
    }
  );

  // ─── Create PnP order from confirmed data ───
  const createSchema = z.object({
    weekEndingDate: z.string(),
    appointmentTime: z.string().optional().nullable(),
    fileName: z.string().optional(),
    lines: z.array(
      z.object({
        skuCode: z.string(),
        dcCode: z.string(),
        dcName: z.string(),
        orderedCases: z.number().min(0),
        orderedUnits: z.number().min(0),
      })
    ),
  });

  router.post("/api/pnp/create", isAuthenticated, async (req, res) => {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }

      const { weekEndingDate, appointmentTime, fileName, lines } = parsed.data;
      const userId = (req.user as any)?.id;

      // Create the order
      const [order] = await db
        .insert(pnpOrders)
        .values({
          weekEndingDate,
          appointmentTime: appointmentTime ? new Date(appointmentTime) : null,
          uploadedFileName: fileName ?? null,
          status: "CONFIRMED",
          createdBy: userId,
        })
        .returning();

      // Load products for stock check
      const allProducts = await db.select().from(products).where(eq(products.isActive, true));
      const productMap = new Map(allProducts.map((p) => [p.skuCode, p]));

      // Get current 8/8 stock for all relevant SKUs
      const skuCodes = [...new Set(lines.map((l) => l.skuCode))];
      const stockBySkuResult = await db
        .select({
          skuCode: stockTransactions.skuCode,
          totalQty: sum(stockTransactions.quantity),
        })
        .from(stockTransactions)
        .where(
          and(
            eq(stockTransactions.stockLocation, "88"),
            sql`${stockTransactions.skuCode} = ANY(${skuCodes})`
          )
        )
        .groupBy(stockTransactions.skuCode);

      const stockBySku = new Map(stockBySkuResult.map((r) => [r.skuCode, Number(r.totalQty) || 0]));

      // Track total ordered per SKU across all DCs for shortfall calc
      const totalOrderedBySku = new Map<string, number>();
      for (const line of lines) {
        const current = totalOrderedBySku.get(line.skuCode) || 0;
        totalOrderedBySku.set(line.skuCode, current + line.orderedUnits);
      }

      // Create order lines with stock check
      const createdLines = [];
      for (const line of lines) {
        if (line.orderedCases === 0 && line.orderedUnits === 0) continue;

        const available = stockBySku.get(line.skuCode) ?? 0;
        const product = productMap.get(line.skuCode);
        const unitsPerCase = product?.unitsPerCase ?? 1;
        const availableCases = Math.floor(available / unitsPerCase);

        // Total ordered across all DCs for this SKU
        const totalOrdered = totalOrderedBySku.get(line.skuCode) ?? 0;
        const totalOrderedCases = Math.ceil(totalOrdered / unitsPerCase);
        const shortfallCases = Math.max(0, totalOrderedCases - availableCases);

        // Per-line shortfall proportional (simplified: just flag if overall shortfall)
        const lineShortfall = shortfallCases > 0 ? Math.max(0, line.orderedCases - availableCases) : 0;

        const [created] = await db
          .insert(pnpOrderLines)
          .values({
            pnpOrderId: order.id,
            skuCode: line.skuCode,
            dcCode: line.dcCode,
            dcName: line.dcName,
            orderedCases: line.orderedCases,
            orderedUnits: line.orderedUnits,
            availableCases: availableCases,
            shortfallCases: lineShortfall,
          })
          .returning();

        createdLines.push(created);
      }

      logAudit(req, "PNP_ORDER_CREATE", {
        resourceType: "PnpOrder",
        resourceId: String(order.id),
        detail: `Created PnP order for week ending ${weekEndingDate} with ${createdLines.length} lines`,
      });

      res.json({
        order,
        lines: createdLines,
        stockCheck: Object.fromEntries(
          skuCodes.map((sku) => [
            sku,
            {
              availableUnits: stockBySku.get(sku) ?? 0,
              availableCases: Math.floor((stockBySku.get(sku) ?? 0) / (productMap.get(sku)?.unitsPerCase ?? 1)),
            },
          ])
        ),
      });
    } catch (err: any) {
      console.error("PnP order create error:", err);
      res.status(500).json({ message: "Failed to create order", error: err.message });
    }
  });

  // ─── List all PnP orders ───
  router.get("/api/pnp/orders", isAuthenticated, async (_req, res) => {
    try {
      const orderList = await db
        .select()
        .from(pnpOrders)
        .orderBy(desc(pnpOrders.createdAt));

      res.json(orderList);
    } catch (err: any) {
      console.error("PnP orders list error:", err);
      res.status(500).json({ message: "Failed to list orders", error: err.message });
    }
  });

  // ─── Get PnP order with lines, grouped by DC ───
  router.get("/api/pnp/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const [order] = await db
        .select()
        .from(pnpOrders)
        .where(eq(pnpOrders.id, orderId));

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const lines = await db
        .select()
        .from(pnpOrderLines)
        .where(eq(pnpOrderLines.pnpOrderId, orderId));

      // Group by DC
      const byDc: Record<string, typeof lines> = {};
      for (const line of lines) {
        if (!byDc[line.dcCode]) byDc[line.dcCode] = [];
        byDc[line.dcCode].push(line);
      }

      res.json({ order, lines, byDc });
    } catch (err: any) {
      console.error("PnP order detail error:", err);
      res.status(500).json({ message: "Failed to get order", error: err.message });
    }
  });

  // ─── Generate dispatch instruction email content ───
  router.get("/api/pnp/orders/:id/dispatch-instruction", isAuthenticated, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const [order] = await db
        .select()
        .from(pnpOrders)
        .where(eq(pnpOrders.id, orderId));

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const lines = await db
        .select()
        .from(pnpOrderLines)
        .where(eq(pnpOrderLines.pnpOrderId, orderId));

      // Load product names
      const allProducts = await db.select().from(products).where(eq(products.isActive, true));
      const productMap = new Map(allProducts.map((p) => [p.skuCode, p.productName]));

      // Format appointment time
      const apptTime = order.appointmentTime
        ? new Date(order.appointmentTime).toLocaleString("en-ZA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBC";

      const weekDate = order.weekEndingDate;

      // Subject line
      const subject = `PnP Dispatch Instruction — Week of ${weekDate} — Appt ${apptTime}`;

      // Group lines by DC
      const byDc: Record<string, typeof lines> = {};
      for (const line of lines) {
        if (!byDc[line.dcCode]) byDc[line.dcCode] = [];
        byDc[line.dcCode].push(line);
      }

      // Build email body
      let body = "";

      // Section 1: Appointment
      body += "APPOINTMENT\n";
      body += "═══════════\n";
      body += `Date/Time: ${apptTime}\n\n`;

      // Section 2: Order by DC
      body += "ORDER BY DISTRIBUTION CENTRE\n";
      body += "════════════════════════════\n\n";

      for (const dcCode of DC_CODES) {
        const dcLines = byDc[dcCode];
        if (!dcLines || dcLines.length === 0) continue;

        body += `${dcCode} — ${PNP_DCS[dcCode]}\n`;
        body += "─".repeat(50) + "\n";
        body += "Product".padEnd(35) + "Cases".padStart(8) + "Units".padStart(8) + "\n";
        body += "─".repeat(50) + "\n";

        for (const line of dcLines) {
          const name = (productMap.get(line.skuCode) ?? line.skuCode).substring(0, 34);
          body += name.padEnd(35) + String(line.orderedCases).padStart(8) + String(line.orderedUnits).padStart(8) + "\n";
        }
        body += "\n";
      }

      // Section 3: Invoice reference placeholder
      body += "INVOICE REFERENCE\n";
      body += "═════════════════\n";
      body += "Xero Invoice: [TO BE ADDED]\n\n";

      // Section 4: Totals per product across DCs
      body += "PRODUCT TOTALS (ALL DCs)\n";
      body += "════════════════════════\n";
      body += "Product".padEnd(35) + "Cases".padStart(8) + "Units".padStart(8) + "\n";
      body += "─".repeat(50) + "\n";

      const totalsBySku = new Map<string, { cases: number; units: number }>();
      for (const line of lines) {
        const existing = totalsBySku.get(line.skuCode) ?? { cases: 0, units: 0 };
        existing.cases += line.orderedCases;
        existing.units += line.orderedUnits;
        totalsBySku.set(line.skuCode, existing);
      }

      for (const [sku, totals] of totalsBySku.entries()) {
        const name = (productMap.get(sku) ?? sku).substring(0, 34);
        body += name.padEnd(35) + String(totals.cases).padStart(8) + String(totals.units).padStart(8) + "\n";
      }
      body += "\n";

      // Section 5: Notes/shortfalls
      const shortfallLines = lines.filter((l) => (l.shortfallCases ?? 0) > 0);
      body += "NOTES / SHORTFALLS\n";
      body += "══════════════════\n";
      if (shortfallLines.length > 0) {
        for (const line of shortfallLines) {
          const name = productMap.get(line.skuCode) ?? line.skuCode;
          body += `⚠ ${name} at ${line.dcCode}: ordered ${line.orderedCases} cases, shortfall ${line.shortfallCases} cases\n`;
        }
      } else {
        body += "No shortfalls identified. All stock available at 8/8.\n";
      }
      body += "\n";

      // Sign-off
      body += "Kind regards,\n";
      body += "Beryl Shuttleworth\n";
      body += "The Herbal Horse & Pet\n";

      res.json({ subject, body, order });
    } catch (err: any) {
      console.error("PnP dispatch instruction error:", err);
      res.status(500).json({ message: "Failed to generate dispatch instruction", error: err.message });
    }
  });

  // ─── Mark as dispatched ───
  router.post("/api/pnp/orders/:id/dispatch", isAuthenticated, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const [order] = await db
        .select()
        .from(pnpOrders)
        .where(eq(pnpOrders.id, orderId));

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.status === "DISPATCHED") {
        return res.status(400).json({ message: "Order already dispatched" });
      }

      const lines = await db
        .select()
        .from(pnpOrderLines)
        .where(eq(pnpOrderLines.pnpOrderId, orderId));

      const userId = (req.user as any)?.id;
      const transactionDate = new Date().toISOString().split("T")[0];
      const now = new Date();
      const periodMonth = now.getMonth() + 1;
      const periodYear = now.getFullYear();

      // Create PNP_OUT stock transactions for each line
      for (const line of lines) {
        if (line.orderedUnits === 0) continue;

        // Find oldest active batch at 8/8 for FIFO
        const activeBatches = await db
          .select()
          .from(batches)
          .where(
            and(
              eq(batches.skuCode, line.skuCode),
              eq(batches.stockLocation, "88"),
              eq(batches.isActive, true)
            )
          )
          .orderBy(asc(batches.manufactureDate));

        const batchId = activeBatches[0]?.id ?? null;

        await db.insert(stockTransactions).values({
          batchId,
          skuCode: line.skuCode,
          stockLocation: "88",
          transactionType: "PNP_OUT",
          quantity: -line.orderedUnits, // Negative for OUT
          transactionDate,
          periodMonth,
          periodYear,
          reference: `PnP order #${orderId} — ${line.dcCode}`,
          channel: "C",
          createdBy: userId,
        });
      }

      // Update order status
      await db
        .update(pnpOrders)
        .set({
          status: "DISPATCHED",
          dispatchInstructionSentAt: now,
        })
        .where(eq(pnpOrders.id, orderId));

      // Check if any 8/8 products now below reorder point and create notifications
      const allProducts = await db.select().from(products).where(eq(products.isActive, true));
      const productMap = new Map(allProducts.map((p) => [p.skuCode, p]));
      const affectedSkus = [...new Set(lines.map((l) => l.skuCode))];
      const lowStockAlerts: string[] = [];

      for (const sku of affectedSkus) {
        const product = productMap.get(sku);
        if (!product) continue;

        // Get current 8/8 stock
        const [stockResult] = await db
          .select({ totalQty: sum(stockTransactions.quantity) })
          .from(stockTransactions)
          .where(
            and(
              eq(stockTransactions.skuCode, sku),
              eq(stockTransactions.stockLocation, "88")
            )
          );

        const currentStock = Number(stockResult?.totalQty) || 0;
        const reorderPoint = product.reorderPointOverride ?? 0;

        if (currentStock <= reorderPoint && reorderPoint > 0) {
          lowStockAlerts.push(sku);

          await db.insert(notifications).values({
            type: "LOW_STOCK_88",
            title: `Low 8/8 stock: ${product.productName}`,
            message: `After PnP dispatch, ${product.productName} (${sku}) is at ${currentStock} units at 8/8, below reorder point of ${reorderPoint}.`,
            resourceType: "Product",
            resourceId: sku,
          });
        }
      }

      logAudit(req, "PNP_DISPATCH", {
        resourceType: "PnpOrder",
        resourceId: String(orderId),
        detail: `Dispatched PnP order #${orderId} — ${lines.length} lines, ${lowStockAlerts.length} low stock alerts`,
      });

      res.json({
        success: true,
        orderId,
        transactionsCreated: lines.filter((l) => l.orderedUnits > 0).length,
        lowStockAlerts,
      });
    } catch (err: any) {
      console.error("PnP dispatch error:", err);
      res.status(500).json({ message: "Failed to dispatch order", error: err.message });
    }
  });

  return router;
}
