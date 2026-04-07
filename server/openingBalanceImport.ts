import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "./db";
import { products, stockTransactions, batches } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAudit } from "./auditLog";
import { isAuthenticated, isAdmin } from "./routes";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Map Animal Farm sheet codes to our system SKU codes
const SKU_MAP: Record<string, string> = {
  // Horse mixes — direct match with size suffix
  CM500: "CM500",
  CM2000: "CM2000",
  DM500: "DM500",
  DM2000: "DM2000",
  SM500: "SM500",
  SM2000: "SM2000",
  FM500: "FM500",
  FM2000: "FM2000",
  IM500: "IM500",
  IM2000: "IM2000",
  ItM500: "ItM500",
  ItM2000: "ItM500", // sheet has ItM2000 but our system may not — map to closest
  MM250: "MM250",
  MM2000: "MM250", // MM only has 250g in our system
  RM500: "RM500",
  RM2000: "RM2000",
  UM500: "UM500",
  UM2000: "UM2000",
  SHM500: "SHM500",

  // Pet formulas — sheet uses AF200, we use AF200G
  AF200: "AF200G",
  AF500: "AF500G",
  EF200: "EF200G",
  EF500: "EF200G", // EF only has 200g in our system
  JF200: "JF200G",
  JF500: "JF500G",
  "HP O3F75": "O3F75G",
  PCF240: "PCF240G",
  PCF500: "PCF500G",
  SF200: "SF200G",
  SF500: "SF200G", // SF only has 40g and 200g; map 500 to 200 as closest
  SF40: "SF40G",

  // Chews — sheet uses HP prefix, we don't
  HPACC30: "ACC30",
  HPCC30: "CCH30",
  HPCCH150: "CCH150",
  HPJCC30: "JCC30",
  HPTFC30: "TFC30",
  HPTFC150: "TFC150",

  // Spray and other — sheet uses HP prefix
  HPNTFS200: "NTFS200",
  HPCG120: "CG120",
  HPCG90: "CG90",
  NS250: "NS250",

  // Nutriphase — direct match
  NPACC30: "NPACC30",
  NPCC30: "NPCC30",
  NPJCC30: "NPJCC30",
  NPTFC30: "NPTFC30",
  NPTFS200: "NPTFS200",
};

interface ParsedStockRow {
  sheetCode: string;
  productName: string;
  size: string;
  skuCode: string | null;
  totalStock: number;
  thhStock: number;
  eightEightStock: number;
  reorderPoint: number | null;
  matched: boolean;
  matchIssue?: string;
}

function parseRowData(data: any[][]): ParsedStockRow[] {
  const rows: ParsedStockRow[] = [];

  // Log first few rows for debugging
  for (let d = 0; d < Math.min(5, data.length); d++) {
    console.log(`Row ${d}:`, JSON.stringify(data[d]?.slice(0, 12)));
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as any[];
    if (!row || row.length < 2) continue;
    const code = String(row[1] ?? "").trim();
    if (!code || code === "Code" || code === "") continue;

    // Parse numbers — handle strings, empty strings, and actual numbers
    const parseNum = (val: any): number => {
      if (val === null || val === undefined || val === "") return 0;
      const n = Number(val);
      return isNaN(n) ? 0 : Math.round(n);
    };

    const totalStock = parseNum(row[3]);
    const reorderPointRaw = Number(row[4]);
    const eightEightStock = parseNum(row[6]);
    const thhStock = parseNum(row[8]);

    // Don't skip zero-stock rows — show them all so user can see the full picture
    // Only skip header-like rows

    const skuCode = SKU_MAP[code] ?? null;

    rows.push({
      sheetCode: code,
      productName: String(row[0] ?? "").trim(),
      size: String(row[2] ?? "").trim(),
      skuCode,
      totalStock,
      thhStock,
      eightEightStock,
      reorderPoint: isNaN(reorderPointRaw) || reorderPointRaw === 0 ? null : Math.round(reorderPointRaw),
      matched: !!skuCode,
      matchIssue: skuCode ? undefined : `No SKU mapping for code "${code}"`,
    });
  }

  return rows;
}

function parseSummarySheet(buffer: Buffer): ParsedStockRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const summary = wb.Sheets["Summary master"];
  if (!summary) throw new Error("Sheet 'Summary master' not found in the workbook.");
  const data = XLSX.utils.sheet_to_json<any[]>(summary, { header: 1, defval: "" });
  return parseRowData(data);
}

