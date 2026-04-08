import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import {
  findUserByEmail,
  updateUser,
  createAccessRequest,
  getAccessRequests,
  updateAccessRequest,
  getAllUsers,
  getInvitedUsers,
  addInvitedUser,
  removeInvitedUser,
} from "./storage";
import { logAudit } from "./auditLog";
import { db } from "./db";
import {
  auditLogs,
  products,
  manufacturers,
  stockTransactions,
  batches,
  notifications,
  orders,
  orderLines,
} from "../shared/schema";
import { eq, sql, and, desc, asc, sum, count, or, isNull, gte, lte } from "drizzle-orm";

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Not authenticated" });
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && (req.user as any)?.isAdmin) return next();
  res.status(403).json({ message: "Admin access required" });
}

export function registerRoutes(router: Router) {
  // ─── Auth ────────────────────────────────────────
  router.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.json(null);
    const u = req.user as any;
    res.json({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      profileImageUrl: u.profileImageUrl,
      isAdmin: u.isAdmin,
      termsAcceptedAt: u.termsAcceptedAt,
    });
  });

  // ─── Terms Acceptance ────────────────────────────
  router.post("/api/user/accept-terms", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    await updateUser(user.id, { termsAcceptedAt: new Date() });
    logAudit(req, "TERMS_ACCEPTED", { resourceType: "User", resourceId: String(user.id) });
    res.json({ ok: true });
  });

  // ─── Access Requests (public) ────────────────────
  const accessRequestSchema = z.object({
    name: z.string().min(1).max(255),
    email: z.string().email().max(255),
    cell: z.string().max(50).optional(),
  });

  router.post("/api/request-access", async (req, res) => {
    const parsed = accessRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const result = await createAccessRequest(parsed.data);
    res.json(result[0]);
  });

  // ─── Admin: Users ────────────────────────────────
  router.get("/api/admin/users", isAuthenticated, async (_req, res) => {
    const result = await getAllUsers();
    res.json(result);
  });

  router.patch("/api/admin/users/:id/admin", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { isAdmin: makeAdmin } = req.body;
    const updated = await updateUser(id, { isAdmin: !!makeAdmin });
    logAudit(req, "TOGGLE_ADMIN", {
      resourceType: "User",
      resourceId: String(id),
      detail: `Set isAdmin=${!!makeAdmin}`,
    });
    res.json(updated);
  });

  // ─── Admin: Invites ──────────────────────────────
  router.get("/api/admin/invites", isAuthenticated, async (_req, res) => {
    const result = await getInvitedUsers();
    res.json(result);
  });

  router.post("/api/admin/invites", isAuthenticated, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const user = req.user as any;
    const result = await addInvitedUser(email, user.id);
    logAudit(req, "INVITE_CREATED", { resourceType: "Invite", detail: email });
    res.json(result[0]);
  });

  router.delete("/api/admin/invites/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await removeInvitedUser(id);
    logAudit(req, "INVITE_REMOVED", { resourceType: "Invite", resourceId: String(id) });
    res.json({ ok: true });
  });

  // ─── Admin: Access Requests ──────────────────────
  router.get("/api/admin/access-requests", isAuthenticated, async (_req, res) => {
    const result = await getAccessRequests();
    res.json(result);
  });

  router.patch("/api/admin/access-requests/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!["approved", "declined"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'declined'" });
    }
    const result = await updateAccessRequest(id, status);
    logAudit(req, "ACCESS_REQUEST_" + status.toUpperCase(), {
      resourceType: "AccessRequest",
      resourceId: String(id),
    });
    res.json(result[0]);
  });

  // ─── Admin: Audit Logs ───────────────────────────
  router.get("/api/admin/audit-logs", isAuthenticated, async (_req, res) => {
    const result = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
    res.json(result);
  });

  // ─── Admin: Security Overview ────────────────────
  router.get("/api/admin/security-overview", isAuthenticated, async (_req, res) => {
    const allUsers = await getAllUsers();
    const admins = allUsers.filter((u) => u.isAdmin);
    res.json({
      totalUsers: allUsers.length,
      adminCount: admins.length,
      recentLogins: allUsers
        .filter((u) => u.createdAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
    });
  });

  // ═══════════════════════════════════════════════════
  // ─── Stock Management Routes ──────────────────────
  // ═══════════════════════════════════════════════════

  // ─── Products: List ──────────────────────────────
  router.get("/api/products", isAuthenticated, async (req, res) => {
    try {
      const { category, brand, location, active } = req.query;
      const isActive = active === "false" ? false : true;

      const conditions: any[] = [eq(products.isActive, isActive)];
      if (category) conditions.push(eq(products.category, String(category)));
      if (brand) conditions.push(eq(products.brand, String(brand)));
      if (location) conditions.push(eq(products.primaryStockLocation, String(location)));

      const result = await db
        .select({
          id: products.id,
          skuCode: products.skuCode,
          productName: products.productName,
          brand: products.brand,
          category: products.category,
          packSizeG: products.packSizeG,
          unitsPerCase: products.unitsPerCase,
          manufacturerId: products.manufacturerId,
          primaryStockLocation: products.primaryStockLocation,
          isActive: products.isActive,
          xeroItemCode: products.xeroItemCode,
          apBrandEquivalent: products.apBrandEquivalent,
          reorderPointOverride: products.reorderPointOverride,
          weightKg: products.weightKg,
          notes: products.notes,
          createdAt: products.createdAt,
          manufacturerName: manufacturers.name,
        })
        .from(products)
        .leftJoin(manufacturers, eq(products.manufacturerId, manufacturers.id))
        .where(and(...conditions))
        .orderBy(asc(products.productName));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch products", error: err.message });
    }
  });

  // ─── Products: Get by SKU ────────────────────────
  router.get("/api/products/:skuCode", isAuthenticated, async (req, res) => {
    try {
      const { skuCode } = req.params;
      const result = await db
        .select({
          id: products.id,
          skuCode: products.skuCode,
          productName: products.productName,
          brand: products.brand,
          category: products.category,
          packSizeG: products.packSizeG,
          unitsPerCase: products.unitsPerCase,
          manufacturerId: products.manufacturerId,
          primaryStockLocation: products.primaryStockLocation,
          isActive: products.isActive,
          xeroItemCode: products.xeroItemCode,
          apBrandEquivalent: products.apBrandEquivalent,
          reorderPointOverride: products.reorderPointOverride,
          weightKg: products.weightKg,
          notes: products.notes,
          createdAt: products.createdAt,
          manufacturerName: manufacturers.name,
        })
        .from(products)
        .leftJoin(manufacturers, eq(products.manufacturerId, manufacturers.id))
        .where(eq(products.skuCode, skuCode))
        .limit(1);

      if (result.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(result[0]);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch product", error: err.message });
    }
  });

  // ─── Products: Update ────────────────────────────
  const updateProductSchema = z.object({
    productName: z.string().min(1).max(255).optional(),
    brand: z.string().max(10).optional(),
    category: z.string().max(50).optional(),
    packSizeG: z.number().int().positive().nullable().optional(),
    unitsPerCase: z.number().int().positive().nullable().optional(),
    manufacturerId: z.number().int().positive().nullable().optional(),
    primaryStockLocation: z.string().max(10).optional(),
    isActive: z.boolean().optional(),
    xeroItemCode: z.string().max(50).nullable().optional(),
    apBrandEquivalent: z.string().max(50).nullable().optional(),
    reorderPointOverride: z.number().int().positive().nullable().optional(),
    weightKg: z.number().int().positive().nullable().optional(),
    notes: z.string().nullable().optional(),
  });

  router.patch("/api/products/:skuCode", isAuthenticated, async (req, res) => {
    try {
      const { skuCode } = req.params;
      const parsed = updateProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }

      const existing = await db
        .select()
        .from(products)
        .where(eq(products.skuCode, skuCode))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }

      const updated = await db
        .update(products)
        .set(parsed.data)
        .where(eq(products.skuCode, skuCode))
        .returning();

      logAudit(req, "PRODUCT_UPDATED", {
        resourceType: "Product",
        resourceId: skuCode,
        beforeValue: existing[0],
        afterValue: updated[0],
      });

      res.json(updated[0]);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update product", error: err.message });
    }
  });

  // ─── Manufacturers: List ─────────────────────────
  router.get("/api/manufacturers", isAuthenticated, async (_req, res) => {
    try {
      const result = await db.select().from(manufacturers).orderBy(asc(manufacturers.name));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch manufacturers", error: err.message });
    }
  });

  // ─── Stock: Summary Dashboard ────────────────────
  router.get("/api/stock/summary", isAuthenticated, async (_req, res) => {
    try {
      const thhStockSub = db
        .select({
          skuCode: stockTransactions.skuCode,
          total: sum(stockTransactions.quantity).as("thh_total"),
        })
        .from(stockTransactions)
        .where(eq(stockTransactions.stockLocation, "THH"))
        .groupBy(stockTransactions.skuCode)
        .as("thh_stock");

      const eeStockSub = db
        .select({
          skuCode: stockTransactions.skuCode,
          total: sum(stockTransactions.quantity).as("ee_total"),
        })
        .from(stockTransactions)
        .where(eq(stockTransactions.stockLocation, "88"))
        .groupBy(stockTransactions.skuCode)
        .as("ee_stock");

      const result = await db
        .select({
          skuCode: products.skuCode,
          productName: products.productName,
          category: products.category,
          brand: products.brand,
          unitsPerCase: products.unitsPerCase,
          primaryStockLocation: products.primaryStockLocation,
          manufacturerName: manufacturers.name,
          thhStock: thhStockSub.total,
          eightEightStock: eeStockSub.total,
          reorderPoint: products.reorderPointOverride,
        })
        .from(products)
        .leftJoin(manufacturers, eq(products.manufacturerId, manufacturers.id))
        .leftJoin(thhStockSub, eq(products.skuCode, thhStockSub.skuCode))
        .leftJoin(eeStockSub, eq(products.skuCode, eeStockSub.skuCode))
        .where(eq(products.isActive, true))
        .orderBy(asc(products.productName));

      // Convert string sums to numbers
      const mapped = result.map((r) => ({
        ...r,
        thhStock: r.thhStock ? Number(r.thhStock) : 0,
        eightEightStock: r.eightEightStock ? Number(r.eightEightStock) : 0,
        reorderPoint: r.reorderPoint ?? null,
      }));

      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch stock summary", error: err.message });
    }
  });

  // ─── Stock: Transactions by SKU ──────────────────
  router.get("/api/stock/transactions/:skuCode", isAuthenticated, async (req, res) => {
    try {
      const { skuCode } = req.params;
      const { location, type, from, to } = req.query;

      const conditions: any[] = [eq(stockTransactions.skuCode, skuCode)];
      if (location) conditions.push(eq(stockTransactions.stockLocation, String(location)));
      if (type) conditions.push(eq(stockTransactions.transactionType, String(type)));
      if (from) conditions.push(gte(stockTransactions.transactionDate, String(from)));
      if (to) conditions.push(lte(stockTransactions.transactionDate, String(to)));

      const result = await db
        .select()
        .from(stockTransactions)
        .where(and(...conditions))
        .orderBy(desc(stockTransactions.transactionDate));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch transactions", error: err.message });
    }
  });

  // ─── Batches: List by SKU ────────────────────────
  router.get("/api/batches/:skuCode", isAuthenticated, async (req, res) => {
    try {
      const { skuCode } = req.params;
      const { location } = req.query;

      const conditions: any[] = [eq(batches.skuCode, skuCode)];
      if (location) conditions.push(eq(batches.stockLocation, String(location)));

      const result = await db
        .select()
        .from(batches)
        .where(and(...conditions))
        .orderBy(desc(batches.isActive), asc(batches.manufactureDate));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch batches", error: err.message });
    }
  });

  // ─── Batches: Create + DELIVERY_IN ───────────────
  const createBatchSchema = z.object({
    skuCode: z.string().min(1).max(50),
    sizeVariant: z.string().min(1).max(50),
    stockLocation: z.string().min(1).max(10),
    batchNumber: z.string().min(1).max(100),
    manufactureDate: z.string().min(1), // date string YYYY-MM-DD
    expiryDate: z.string().min(1),
    initialQuantity: z.number().int().positive(),
    receivedDate: z.string().min(1),
    deliveryNoteRef: z.string().max(100).optional(),
    notes: z.string().optional(),
  });

  router.post("/api/batches", isAuthenticated, async (req, res) => {
    try {
      const parsed = createBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }

      const data = parsed.data;
      const user = req.user as any;
      const receivedDate = new Date(data.receivedDate);

      // Create the batch
      const [newBatch] = await db
        .insert(batches)
        .values({
          skuCode: data.skuCode,
          sizeVariant: data.sizeVariant,
          stockLocation: data.stockLocation,
          batchNumber: data.batchNumber,
          manufactureDate: data.manufactureDate,
          expiryDate: data.expiryDate,
          initialQuantity: data.initialQuantity,
          receivedDate: data.receivedDate,
          deliveryNoteRef: data.deliveryNoteRef || null,
          notes: data.notes || null,
        })
        .returning();

      // Create the DELIVERY_IN stock transaction
      const [txn] = await db
        .insert(stockTransactions)
        .values({
          batchId: newBatch.id,
          skuCode: data.skuCode,
          stockLocation: data.stockLocation,
          transactionType: "DELIVERY_IN",
          quantity: data.initialQuantity,
          transactionDate: data.receivedDate,
          periodMonth: receivedDate.getMonth() + 1,
          periodYear: receivedDate.getFullYear(),
          reference: data.deliveryNoteRef || null,
          createdBy: user.id,
          notes: data.notes || null,
        })
        .returning();

      logAudit(req, "BATCH_CREATED", {
        resourceType: "Batch",
        resourceId: String(newBatch.id),
        detail: `Batch ${data.batchNumber} for ${data.skuCode}, qty ${data.initialQuantity} at ${data.stockLocation}`,
        afterValue: { batch: newBatch, transaction: txn },
      });

      res.json({ batch: newBatch, transaction: txn });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create batch", error: err.message });
    }
  });

  // ─── Stock: Manual Adjustment ────────────────────
  const adjustmentSchema = z.object({
    skuCode: z.string().min(1).max(50),
    stockLocation: z.string().min(1).max(10),
    quantity: z.number().int(), // signed: positive or negative
    notes: z.string().min(1, "Notes are required for adjustments"),
    batchId: z.number().int().positive().optional(),
  });

  router.post("/api/stock/adjustment", isAuthenticated, async (req, res) => {
    try {
      const parsed = adjustmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }

      const data = parsed.data;
      const user = req.user as any;
      const now = new Date();

      const [txn] = await db
        .insert(stockTransactions)
        .values({
          batchId: data.batchId || null,
          skuCode: data.skuCode,
          stockLocation: data.stockLocation,
          transactionType: "ADJUSTMENT",
          quantity: data.quantity,
          transactionDate: now.toISOString().split("T")[0],
          periodMonth: now.getMonth() + 1,
          periodYear: now.getFullYear(),
          createdBy: user.id,
          notes: data.notes,
        })
        .returning();

      logAudit(req, "STOCK_ADJUSTMENT", {
        resourceType: "StockTransaction",
        resourceId: String(txn.id),
        detail: `Adjustment for ${data.skuCode} at ${data.stockLocation}: ${data.quantity > 0 ? "+" : ""}${data.quantity} units. ${data.notes}`,
        afterValue: txn,
      });

      res.json(txn);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create adjustment", error: err.message });
    }
  });

  // ─── Stock: Reorder Check ────────────────────────
  router.get("/api/stock/reorder-check", isAuthenticated, async (_req, res) => {
    try {
      // Get all active products with manufacturer info
      const activeProducts = await db
        .select({
          skuCode: products.skuCode,
          productName: products.productName,
          primaryStockLocation: products.primaryStockLocation,
          unitsPerCase: products.unitsPerCase,
          reorderPointOverride: products.reorderPointOverride,
          manufacturerName: manufacturers.name,
        })
        .from(products)
        .leftJoin(manufacturers, eq(products.manufacturerId, manufacturers.id))
        .where(eq(products.isActive, true));

      // Get current stock per SKU per location
      const stockBySku = await db
        .select({
          skuCode: stockTransactions.skuCode,
          stockLocation: stockTransactions.stockLocation,
          total: sum(stockTransactions.quantity).as("total"),
        })
        .from(stockTransactions)
        .groupBy(stockTransactions.skuCode, stockTransactions.stockLocation);

      // Build stock lookup: { skuCode: { location: total } }
      const stockMap: Record<string, Record<string, number>> = {};
      for (const row of stockBySku) {
        if (!stockMap[row.skuCode]) stockMap[row.skuCode] = {};
        stockMap[row.skuCode][row.stockLocation] = Number(row.total) || 0;
      }

      // Get annual sales data: sum of negative transactions (SALES_OUT, PNP_OUT)
      // over the last 365 days for RP calculation
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];

      const annualSales = await db
        .select({
          skuCode: stockTransactions.skuCode,
          totalOut: sql<string>`COALESCE(ABS(SUM(CASE WHEN ${stockTransactions.transactionType} IN ('SALES_OUT', 'PNP_OUT') THEN ${stockTransactions.quantity} ELSE 0 END)), 0)`.as("total_out"),
        })
        .from(stockTransactions)
        .where(gte(stockTransactions.transactionDate, oneYearAgoStr))
        .groupBy(stockTransactions.skuCode);

      const salesMap: Record<string, number> = {};
      for (const row of annualSales) {
        salesMap[row.skuCode] = Number(row.totalOut) || 0;
      }

      const results = activeProducts.map((p) => {
        const primaryLoc = p.primaryStockLocation;
        const currentStock = stockMap[p.skuCode]?.[primaryLoc] ?? 0;

        // Reorder point: override, or calculated from annual sales
        let reorderPoint: number | null = null;
        if (p.reorderPointOverride != null) {
          reorderPoint = p.reorderPointOverride;
        } else {
          const annualUnits = salesMap[p.skuCode] || 0;
          if (annualUnits > 0) {
            // RP = (annual_sales_units / 365) * 75
            reorderPoint = Math.ceil((annualUnits / 365) * 75);
          }
          // If no sales data, reorderPoint stays null
        }

        let status: "OK" | "APPROACHING" | "REORDER" = "OK";
        let recommendedOrderQty: number | null = null;

        if (reorderPoint !== null) {
          if (currentStock <= reorderPoint) {
            status = "REORDER";
            // PRD Section 6.4: Target = RP × 2, Gap = Target − Current
            const targetStock = reorderPoint * 2;
            const gap = targetStock - currentStock;
            recommendedOrderQty = gap > 0 ? gap : 1;
          } else if (currentStock <= reorderPoint * 1.25) {
            status = "APPROACHING";
            // Still calculate a recommended qty for approaching items
            const targetStock = reorderPoint * 2;
            const gap = targetStock - currentStock;
            recommendedOrderQty = gap > 0 ? gap : null;
          }
        }

        return {
          skuCode: p.skuCode,
          productName: p.productName,
          currentStock,
          reorderPoint,
          status,
          recommendedOrderQty,
          manufacturerName: p.manufacturerName,
        };
      });

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to run reorder check", error: err.message });
    }
  });

  // ─── Stock: Transfer THH to 88 ──────────────────
  const transferSchema = z.object({
    skuCode: z.string().min(1).max(50),
    cases: z.number().int().positive(),
  });

  router.post("/api/stock/transfer", isAuthenticated, async (req, res) => {
    try {
      const parsed = transferSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }

      const { skuCode, cases } = parsed.data;
      const user = req.user as any;

      // Look up the product to get units_per_case
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.skuCode, skuCode))
        .limit(1);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (!product.unitsPerCase) {
        return res.status(400).json({ message: "Product has no units_per_case defined" });
      }

      const units = cases * product.unitsPerCase;
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];

      // Create two transactions: negative at THH, positive at 88
      const [thhTxn] = await db
        .insert(stockTransactions)
        .values({
          skuCode,
          stockLocation: "THH",
          transactionType: "TRANSFER_THH_TO_88",
          quantity: -units,
          transactionDate: dateStr,
          periodMonth: now.getMonth() + 1,
          periodYear: now.getFullYear(),
          reference: `Transfer ${cases} cases (${units} units)`,
          createdBy: user.id,
        })
        .returning();

      const [eeTxn] = await db
        .insert(stockTransactions)
        .values({
          skuCode,
          stockLocation: "88",
          transactionType: "TRANSFER_THH_TO_88",
          quantity: units,
          transactionDate: dateStr,
          periodMonth: now.getMonth() + 1,
          periodYear: now.getFullYear(),
          reference: `Transfer ${cases} cases (${units} units)`,
          createdBy: user.id,
        })
        .returning();

      logAudit(req, "STOCK_TRANSFER", {
        resourceType: "StockTransaction",
        resourceId: `${thhTxn.id},${eeTxn.id}`,
        detail: `Transferred ${cases} cases (${units} units) of ${skuCode} from THH to 88`,
        afterValue: { thhTransaction: thhTxn, eeTransaction: eeTxn },
      });

      res.json({ thhTransaction: thhTxn, eeTransaction: eeTxn, unitsMoved: units });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create transfer", error: err.message });
    }
  });

  // ─── Notifications: List ─────────────────────────
  router.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;

      const result = await db
        .select()
        .from(notifications)
        .where(
          or(
            eq(notifications.userId, user.id),
            isNull(notifications.userId),
          )
        )
        .orderBy(desc(notifications.createdAt))
        .limit(50);

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch notifications", error: err.message });
    }
  });

  // ─── Notifications: Mark as Read ─────────────────
  router.post("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);

      const [updated] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Notification not found" });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to mark notification as read", error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════
  // ─── Email Order Fulfilment Routes ────────────────
  // ═══════════════════════════════════════════════════

  // ─── Orders: List ───────────────────────────────
  router.get("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const { status, channel } = req.query;

      const conditions: any[] = [];
      if (status) conditions.push(eq(orders.status, String(status)));
      if (channel) conditions.push(eq(orders.salesChannel, String(channel)));

      const result = await db
        .select()
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(orders.createdAt));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch orders", error: err.message });
    }
  });

  // ─── Orders: Get by ID with lines ───────────────
  router.get("/api/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const lines = await db
        .select({
          id: orderLines.id,
          orderId: orderLines.orderId,
          skuCode: orderLines.skuCode,
          sizeVariant: orderLines.sizeVariant,
          quantityOrdered: orderLines.quantityOrdered,
          availableQuantity: orderLines.availableQuantity,
          shortfall: orderLines.shortfall,
          productName: products.productName,
        })
        .from(orderLines)
        .leftJoin(products, eq(orderLines.skuCode, products.skuCode))
        .where(eq(orderLines.orderId, id));

      res.json({ ...order, lines });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch order", error: err.message });
    }
  });

  // ─── Orders: Create ─────────────────────────────
  const createOrderSchema = z.object({
    orderDate: z.string().min(1),
    customerName: z.string().min(1).max(255),
    customerEmail: z.string().email().max(255).optional(),
    customerPhone: z.string().max(50).optional(),
    deliveryStreet: z.string().optional(),
    deliverySuburb: z.string().max(255).optional(),
    deliveryCity: z.string().max(255).optional(),
    deliveryProvince: z.string().max(100).optional(),
    deliveryPostalCode: z.string().max(10).optional(),
    salesChannel: z.enum(["Website", "Takealot", "Wholesale", "Retail", "Other"]),
    orderReference: z.string().max(100).optional(),
    specialInstructions: z.string().optional(),
    lines: z.array(
      z.object({
        skuCode: z.string().min(1).max(50),
        sizeVariant: z.string().max(50).optional(),
        quantityOrdered: z.number().int().positive(),
      })
    ).min(1),
  });

  router.post("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }

      const data = parsed.data;
      const user = req.user as any;

      // Check THH stock availability for each line
      const lineDetails = await Promise.all(
        data.lines.map(async (line) => {
          const [stockResult] = await db
            .select({
              total: sum(stockTransactions.quantity).as("total"),
            })
            .from(stockTransactions)
            .where(
              and(
                eq(stockTransactions.skuCode, line.skuCode),
                eq(stockTransactions.stockLocation, "THH")
              )
            );

          const currentStock = Number(stockResult?.total) || 0;
          const availableQuantity = Math.max(0, Math.min(currentStock, line.quantityOrdered));
          const shortfall = Math.max(0, line.quantityOrdered - currentStock);

          return {
            skuCode: line.skuCode,
            sizeVariant: line.sizeVariant || null,
            quantityOrdered: line.quantityOrdered,
            availableQuantity,
            shortfall,
          };
        })
      );

      // Create the order
      const [newOrder] = await db
        .insert(orders)
        .values({
          orderDate: data.orderDate,
          customerName: data.customerName,
          customerEmail: data.customerEmail || null,
          customerPhone: data.customerPhone || null,
          deliveryStreet: data.deliveryStreet || null,
          deliverySuburb: data.deliverySuburb || null,
          deliveryCity: data.deliveryCity || null,
          deliveryProvince: data.deliveryProvince || null,
          deliveryPostalCode: data.deliveryPostalCode || null,
          salesChannel: data.salesChannel,
          orderReference: data.orderReference || null,
          specialInstructions: data.specialInstructions || null,
          status: "RECEIVED",
          createdBy: user.id,
        })
        .returning();

      // Create order lines
      const createdLines = await Promise.all(
        lineDetails.map(async (line) => {
          const [created] = await db
            .insert(orderLines)
            .values({
              orderId: newOrder.id,
              skuCode: line.skuCode,
              sizeVariant: line.sizeVariant,
              quantityOrdered: line.quantityOrdered,
              availableQuantity: line.availableQuantity,
              shortfall: line.shortfall,
            })
            .returning();
          return created;
        })
      );

      logAudit(req, "ORDER_CREATED", {
        resourceType: "Order",
        resourceId: String(newOrder.id),
        detail: `Order for ${data.customerName}, ${data.lines.length} line(s), channel: ${data.salesChannel}`,
        afterValue: { order: newOrder, lines: createdLines },
      });

      res.json({ ...newOrder, lines: createdLines });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create order", error: err.message });
    }
  });

  // ─── Orders: Update Status ──────────────────────
  const VALID_TRANSITIONS: Record<string, string> = {
    RECEIVED: "CONFIRMED",
    CONFIRMED: "INVOICED",
    INVOICED: "DISPATCHED",
  };

  const updateOrderStatusSchema = z.object({
    status: z.enum(["CONFIRMED", "INVOICED", "DISPATCHED"]),
  });

  router.patch("/api/orders/:id/status", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const parsed = updateOrderStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }

      const { status: newStatus } = parsed.data;

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Validate status transition
      const expectedNext = VALID_TRANSITIONS[order.status];
      if (expectedNext !== newStatus) {
        return res.status(400).json({
          message: `Invalid status transition: ${order.status} → ${newStatus}. Expected: ${order.status} → ${expectedNext || "(terminal)"}`,
        });
      }

      const updateFields: any = { status: newStatus };

      // When dispatching, create SALES_OUT stock transactions and set dispatchedAt
      if (newStatus === "DISPATCHED") {
        updateFields.dispatchedAt = new Date();

        const lines = await db
          .select()
          .from(orderLines)
          .where(eq(orderLines.orderId, id));

        const user = req.user as any;
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];

        for (const line of lines) {
          await db
            .insert(stockTransactions)
            .values({
              skuCode: line.skuCode,
              stockLocation: "THH",
              transactionType: "SALES_OUT",
              quantity: -line.quantityOrdered,
              transactionDate: dateStr,
              periodMonth: now.getMonth() + 1,
              periodYear: now.getFullYear(),
              reference: `Order #${id}`,
              createdBy: user.id,
              notes: `Dispatched order #${id} for ${order.customerName}`,
            });
        }
      }

      const [updated] = await db
        .update(orders)
        .set(updateFields)
        .where(eq(orders.id, id))
        .returning();

      logAudit(req, "ORDER_STATUS_UPDATED", {
        resourceType: "Order",
        resourceId: String(id),
        detail: `Status changed: ${order.status} → ${newStatus}`,
        beforeValue: { status: order.status },
        afterValue: { status: newStatus },
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update order status", error: err.message });
    }
  });

  // ─── Orders: Update Fields ──────────────────────
  const updateOrderFieldsSchema = z.object({
    courierService: z.string().max(50).optional(),
    waybillNumber: z.string().max(100).optional(),
    xeroInvoiceRef: z.string().max(100).optional(),
  });

  router.patch("/api/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const parsed = updateOrderFieldsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }

      const [existing] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ message: "Order not found" });
      }

      const [updated] = await db
        .update(orders)
        .set(parsed.data)
        .where(eq(orders.id, id))
        .returning();

      logAudit(req, "ORDER_UPDATED", {
        resourceType: "Order",
        resourceId: String(id),
        detail: `Updated fields: ${Object.keys(parsed.data).join(", ")}`,
        beforeValue: existing,
        afterValue: updated,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update order", error: err.message });
    }
  });

  // ─── Orders: Invoice Data (Xero format) ─────────
  router.get("/api/orders/:id/invoice-data", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const lines = await db
        .select({
          skuCode: orderLines.skuCode,
          quantityOrdered: orderLines.quantityOrdered,
          productName: products.productName,
          xeroItemCode: products.xeroItemCode,
        })
        .from(orderLines)
        .leftJoin(products, eq(orderLines.skuCode, products.skuCode))
        .where(eq(orderLines.orderId, id));

      res.json({
        invoiceDate: order.orderDate,
        customerName: order.customerName,
        reference: order.orderReference,
        lines: lines.map((l) => ({
          itemCode: l.xeroItemCode,
          description: l.productName,
          quantity: l.quantityOrdered,
          unitPrice: null,
        })),
        taxRate: "15%",
        currency: "ZAR",
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch invoice data", error: err.message });
    }
  });

  // ─── Orders: Courier Data ───────────────────────
  router.get("/api/orders/:id/courier-data", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json({
        collectionAddress: "The Herbal Horse & Pet, THH Premises (update from system settings)",
        deliveryAddress: {
          street: order.deliveryStreet,
          suburb: order.deliverySuburb,
          city: order.deliveryCity,
          province: order.deliveryProvince,
          postalCode: order.deliveryPostalCode,
        },
        recipientName: order.customerName,
        recipientPhone: order.customerPhone,
        reference: order.orderReference,
        specialInstructions: order.specialInstructions,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch courier data", error: err.message });
    }
  });

  return router;
}