export function registerOpeningBalanceRoutes(router: Router) {
  // ─── Preview: parse Animal Farm file ─────────────
  router.post(
    "/api/stock-in/opening-balance/preview",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const parsed = parseSummarySheet(req.file.buffer);

        // Also check against our product master
        const allProducts = await db.select().from(products).where(eq(products.isActive, true));
        const productMap = new Map(allProducts.map((p) => [p.skuCode, p]));

        const enriched = parsed.map((row) => {
          if (row.skuCode && !productMap.has(row.skuCode)) {
            return {
              ...row,
              matched: false,
              matchIssue: `SKU "${row.skuCode}" mapped but not found in product master`,
            };
          }
          return row;
        });

        const matchedCount = enriched.filter((r) => r.matched).length;
        const unmatchedCount = enriched.filter((r) => !r.matched).length;
        const totalThhUnits = enriched.filter((r) => r.matched).reduce((s, r) => s + r.thhStock, 0);
        const totalEeUnits = enriched.filter((r) => r.matched).reduce((s, r) => s + r.eightEightStock, 0);

        res.json({
          rows: enriched,
          summary: {
            matchedCount,
            unmatchedCount,
            totalThhUnits,
            totalEeUnits,
            totalRows: enriched.length,
          },
        });
      } catch (err: any) {
        console.error("Opening balance preview error:", err);
        res.status(500).json({ message: "Failed to parse file", error: err.message });
      }
    }
  );

  // ─── Commit: create opening balance transactions ─
  router.post("/api/stock-in/opening-balance/commit", isAdmin, async (req, res) => {
    try {
      const { rows, asOfDate } = req.body;
      if (!rows || !Array.isArray(rows) || !asOfDate) {
        return res.status(400).json({ message: "rows and asOfDate are required" });
      }

      const userId = (req.user as any)?.id;
      const dateObj = new Date(asOfDate);
      const periodMonth = dateObj.getMonth() + 1;
      const periodYear = dateObj.getFullYear();
      const reference = `Opening balance as of ${asOfDate}`;

      // Check for existing opening balance import
      const existing = await db
        .select()
        .from(stockTransactions)
        .where(eq(stockTransactions.reference, reference))
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({
          message: `Opening balances for ${asOfDate} have already been imported. Delete existing records first to re-import.`,
        });
      }

      let created = 0;

      for (const row of rows) {
        if (!row.skuCode || !row.matched) continue;

        // Create THH stock if > 0
        if (row.thhStock > 0) {
          // Create a synthetic batch for opening balance
          const [batch] = await db.insert(batches).values({
            skuCode: row.skuCode,
            sizeVariant: row.size || "opening",
            stockLocation: "THH",
            batchNumber: `OB-${asOfDate}-${row.skuCode}`,
            manufactureDate: asOfDate,
            expiryDate: new Date(dateObj.getFullYear() + 2, dateObj.getMonth(), dateObj.getDate())
              .toISOString()
              .split("T")[0],
            initialQuantity: row.thhStock,
            isActive: true,
            receivedDate: asOfDate,
            deliveryNoteRef: "Opening Balance",
            notes: `Opening balance imported from Animal Farm spreadsheet`,
          }).returning();

          await db.insert(stockTransactions).values({
            batchId: batch.id,
            skuCode: row.skuCode,
            stockLocation: "THH",
            transactionType: "DELIVERY_IN",
            quantity: row.thhStock,
            transactionDate: asOfDate,
            periodMonth,
            periodYear,
            reference,
            createdBy: userId,
            notes: "Opening balance from Animal Farm",
          });
          created++;
        }

        // Create 8/8 stock if > 0
        if (row.eightEightStock > 0) {
          const [batch] = await db.insert(batches).values({
            skuCode: row.skuCode,
            sizeVariant: row.size || "opening",
            stockLocation: "88",
            batchNumber: `OB-${asOfDate}-${row.skuCode}-88`,
            manufactureDate: asOfDate,
            expiryDate: new Date(dateObj.getFullYear() + 2, dateObj.getMonth(), dateObj.getDate())
              .toISOString()
              .split("T")[0],
            initialQuantity: row.eightEightStock,
            isActive: true,
            receivedDate: asOfDate,
            deliveryNoteRef: "Opening Balance",
            notes: `Opening balance imported from Animal Farm spreadsheet`,
          }).returning();

          await db.insert(stockTransactions).values({
            batchId: batch.id,
            skuCode: row.skuCode,
            stockLocation: "88",
            transactionType: "DELIVERY_IN",
            quantity: row.eightEightStock,
            transactionDate: asOfDate,
            periodMonth,
            periodYear,
            reference,
            createdBy: userId,
            notes: "Opening balance from Animal Farm",
          });
          created++;
        }

        // Update reorder point if provided
        if (row.reorderPoint !== null && row.reorderPoint > 0) {
          await db
            .update(products)
            .set({ reorderPointOverride: row.reorderPoint })
            .where(eq(products.skuCode, row.skuCode));
        }
      }

      logAudit(req, "OPENING_BALANCE_IMPORT", {
        resourceType: "StockTransaction",
        detail: `Imported ${created} opening balance transactions as of ${asOfDate}`,
      });

      res.json({ created, asOfDate });
    } catch (err: any) {
      console.error("Opening balance commit error:", err);
      res.status(500).json({ message: "Failed to import opening balances", error: err.message });
    }
  });

  // ─── Pull from Google Sheets directly ─────────────
  router.get("/api/stock-in/opening-balance/pull-sheet", isAdmin, async (req, res) => {
    try {
      const googleAccessToken = (req.user as any)?.googleAccessToken;
      if (!googleAccessToken) {
        return res.status(401).json({
          message: "Google Sheets access not available. Please sign out and sign in again to grant Sheets permission.",
          needsReauth: true,
        });
      }

      const sheetId = process.env.ANIMAL_FARM_SHEET_ID;
      if (!sheetId) {
        return res.status(400).json({
          message: "ANIMAL_FARM_SHEET_ID not configured in environment.",
        });
      }

      // Try Google Sheets API first (for native Google Sheets)
      // Then fall back to Google Drive API (for uploaded .xlsx files)
      let parsed: ParsedStockRow[];

      // Attempt 1: Sheets API — returns calculated values (formulas resolved)
      const sheetName = "Summary master";
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;

      const sheetsRes = await fetch(sheetsUrl, {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          Accept: "application/json",
        },
      });

      if (sheetsRes.ok) {
        const sheetsData = await sheetsRes.json();
        const rawRows: string[][] = sheetsData.values ?? [];
        parsed = parseRowData(rawRows);
      } else {
        // Attempt 2: Google Drive API — download as xlsx
        console.log("Sheets API failed, trying Drive API download...");
        const driveUrl = `https://www.googleapis.com/drive/v3/files/${sheetId}?alt=media`;
        const driveRes = await fetch(driveUrl, {
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
          },
        });

        if (!driveRes.ok) {
          // Attempt 3: Export as xlsx (for native Google Sheets that failed Sheets API)
          const exportUrl = `https://www.googleapis.com/drive/v3/files/${sheetId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
          const exportRes = await fetch(exportUrl, {
            headers: {
              Authorization: `Bearer ${googleAccessToken}`,
            },
          });

          if (!exportRes.ok) {
            const errBody = await exportRes.text();
            console.error("Google Drive export error:", exportRes.status, errBody);
            if (exportRes.status === 401 || exportRes.status === 403) {
              return res.status(401).json({
                message: "Google Drive permission denied or token expired. Please sign out and sign in again.",
                needsReauth: true,
              });
            }
            return res.status(502).json({
              message: `Could not access the Animal Farm file. Check that the file ID is correct and you have access. (${exportRes.status})`,
            });
          }

          const buffer = Buffer.from(await exportRes.arrayBuffer());
          parsed = parseSummarySheet(buffer);
        } else {
          const buffer = Buffer.from(await driveRes.arrayBuffer());
          parsed = parseSummarySheet(buffer);
        }
      }

      // Check against product master
      const allProducts = await db.select().from(products).where(eq(products.isActive, true));
      const productMap = new Map(allProducts.map((p) => [p.skuCode, p]));

      const enriched = parsed.map((row) => {
        if (row.skuCode && !productMap.has(row.skuCode)) {
          return {
            ...row,
            matched: false,
            matchIssue: `SKU "${row.skuCode}" mapped but not found in product master`,
          };
        }
        return row;
      });

      const matchedCount = enriched.filter((r) => r.matched).length;
      const unmatchedCount = enriched.filter((r) => !r.matched).length;
      const totalThhUnits = enriched.filter((r) => r.matched).reduce((s, r) => s + r.thhStock, 0);
      const totalEeUnits = enriched.filter((r) => r.matched).reduce((s, r) => s + r.eightEightStock, 0);

      logAudit(req, "GOOGLE_SHEET_PULLED", {
        detail: `Pulled Animal Farm data from Google Sheets: ${enriched.length} rows, ${matchedCount} matched`,
      });

      res.json({
        rows: enriched,
        summary: {
          matchedCount,
          unmatchedCount,
          totalThhUnits,
          totalEeUnits,
          totalRows: enriched.length,
        },
        source: "Google Sheets (live)",
      });
    } catch (err: any) {
      console.error("Google Sheets pull error:", err);
      res.status(500).json({ message: "Failed to pull from Google Sheets", error: err.message });
    }
  });

  // ─── Debug: show raw sheet data ───────────────────
  router.get("/api/stock-in/opening-balance/debug-sheet", isAdmin, async (req, res) => {
    try {
      const googleAccessToken = (req.user as any)?.googleAccessToken;
      if (!googleAccessToken) return res.status(401).json({ message: "No Google token" });

      const sheetId = process.env.ANIMAL_FARM_SHEET_ID;
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Summary%20master?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;

      const sheetsRes = await fetch(sheetsUrl, {
        headers: { Authorization: `Bearer ${googleAccessToken}`, Accept: "application/json" },
      });

      if (!sheetsRes.ok) {
        return res.json({ sheetsApiError: sheetsRes.status, body: await sheetsRes.text() });
      }

      const data = await sheetsRes.json();
      const rows = (data.values ?? []).slice(0, 10);
      res.json({ source: "Sheets API", rowCount: data.values?.length, sampleRows: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
