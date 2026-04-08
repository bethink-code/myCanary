var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/api.ts
import "dotenv/config";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import cors from "cors";

// server/auth.ts
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

// server/db.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accessRequests: () => accessRequests,
  apBrandMappings: () => apBrandMappings,
  auditLogs: () => auditLogs,
  batches: () => batches,
  clients: () => clients,
  invitedUsers: () => invitedUsers,
  manufacturers: () => manufacturers,
  notifications: () => notifications,
  orderLines: () => orderLines,
  orders: () => orders,
  pnpOrderLines: () => pnpOrderLines,
  pnpOrders: () => pnpOrders,
  pnpProductMappings: () => pnpProductMappings,
  productRawMaterials: () => productRawMaterials,
  products: () => products,
  purchaseOrderLines: () => purchaseOrderLines,
  purchaseOrders: () => purchaseOrders,
  rawMaterials: () => rawMaterials,
  sessions: () => sessions,
  stockTransactions: () => stockTransactions,
  systemSettings: () => systemSettings,
  userClients: () => userClients,
  users: () => users
});
import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  varchar,
  date,
  json,
  uniqueIndex
} from "drizzle-orm/pg-core";
var clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  // subdomain: slug.mycanary.biz
  isActive: boolean("is_active").default(true).notNull(),
  setupComplete: boolean("setup_complete").default(false).notNull(),
  setupProgress: json("setup_progress"),
  // { products, suppliers, openingStock, reorderPoints, salesData }
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var sessions = pgTable("sessions", {
  sid: varchar("sid", { length: 255 }).primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { withTimezone: true }).notNull()
});
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  profileImageUrl: text("profile_image_url"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var userClients = pgTable("user_clients", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  role: varchar("role", { length: 20 }).default("member").notNull(),
  // owner, admin, member
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var invitedUsers = pgTable("invited_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  invitedBy: integer("invited_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  cell: varchar("cell", { length: 50 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 100 }),
  resourceId: varchar("resource_id", { length: 255 }),
  outcome: varchar("outcome", { length: 50 }),
  detail: text("detail"),
  ipAddress: varchar("ip_address", { length: 45 }),
  beforeValue: json("before_value"),
  afterValue: json("after_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var manufacturers = pgTable("manufacturers", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  standardLeadTimeDays: integer("standard_lead_time_days").default(40).notNull(),
  maxLeadTimeDays: integer("max_lead_time_days").default(60).notNull(),
  poFormatNotes: text("po_format_notes"),
  moqNotes: text("moq_notes")
});
var products = pgTable("products", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  brand: varchar("brand", { length: 10 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  packSizeG: integer("pack_size_g"),
  unitsPerCase: integer("units_per_case"),
  manufacturerId: integer("manufacturer_id").references(() => manufacturers.id),
  primaryStockLocation: varchar("primary_stock_location", { length: 10 }).default("THH").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  xeroItemCode: varchar("xero_item_code", { length: 50 }),
  apBrandEquivalent: varchar("ap_brand_equivalent", { length: 50 }),
  reorderPointOverride: integer("reorder_point_override"),
  weightKg: integer("weight_kg"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("products_client_sku_idx").on(table.clientId, table.skuCode)
]);
var batches = pgTable("batches", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  sizeVariant: varchar("size_variant", { length: 50 }).notNull(),
  stockLocation: varchar("stock_location", { length: 10 }).notNull(),
  batchNumber: varchar("batch_number", { length: 100 }).notNull(),
  manufactureDate: date("manufacture_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  initialQuantity: integer("initial_quantity").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  receivedDate: date("received_date").notNull(),
  deliveryNoteRef: varchar("delivery_note_ref", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var stockTransactions = pgTable("stock_transactions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  batchId: integer("batch_id").references(() => batches.id),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  stockLocation: varchar("stock_location", { length: 10 }).notNull(),
  transactionType: varchar("transaction_type", { length: 30 }).notNull(),
  quantity: integer("quantity").notNull(),
  transactionDate: date("transaction_date").notNull(),
  periodMonth: integer("period_month").notNull(),
  periodYear: integer("period_year").notNull(),
  reference: varchar("reference", { length: 255 }),
  channel: varchar("channel", { length: 5 }),
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  manufacturerId: integer("manufacturer_id").references(() => manufacturers.id).notNull(),
  status: varchar("status", { length: 20 }).default("DRAFT").notNull(),
  createdDate: date("created_date").notNull(),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  expectedDeliveryDate: date("expected_delivery_date"),
  notes: text("notes"),
  draftEmailBody: text("draft_email_body"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var purchaseOrderLines = pgTable("purchase_order_lines", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  poId: integer("po_id").references(() => purchaseOrders.id).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  sizeVariant: varchar("size_variant", { length: 50 }).notNull(),
  quantityOrdered: integer("quantity_ordered").notNull(),
  triggerReason: text("trigger_reason")
});
var pnpOrders = pgTable("pnp_orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  weekEndingDate: date("week_ending_date").notNull(),
  appointmentTime: timestamp("appointment_time", { withTimezone: true }),
  uploadedFileName: varchar("uploaded_file_name", { length: 255 }),
  uploadDate: timestamp("upload_date", { withTimezone: true }).defaultNow(),
  status: varchar("status", { length: 30 }).default("UPLOADED").notNull(),
  dispatchInstructionSentAt: timestamp("dispatch_instruction_sent_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var pnpOrderLines = pgTable("pnp_order_lines", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  pnpOrderId: integer("pnp_order_id").references(() => pnpOrders.id).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  dcCode: varchar("dc_code", { length: 10 }).notNull(),
  dcName: varchar("dc_name", { length: 100 }).notNull(),
  orderedCases: integer("ordered_cases").notNull(),
  orderedUnits: integer("ordered_units").notNull(),
  availableCases: integer("available_cases"),
  shortfallCases: integer("shortfall_cases").default(0)
});
var orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  orderDate: date("order_date").notNull(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 50 }),
  deliveryStreet: text("delivery_street"),
  deliverySuburb: varchar("delivery_suburb", { length: 255 }),
  deliveryCity: varchar("delivery_city", { length: 255 }),
  deliveryProvince: varchar("delivery_province", { length: 100 }),
  deliveryPostalCode: varchar("delivery_postal_code", { length: 10 }),
  salesChannel: varchar("sales_channel", { length: 20 }).notNull(),
  orderReference: varchar("order_reference", { length: 100 }),
  specialInstructions: text("special_instructions"),
  status: varchar("status", { length: 30 }).default("RECEIVED").notNull(),
  courierService: varchar("courier_service", { length: 50 }),
  waybillNumber: varchar("waybill_number", { length: 100 }),
  xeroInvoiceRef: varchar("xero_invoice_ref", { length: 100 }),
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var orderLines = pgTable("order_lines", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  sizeVariant: varchar("size_variant", { length: 50 }),
  quantityOrdered: integer("quantity_ordered").notNull(),
  availableQuantity: integer("available_quantity"),
  shortfall: integer("shortfall").default(0)
});
var notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  isRead: boolean("is_read").default(false).notNull(),
  userId: integer("user_id").references(() => users.id),
  resourceType: varchar("resource_type", { length: 100 }),
  resourceId: varchar("resource_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("system_settings_client_key_idx").on(table.clientId, table.key)
]);
var rawMaterials = pgTable("raw_materials", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  currentStock: integer("current_stock").default(0),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }),
  supplier: varchar("supplier", { length: 255 }),
  reorderFlag: boolean("reorder_flag").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var productRawMaterials = pgTable("product_raw_materials", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  rawMaterialId: integer("raw_material_id").references(() => rawMaterials.id).notNull(),
  quantityPerBatch: integer("quantity_per_batch"),
  notes: text("notes")
});
var pnpProductMappings = pgTable("pnp_product_mappings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  pnpProductName: varchar("pnp_product_name", { length: 255 }).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull()
});
var apBrandMappings = pgTable("ap_brand_mappings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  apProductCode: varchar("ap_product_code", { length: 50 }).notNull(),
  thhSkuCode: varchar("thh_sku_code", { length: 50 }).notNull(),
  apProductName: varchar("ap_product_name", { length: 255 })
});

// server/db.ts
var getDatabaseUrl = () => {
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL_PRODUCTION) {
    return process.env.DATABASE_URL_PRODUCTION;
  }
  return process.env.DATABASE_URL;
};
var sql = neon(getDatabaseUrl());
var db = drizzle(sql, { schema: schema_exports });

// server/storage.ts
import { eq } from "drizzle-orm";
async function findUserByEmail(email) {
  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0] ?? null;
}
async function createUser(data) {
  const result = await db.insert(users).values(data).returning();
  return result[0];
}
async function updateUser(id, data) {
  const result = await db.update(users).set(data).where(eq(users.id, id)).returning();
  return result[0];
}
async function isEmailInvited(email) {
  const result = await db.select().from(invitedUsers).where(eq(invitedUsers.email, email.toLowerCase()));
  return result.length > 0;
}
async function getInvitedUsers() {
  return db.select().from(invitedUsers);
}
async function addInvitedUser(email, invitedBy) {
  return db.insert(invitedUsers).values({ email: email.toLowerCase(), invitedBy }).returning();
}
async function removeInvitedUser(id) {
  return db.delete(invitedUsers).where(eq(invitedUsers.id, id));
}
async function createAccessRequest(data) {
  return db.insert(accessRequests).values(data).returning();
}
async function getAccessRequests() {
  return db.select().from(accessRequests);
}
async function updateAccessRequest(id, status) {
  return db.update(accessRequests).set({ status }).where(eq(accessRequests.id, id)).returning();
}
async function createAuditLog(data) {
  try {
    await db.insert(auditLogs).values(data);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
async function getAllUsers() {
  return db.select().from(users);
}

// server/auth.ts
passport.serializeUser((user, done) => {
  done(null, {
    email: user.email,
    googleAccessToken: user.googleAccessToken,
    googleRefreshToken: user.googleRefreshToken
  });
});
passport.deserializeUser(async (sessionData, done) => {
  try {
    const email = typeof sessionData === "string" ? sessionData : sessionData.email;
    const user = await findUserByEmail(email);
    if (user && typeof sessionData === "object") {
      user.googleAccessToken = sessionData.googleAccessToken;
      user.googleRefreshToken = sessionData.googleRefreshToken;
    }
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.NODE_ENV === "production" ? "https://www.mycanary.biz/auth/callback" : "/auth/callback",
      scope: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly"
      ],
      accessType: "offline",
      prompt: "consent"
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(null, false, { message: "No email found in Google profile" });
        }
        const invited = await isEmailInvited(email);
        if (!invited) {
          const existing = await findUserByEmail(email);
          if (!existing) {
            return done(null, false, {
              message: "You are not on the invite list. Please request access."
            });
          }
        }
        let user = await findUserByEmail(email);
        if (!user) {
          user = await createUser({
            email,
            firstName: profile.name?.givenName ?? null,
            lastName: profile.name?.familyName ?? null,
            profileImageUrl: profile.photos?.[0]?.value ?? null
          });
        }
        user.googleAccessToken = accessToken;
        user.googleRefreshToken = refreshToken;
        return done(null, user);
      } catch (err) {
        return done(err, void 0);
      }
    }
  )
);
var auth_default = passport;

// server/routes.ts
import { z } from "zod";

// server/auditLog.ts
function logAudit(req, action, opts = {}) {
  const userId = req.user?.id;
  const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  createAuditLog({
    userId,
    action,
    ipAddress,
    ...opts
  });
}

// server/routes.ts
import { eq as eq2, sql as sql2, and, desc, asc, sum, or, isNull, gte, lte, inArray, like } from "drizzle-orm";

// server/clientContext.ts
function clientContext(req, _res, next) {
  req.clientId = 1;
  next();
}
function getClientId(req) {
  return req.clientId;
}

// server/routes.ts
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Not authenticated" });
}
function registerRoutes(router2) {
  router2.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.json(null);
    const u = req.user;
    res.json({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      profileImageUrl: u.profileImageUrl,
      isAdmin: u.isAdmin,
      termsAcceptedAt: u.termsAcceptedAt
    });
  });
  router2.post("/api/user/accept-terms", isAuthenticated, async (req, res) => {
    const user = req.user;
    await updateUser(user.id, { termsAcceptedAt: /* @__PURE__ */ new Date() });
    logAudit(req, "TERMS_ACCEPTED", { resourceType: "User", resourceId: String(user.id) });
    res.json({ ok: true });
  });
  const accessRequestSchema = z.object({
    name: z.string().min(1).max(255),
    email: z.string().email().max(255),
    cell: z.string().max(50).optional()
  });
  router2.post("/api/request-access", async (req, res) => {
    const parsed = accessRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const result = await createAccessRequest(parsed.data);
    res.json(result[0]);
  });
  router2.get("/api/admin/users", isAuthenticated, async (_req, res) => {
    const result = await getAllUsers();
    res.json(result);
  });
  router2.patch("/api/admin/users/:id/admin", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { isAdmin: makeAdmin } = req.body;
    const updated = await updateUser(id, { isAdmin: !!makeAdmin });
    logAudit(req, "TOGGLE_ADMIN", {
      resourceType: "User",
      resourceId: String(id),
      detail: `Set isAdmin=${!!makeAdmin}`
    });
    res.json(updated);
  });
  router2.get("/api/admin/invites", isAuthenticated, async (_req, res) => {
    const result = await getInvitedUsers();
    res.json(result);
  });
  router2.post("/api/admin/invites", isAuthenticated, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const user = req.user;
    const result = await addInvitedUser(email, user.id);
    logAudit(req, "INVITE_CREATED", { resourceType: "Invite", detail: email });
    res.json(result[0]);
  });
  router2.delete("/api/admin/invites/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await removeInvitedUser(id);
    logAudit(req, "INVITE_REMOVED", { resourceType: "Invite", resourceId: String(id) });
    res.json({ ok: true });
  });
  router2.get("/api/admin/access-requests", isAuthenticated, async (_req, res) => {
    const result = await getAccessRequests();
    res.json(result);
  });
  router2.patch("/api/admin/access-requests/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!["approved", "declined"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'declined'" });
    }
    const result = await updateAccessRequest(id, status);
    logAudit(req, "ACCESS_REQUEST_" + status.toUpperCase(), {
      resourceType: "AccessRequest",
      resourceId: String(id)
    });
    res.json(result[0]);
  });
  router2.get("/api/admin/audit-logs", isAuthenticated, async (_req, res) => {
    const result = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200);
    res.json(result);
  });
  router2.get("/api/admin/security-overview", isAuthenticated, async (_req, res) => {
    const allUsers = await getAllUsers();
    const admins = allUsers.filter((u) => u.isAdmin);
    res.json({
      totalUsers: allUsers.length,
      adminCount: admins.length,
      recentLogins: allUsers.filter((u) => u.createdAt).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)
    });
  });
  router2.get("/api/products", isAuthenticated, async (req, res) => {
    try {
      const { category, brand, location, active } = req.query;
      const isActive = active === "false" ? false : true;
      const clientId = getClientId(req);
      const conditions = [eq2(products.isActive, isActive), eq2(products.clientId, clientId)];
      if (category) conditions.push(eq2(products.category, String(category)));
      if (brand) conditions.push(eq2(products.brand, String(brand)));
      if (location) conditions.push(eq2(products.primaryStockLocation, String(location)));
      const result = await db.select({
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
        manufacturerName: manufacturers.name
      }).from(products).leftJoin(manufacturers, eq2(products.manufacturerId, manufacturers.id)).where(and(...conditions)).orderBy(asc(products.productName));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch products", error: err.message });
    }
  });
  router2.get("/api/products/:skuCode", isAuthenticated, async (req, res) => {
    try {
      const { skuCode } = req.params;
      const clientId = getClientId(req);
      const result = await db.select({
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
        manufacturerName: manufacturers.name
      }).from(products).leftJoin(manufacturers, eq2(products.manufacturerId, manufacturers.id)).where(and(eq2(products.skuCode, skuCode), eq2(products.clientId, clientId))).limit(1);
      if (result.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(result[0]);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch product", error: err.message });
    }
  });
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
    notes: z.string().nullable().optional()
  });
  router2.patch("/api/products/:skuCode", isAuthenticated, async (req, res) => {
    try {
      const { skuCode } = req.params;
      const clientId = getClientId(req);
      const parsed = updateProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const existing = await db.select().from(products).where(and(eq2(products.skuCode, skuCode), eq2(products.clientId, clientId))).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }
      const updated = await db.update(products).set(parsed.data).where(and(eq2(products.skuCode, skuCode), eq2(products.clientId, clientId))).returning();
      logAudit(req, "PRODUCT_UPDATED", {
        resourceType: "Product",
        resourceId: skuCode,
        beforeValue: existing[0],
        afterValue: updated[0]
      });
      res.json(updated[0]);
    } catch (err) {
      res.status(500).json({ message: "Failed to update product", error: err.message });
    }
  });
  router2.get("/api/manufacturers", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const result = await db.select().from(manufacturers).where(eq2(manufacturers.clientId, clientId)).orderBy(asc(manufacturers.name));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch manufacturers", error: err.message });
    }
  });
  router2.get("/api/stock/summary", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const thhStockSub = db.select({
        skuCode: stockTransactions.skuCode,
        total: sum(stockTransactions.quantity).as("thh_total")
      }).from(stockTransactions).where(and(eq2(stockTransactions.stockLocation, "THH"), eq2(stockTransactions.clientId, clientId))).groupBy(stockTransactions.skuCode).as("thh_stock");
      const eeStockSub = db.select({
        skuCode: stockTransactions.skuCode,
        total: sum(stockTransactions.quantity).as("ee_total")
      }).from(stockTransactions).where(and(eq2(stockTransactions.stockLocation, "88"), eq2(stockTransactions.clientId, clientId))).groupBy(stockTransactions.skuCode).as("ee_stock");
      const result = await db.select({
        skuCode: products.skuCode,
        productName: products.productName,
        category: products.category,
        brand: products.brand,
        unitsPerCase: products.unitsPerCase,
        primaryStockLocation: products.primaryStockLocation,
        manufacturerName: manufacturers.name,
        thhStock: thhStockSub.total,
        eightEightStock: eeStockSub.total,
        reorderPoint: products.reorderPointOverride
      }).from(products).leftJoin(manufacturers, eq2(products.manufacturerId, manufacturers.id)).leftJoin(thhStockSub, eq2(products.skuCode, thhStockSub.skuCode)).leftJoin(eeStockSub, eq2(products.skuCode, eeStockSub.skuCode)).where(and(eq2(products.isActive, true), eq2(products.clientId, clientId))).orderBy(asc(products.productName));
      const mapped = result.map((r) => ({
        ...r,
        thhStock: r.thhStock ? Number(r.thhStock) : 0,
        eightEightStock: r.eightEightStock ? Number(r.eightEightStock) : 0,
        reorderPoint: r.reorderPoint ?? null
      }));
      res.json(mapped);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch stock summary", error: err.message });
    }
  });
  router2.get("/api/stock/transactions/:skuCode", isAuthenticated, async (req, res) => {
    try {
      const { skuCode } = req.params;
      const clientId = getClientId(req);
      const { location, type, from, to } = req.query;
      const conditions = [eq2(stockTransactions.skuCode, skuCode), eq2(stockTransactions.clientId, clientId)];
      if (location) conditions.push(eq2(stockTransactions.stockLocation, String(location)));
      if (type) conditions.push(eq2(stockTransactions.transactionType, String(type)));
      if (from) conditions.push(gte(stockTransactions.transactionDate, String(from)));
      if (to) conditions.push(lte(stockTransactions.transactionDate, String(to)));
      const result = await db.select().from(stockTransactions).where(and(...conditions)).orderBy(desc(stockTransactions.transactionDate));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch transactions", error: err.message });
    }
  });
  router2.get("/api/batches/:skuCode", isAuthenticated, async (req, res) => {
    try {
      const { skuCode } = req.params;
      const clientId = getClientId(req);
      const { location } = req.query;
      const conditions = [eq2(batches.skuCode, skuCode), eq2(batches.clientId, clientId)];
      if (location) conditions.push(eq2(batches.stockLocation, String(location)));
      const result = await db.select().from(batches).where(and(...conditions)).orderBy(desc(batches.isActive), asc(batches.manufactureDate));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch batches", error: err.message });
    }
  });
  const createBatchSchema = z.object({
    skuCode: z.string().min(1).max(50),
    sizeVariant: z.string().min(1).max(50),
    stockLocation: z.string().min(1).max(10),
    batchNumber: z.string().min(1).max(100),
    manufactureDate: z.string().min(1),
    // date string YYYY-MM-DD
    expiryDate: z.string().min(1),
    initialQuantity: z.number().int().positive(),
    receivedDate: z.string().min(1),
    deliveryNoteRef: z.string().max(100).optional(),
    notes: z.string().optional()
  });
  router2.post("/api/batches", isAuthenticated, async (req, res) => {
    try {
      const parsed = createBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const data = parsed.data;
      const user = req.user;
      const clientId = getClientId(req);
      const receivedDate = new Date(data.receivedDate);
      const [newBatch] = await db.insert(batches).values({
        clientId,
        skuCode: data.skuCode,
        sizeVariant: data.sizeVariant,
        stockLocation: data.stockLocation,
        batchNumber: data.batchNumber,
        manufactureDate: data.manufactureDate,
        expiryDate: data.expiryDate,
        initialQuantity: data.initialQuantity,
        receivedDate: data.receivedDate,
        deliveryNoteRef: data.deliveryNoteRef || null,
        notes: data.notes || null
      }).returning();
      const [txn] = await db.insert(stockTransactions).values({
        clientId,
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
        notes: data.notes || null
      }).returning();
      logAudit(req, "BATCH_CREATED", {
        resourceType: "Batch",
        resourceId: String(newBatch.id),
        detail: `Batch ${data.batchNumber} for ${data.skuCode}, qty ${data.initialQuantity} at ${data.stockLocation}`,
        afterValue: { batch: newBatch, transaction: txn }
      });
      res.json({ batch: newBatch, transaction: txn });
    } catch (err) {
      res.status(500).json({ message: "Failed to create batch", error: err.message });
    }
  });
  const adjustmentSchema = z.object({
    skuCode: z.string().min(1).max(50),
    stockLocation: z.string().min(1).max(10),
    quantity: z.number().int(),
    // signed: positive or negative
    notes: z.string().min(1, "Notes are required for adjustments"),
    batchId: z.number().int().positive().optional()
  });
  router2.post("/api/stock/adjustment", isAuthenticated, async (req, res) => {
    try {
      const parsed = adjustmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const data = parsed.data;
      const user = req.user;
      const clientId = getClientId(req);
      const now = /* @__PURE__ */ new Date();
      const [txn] = await db.insert(stockTransactions).values({
        clientId,
        batchId: data.batchId || null,
        skuCode: data.skuCode,
        stockLocation: data.stockLocation,
        transactionType: "ADJUSTMENT",
        quantity: data.quantity,
        transactionDate: now.toISOString().split("T")[0],
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear(),
        createdBy: user.id,
        notes: data.notes
      }).returning();
      logAudit(req, "STOCK_ADJUSTMENT", {
        resourceType: "StockTransaction",
        resourceId: String(txn.id),
        detail: `Adjustment for ${data.skuCode} at ${data.stockLocation}: ${data.quantity > 0 ? "+" : ""}${data.quantity} units. ${data.notes}`,
        afterValue: txn
      });
      res.json(txn);
    } catch (err) {
      res.status(500).json({ message: "Failed to create adjustment", error: err.message });
    }
  });
  router2.get("/api/stock/reorder-check", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const activeProducts = await db.select({
        skuCode: products.skuCode,
        productName: products.productName,
        primaryStockLocation: products.primaryStockLocation,
        unitsPerCase: products.unitsPerCase,
        reorderPointOverride: products.reorderPointOverride,
        manufacturerName: manufacturers.name
      }).from(products).leftJoin(manufacturers, eq2(products.manufacturerId, manufacturers.id)).where(and(eq2(products.isActive, true), eq2(products.clientId, clientId)));
      const stockBySku = await db.select({
        skuCode: stockTransactions.skuCode,
        stockLocation: stockTransactions.stockLocation,
        total: sum(stockTransactions.quantity).as("total")
      }).from(stockTransactions).where(eq2(stockTransactions.clientId, clientId)).groupBy(stockTransactions.skuCode, stockTransactions.stockLocation);
      const stockMap = {};
      for (const row of stockBySku) {
        if (!stockMap[row.skuCode]) stockMap[row.skuCode] = {};
        stockMap[row.skuCode][row.stockLocation] = Number(row.total) || 0;
      }
      const oneYearAgo = /* @__PURE__ */ new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];
      const annualSales = await db.select({
        skuCode: stockTransactions.skuCode,
        totalOut: sql2`COALESCE(ABS(SUM(CASE WHEN ${stockTransactions.transactionType} IN ('SALES_OUT', 'PNP_OUT') THEN ${stockTransactions.quantity} ELSE 0 END)), 0)`.as("total_out")
      }).from(stockTransactions).where(and(gte(stockTransactions.transactionDate, oneYearAgoStr), eq2(stockTransactions.clientId, clientId))).groupBy(stockTransactions.skuCode);
      const salesMap = {};
      for (const row of annualSales) {
        salesMap[row.skuCode] = Number(row.totalOut) || 0;
      }
      const results = activeProducts.map((p) => {
        const primaryLoc = p.primaryStockLocation;
        const currentStock = stockMap[p.skuCode]?.[primaryLoc] ?? 0;
        let reorderPoint = null;
        if (p.reorderPointOverride != null) {
          reorderPoint = p.reorderPointOverride;
        } else {
          const annualUnits = salesMap[p.skuCode] || 0;
          if (annualUnits > 0) {
            reorderPoint = Math.ceil(annualUnits / 365 * 75);
          }
        }
        let status = "OK";
        let recommendedOrderQty = null;
        if (reorderPoint !== null) {
          if (currentStock <= reorderPoint) {
            status = "REORDER";
            const targetStock = reorderPoint * 2;
            const gap = targetStock - currentStock;
            recommendedOrderQty = gap > 0 ? gap : 1;
          } else if (currentStock <= reorderPoint * 1.25) {
            status = "APPROACHING";
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
          manufacturerName: p.manufacturerName
        };
      });
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Failed to run reorder check", error: err.message });
    }
  });
  const transferSchema = z.object({
    skuCode: z.string().min(1).max(50),
    cases: z.number().int().positive()
  });
  router2.post("/api/stock/transfer", isAuthenticated, async (req, res) => {
    try {
      const parsed = transferSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const { skuCode, cases } = parsed.data;
      const user = req.user;
      const clientId = getClientId(req);
      const [product] = await db.select().from(products).where(and(eq2(products.skuCode, skuCode), eq2(products.clientId, clientId))).limit(1);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      if (!product.unitsPerCase) {
        return res.status(400).json({ message: "Product has no units_per_case defined" });
      }
      const units = cases * product.unitsPerCase;
      const now = /* @__PURE__ */ new Date();
      const dateStr = now.toISOString().split("T")[0];
      const [thhTxn] = await db.insert(stockTransactions).values({
        clientId,
        skuCode,
        stockLocation: "THH",
        transactionType: "TRANSFER_THH_TO_88",
        quantity: -units,
        transactionDate: dateStr,
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear(),
        reference: `Transfer ${cases} cases (${units} units)`,
        createdBy: user.id
      }).returning();
      const [eeTxn] = await db.insert(stockTransactions).values({
        clientId,
        skuCode,
        stockLocation: "88",
        transactionType: "TRANSFER_THH_TO_88",
        quantity: units,
        transactionDate: dateStr,
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear(),
        reference: `Transfer ${cases} cases (${units} units)`,
        createdBy: user.id
      }).returning();
      logAudit(req, "STOCK_TRANSFER", {
        resourceType: "StockTransaction",
        resourceId: `${thhTxn.id},${eeTxn.id}`,
        detail: `Transferred ${cases} cases (${units} units) of ${skuCode} from THH to 88`,
        afterValue: { thhTransaction: thhTxn, eeTransaction: eeTxn }
      });
      res.json({ thhTransaction: thhTxn, eeTransaction: eeTxn, unitsMoved: units });
    } catch (err) {
      res.status(500).json({ message: "Failed to create transfer", error: err.message });
    }
  });
  router2.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      const clientId = getClientId(req);
      const result = await db.select().from(notifications).where(
        and(
          eq2(notifications.clientId, clientId),
          or(
            eq2(notifications.userId, user.id),
            isNull(notifications.userId)
          )
        )
      ).orderBy(desc(notifications.createdAt)).limit(50);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch notifications", error: err.message });
    }
  });
  router2.post("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const clientId = getClientId(req);
      const [updated] = await db.update(notifications).set({ isRead: true }).where(and(eq2(notifications.id, id), eq2(notifications.clientId, clientId))).returning();
      if (!updated) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to mark notification as read", error: err.message });
    }
  });
  router2.get("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const { status, channel } = req.query;
      const clientId = getClientId(req);
      const conditions = [eq2(orders.clientId, clientId)];
      if (status) conditions.push(eq2(orders.status, String(status)));
      if (channel) conditions.push(eq2(orders.salesChannel, String(channel)));
      const result = await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.createdAt));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch orders", error: err.message });
    }
  });
  router2.get("/api/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const clientId = getClientId(req);
      const [order] = await db.select().from(orders).where(and(eq2(orders.id, id), eq2(orders.clientId, clientId))).limit(1);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      const lines = await db.select({
        id: orderLines.id,
        orderId: orderLines.orderId,
        skuCode: orderLines.skuCode,
        sizeVariant: orderLines.sizeVariant,
        quantityOrdered: orderLines.quantityOrdered,
        availableQuantity: orderLines.availableQuantity,
        shortfall: orderLines.shortfall,
        productName: products.productName
      }).from(orderLines).leftJoin(products, eq2(orderLines.skuCode, products.skuCode)).where(and(eq2(orderLines.orderId, id), eq2(orderLines.clientId, clientId)));
      res.json({ ...order, lines });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch order", error: err.message });
    }
  });
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
        quantityOrdered: z.number().int().positive()
      })
    ).min(1)
  });
  router2.post("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const data = parsed.data;
      const user = req.user;
      const clientId = getClientId(req);
      const lineDetails = await Promise.all(
        data.lines.map(async (line) => {
          const [stockResult] = await db.select({
            total: sum(stockTransactions.quantity).as("total")
          }).from(stockTransactions).where(
            and(
              eq2(stockTransactions.skuCode, line.skuCode),
              eq2(stockTransactions.stockLocation, "THH"),
              eq2(stockTransactions.clientId, clientId)
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
            shortfall
          };
        })
      );
      const [newOrder] = await db.insert(orders).values({
        clientId,
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
        createdBy: user.id
      }).returning();
      const createdLines = await Promise.all(
        lineDetails.map(async (line) => {
          const [created] = await db.insert(orderLines).values({
            clientId,
            orderId: newOrder.id,
            skuCode: line.skuCode,
            sizeVariant: line.sizeVariant,
            quantityOrdered: line.quantityOrdered,
            availableQuantity: line.availableQuantity,
            shortfall: line.shortfall
          }).returning();
          return created;
        })
      );
      logAudit(req, "ORDER_CREATED", {
        resourceType: "Order",
        resourceId: String(newOrder.id),
        detail: `Order for ${data.customerName}, ${data.lines.length} line(s), channel: ${data.salesChannel}`,
        afterValue: { order: newOrder, lines: createdLines }
      });
      res.json({ ...newOrder, lines: createdLines });
    } catch (err) {
      res.status(500).json({ message: "Failed to create order", error: err.message });
    }
  });
  const VALID_TRANSITIONS = {
    RECEIVED: "CONFIRMED",
    CONFIRMED: "INVOICED",
    INVOICED: "DISPATCHED"
  };
  const updateOrderStatusSchema = z.object({
    status: z.enum(["CONFIRMED", "INVOICED", "DISPATCHED"])
  });
  router2.patch("/api/orders/:id/status", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const clientId = getClientId(req);
      const parsed = updateOrderStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const { status: newStatus } = parsed.data;
      const [order] = await db.select().from(orders).where(and(eq2(orders.id, id), eq2(orders.clientId, clientId))).limit(1);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      const expectedNext = VALID_TRANSITIONS[order.status];
      if (expectedNext !== newStatus) {
        return res.status(400).json({
          message: `Invalid status transition: ${order.status} \u2192 ${newStatus}. Expected: ${order.status} \u2192 ${expectedNext || "(terminal)"}`
        });
      }
      const updateFields = { status: newStatus };
      if (newStatus === "DISPATCHED") {
        updateFields.dispatchedAt = /* @__PURE__ */ new Date();
        const lines = await db.select().from(orderLines).where(and(eq2(orderLines.orderId, id), eq2(orderLines.clientId, clientId)));
        const user = req.user;
        const now = /* @__PURE__ */ new Date();
        const dateStr = now.toISOString().split("T")[0];
        for (const line of lines) {
          await db.insert(stockTransactions).values({
            clientId,
            skuCode: line.skuCode,
            stockLocation: "THH",
            transactionType: "SALES_OUT",
            quantity: -line.quantityOrdered,
            transactionDate: dateStr,
            periodMonth: now.getMonth() + 1,
            periodYear: now.getFullYear(),
            reference: `Order #${id}`,
            createdBy: user.id,
            notes: `Dispatched order #${id} for ${order.customerName}`
          });
        }
      }
      const [updated] = await db.update(orders).set(updateFields).where(and(eq2(orders.id, id), eq2(orders.clientId, clientId))).returning();
      logAudit(req, "ORDER_STATUS_UPDATED", {
        resourceType: "Order",
        resourceId: String(id),
        detail: `Status changed: ${order.status} \u2192 ${newStatus}`,
        beforeValue: { status: order.status },
        afterValue: { status: newStatus }
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update order status", error: err.message });
    }
  });
  const updateOrderFieldsSchema = z.object({
    courierService: z.string().max(50).optional(),
    waybillNumber: z.string().max(100).optional(),
    xeroInvoiceRef: z.string().max(100).optional()
  });
  router2.patch("/api/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const clientId = getClientId(req);
      const parsed = updateOrderFieldsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const [existing] = await db.select().from(orders).where(and(eq2(orders.id, id), eq2(orders.clientId, clientId))).limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Order not found" });
      }
      const [updated] = await db.update(orders).set(parsed.data).where(and(eq2(orders.id, id), eq2(orders.clientId, clientId))).returning();
      logAudit(req, "ORDER_UPDATED", {
        resourceType: "Order",
        resourceId: String(id),
        detail: `Updated fields: ${Object.keys(parsed.data).join(", ")}`,
        beforeValue: existing,
        afterValue: updated
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update order", error: err.message });
    }
  });
  router2.get("/api/orders/:id/invoice-data", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const clientId = getClientId(req);
      const [order] = await db.select().from(orders).where(and(eq2(orders.id, id), eq2(orders.clientId, clientId))).limit(1);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      const lines = await db.select({
        skuCode: orderLines.skuCode,
        quantityOrdered: orderLines.quantityOrdered,
        productName: products.productName,
        xeroItemCode: products.xeroItemCode
      }).from(orderLines).leftJoin(products, eq2(orderLines.skuCode, products.skuCode)).where(and(eq2(orderLines.orderId, id), eq2(orderLines.clientId, clientId)));
      res.json({
        invoiceDate: order.orderDate,
        customerName: order.customerName,
        reference: order.orderReference,
        lines: lines.map((l) => ({
          itemCode: l.xeroItemCode,
          description: l.productName,
          quantity: l.quantityOrdered,
          unitPrice: null
        })),
        taxRate: "15%",
        currency: "ZAR"
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch invoice data", error: err.message });
    }
  });
  router2.get("/api/orders/:id/courier-data", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const clientId = getClientId(req);
      const [order] = await db.select().from(orders).where(and(eq2(orders.id, id), eq2(orders.clientId, clientId))).limit(1);
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
          postalCode: order.deliveryPostalCode
        },
        recipientName: order.customerName,
        recipientPhone: order.customerPhone,
        reference: order.orderReference,
        specialInstructions: order.specialInstructions
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch courier data", error: err.message });
    }
  });
  router2.get("/api/snapshot/overview", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const windowParam = parseInt(String(req.query.window || "30"), 10);
      const window = [30, 60, 90].includes(windowParam) ? windowParam : 30;
      const allProducts = await db.select({
        skuCode: products.skuCode,
        productName: products.productName,
        brand: products.brand,
        category: products.category,
        reorderPoint: products.reorderPointOverride,
        manufacturerName: manufacturers.name
      }).from(products).leftJoin(manufacturers, eq2(products.manufacturerId, manufacturers.id)).where(and(eq2(products.clientId, clientId), eq2(products.isActive, true)));
      const stockRows = await db.select({
        skuCode: stockTransactions.skuCode,
        totalStock: sum(stockTransactions.quantity).mapWith(Number)
      }).from(stockTransactions).where(eq2(stockTransactions.clientId, clientId)).groupBy(stockTransactions.skuCode);
      const stockMap = new Map(stockRows.map((r) => [r.skuCode, r.totalStock ?? 0]));
      const windowStart = /* @__PURE__ */ new Date();
      windowStart.setDate(windowStart.getDate() - window);
      const windowStartStr = windowStart.toISOString().split("T")[0];
      const depletionRows = await db.select({
        skuCode: stockTransactions.skuCode,
        totalOut: sql2`COALESCE(SUM(ABS(${stockTransactions.quantity})), 0)`.mapWith(Number)
      }).from(stockTransactions).where(
        and(
          eq2(stockTransactions.clientId, clientId),
          inArray(stockTransactions.transactionType, ["SALES_OUT", "PNP_OUT"]),
          gte(stockTransactions.transactionDate, windowStartStr)
        )
      ).groupBy(stockTransactions.skuCode);
      const depletionMap = new Map(depletionRows.map((r) => [r.skuCode, r.totalOut]));
      const today = /* @__PURE__ */ new Date();
      const items = allProducts.map((p) => {
        const currentStock = stockMap.get(p.skuCode) ?? 0;
        const totalOut = depletionMap.get(p.skuCode) ?? 0;
        const depletionRate = totalOut / window;
        const reorderPoint = p.reorderPoint;
        let daysRemaining = null;
        if (depletionRate > 0) {
          daysRemaining = Math.round(currentStock / depletionRate * 10) / 10;
        }
        let projectedReorderDate = null;
        if (depletionRate > 0 && reorderPoint !== null && reorderPoint !== void 0) {
          const daysUntilReorder = (currentStock - reorderPoint) / depletionRate;
          if (daysUntilReorder > 0) {
            const reorderDate = new Date(today);
            reorderDate.setDate(reorderDate.getDate() + Math.ceil(daysUntilReorder));
            projectedReorderDate = reorderDate.toISOString().split("T")[0];
          } else {
            projectedReorderDate = today.toISOString().split("T")[0];
          }
        }
        let status;
        if (reorderPoint === null || reorderPoint === void 0) {
          status = "NO_DATA";
        } else if (currentStock <= reorderPoint) {
          status = "REORDER";
        } else if (currentStock <= reorderPoint * 1.25) {
          status = "APPROACHING";
        } else {
          status = "OK";
        }
        return {
          skuCode: p.skuCode,
          productName: p.productName,
          brand: p.brand,
          category: p.category,
          manufacturerName: p.manufacturerName,
          currentStock,
          reorderPoint,
          depletionRate: Math.round(depletionRate * 100) / 100,
          daysRemaining,
          projectedReorderDate,
          status
        };
      });
      let overallStatus = "ALL_GOOD";
      if (items.some((i) => i.status === "REORDER")) {
        overallStatus = "ACTION_NEEDED";
      } else if (items.some((i) => i.status === "APPROACHING")) {
        overallStatus = "HEADS_UP";
      }
      const ledgerRow = await db.select().from(systemSettings).where(and(eq2(systemSettings.clientId, clientId), eq2(systemSettings.key, "ledger_start_date"))).limit(1);
      const lastTxnRow = await db.select({ maxDate: sql2`max(${stockTransactions.createdAt})` }).from(stockTransactions).where(eq2(stockTransactions.clientId, clientId));
      const lastSalesRow = await db.select({ maxRef: sql2`max(${stockTransactions.reference})` }).from(stockTransactions).where(and(
        eq2(stockTransactions.clientId, clientId),
        eq2(stockTransactions.transactionType, "SALES_OUT"),
        like(stockTransactions.reference, "%Xero import %")
      ));
      let lastSalesPeriodEnd = null;
      if (lastSalesRow[0]?.maxRef) {
        const match = lastSalesRow[0].maxRef.match(/to\s+(\d{4}-\d{2}-\d{2})/);
        lastSalesPeriodEnd = match ? match[1] : null;
      }
      const dataFreshness = {
        openingBalanceDate: ledgerRow[0]?.value ?? null,
        lastSalesImportTo: lastSalesPeriodEnd,
        lastTransactionAt: lastTxnRow[0]?.maxDate ?? null
      };
      res.json({ items, overallStatus, dataFreshness });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch snapshot overview", error: err.message });
    }
  });
  router2.get("/api/snapshot/rhythm", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const [lastPnpRow] = await db.select({ createdAt: pnpOrders.createdAt }).from(pnpOrders).where(eq2(pnpOrders.clientId, clientId)).orderBy(desc(pnpOrders.createdAt)).limit(1);
      const lastPnpUpload = lastPnpRow?.createdAt?.toISOString() ?? null;
      const [lastXeroRow] = await db.select({ reference: stockTransactions.reference }).from(stockTransactions).where(
        and(
          eq2(stockTransactions.clientId, clientId),
          eq2(stockTransactions.transactionType, "SALES_OUT"),
          like(stockTransactions.reference, "%Xero import %")
        )
      ).orderBy(desc(stockTransactions.createdAt)).limit(1);
      let lastXeroImport = null;
      if (lastXeroRow?.reference) {
        const match = lastXeroRow.reference.match(/to\s+(\d{4}-\d{2}-\d{2})/);
        lastXeroImport = match ? match[1] : null;
      }
      const pendingRows = await db.select({
        manufacturerName: manufacturers.name,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        status: purchaseOrders.status
      }).from(purchaseOrders).innerJoin(manufacturers, eq2(purchaseOrders.manufacturerId, manufacturers.id)).where(
        and(
          eq2(purchaseOrders.clientId, clientId),
          inArray(purchaseOrders.status, ["SENT", "CONFIRMED"])
        )
      ).orderBy(asc(purchaseOrders.expectedDeliveryDate));
      const today = /* @__PURE__ */ new Date();
      const pendingDeliveries = pendingRows.map((row) => {
        let daysUntilDelivery = null;
        if (row.expectedDeliveryDate) {
          const expected = new Date(row.expectedDeliveryDate);
          daysUntilDelivery = Math.ceil(
            (expected.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24)
          );
        }
        return {
          manufacturer: row.manufacturerName,
          expectedDeliveryDate: row.expectedDeliveryDate,
          status: row.status,
          daysUntilDelivery
        };
      });
      res.json({ lastPnpUpload, lastXeroImport, pendingDeliveries });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch snapshot rhythm", error: err.message });
    }
  });
  return router2;
}

// server/xeroImport.ts
import multer from "multer";
import * as XLSX from "xlsx";
import { z as z2 } from "zod";
import { eq as eq3, and as and2, asc as asc2, desc as desc2, sql as sql3, like as like2 } from "drizzle-orm";
var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
var CHANNELS = {
  D: { name: "Direct", debitLocation: "THH" },
  W: { name: "Wholesale", debitLocation: "THH" },
  R: { name: "Retail", debitLocation: "THH" },
  C: { name: "PnP / 8/8", debitLocation: null },
  // No THH debit
  G: { name: "AP-Branded", debitLocation: "THH" }
};
function registerXeroRoutes(router2) {
  router2.post(
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
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet);
        const clientId = getClientId(req);
        const allProducts = await db.select().from(products).where(and2(eq3(products.clientId, clientId), eq3(products.isActive, true)));
        const productMap = new Map(allProducts.map((p) => [p.skuCode, p]));
        const apMappings = await db.select().from(apBrandMappings).where(eq3(apBrandMappings.clientId, clientId));
        const apMap = new Map(apMappings.map((m) => [m.apProductCode, m.thhSkuCode]));
        const parsed = [];
        for (const row of rawRows) {
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
          const channelCode = rawItemCode.slice(-1).toUpperCase();
          let baseSku = rawItemCode.slice(0, -1);
          const channelInfo = CHANNELS[channelCode];
          if (!channelInfo) {
            parsed.push({
              rawItemCode,
              baseSku: rawItemCode,
              channel: "?",
              channelName: "Unknown Channel",
              productName: rawName,
              quantity,
              mapped: false,
              skippedReason: `Unknown channel suffix: ${channelCode}`
            });
            continue;
          }
          const apMapping = apMap.get(baseSku);
          let effectiveChannel = channelCode;
          if (apMapping) {
            baseSku = apMapping;
            effectiveChannel = "G";
          }
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
              skippedReason: `SKU "${baseSku}" not found in product master`
            });
            continue;
          }
          if (effectiveChannel === "C") {
            parsed.push({
              rawItemCode,
              baseSku,
              channel: "C",
              channelName: "PnP / 8/8",
              productName: product.productName,
              quantity,
              mapped: true,
              skippedReason: "PnP channel \u2014 no THH stock debit"
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
            mapped: true
          });
        }
        const ledgerSetting = await db.select().from(systemSettings).where(and2(eq3(systemSettings.clientId, clientId), eq3(systemSettings.key, "ledger_start_date"))).limit(1);
        res.json({
          fromDate,
          toDate,
          totalRows: rawRows.length,
          parsed,
          ledgerStartDate: ledgerSetting[0]?.value ?? null
        });
      } catch (err) {
        console.error("Xero import preview error:", err);
        res.status(500).json({ message: "Failed to parse file", error: err.message });
      }
    }
  );
  const commitSchema = z2.object({
    fromDate: z2.string(),
    toDate: z2.string(),
    rows: z2.array(
      z2.object({
        baseSku: z2.string(),
        channel: z2.string(),
        quantity: z2.number().positive(),
        invoiceNumber: z2.string().optional()
      })
    )
  });
  router2.post("/api/xero/import/commit", isAuthenticated, async (req, res) => {
    try {
      const parsed = commitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const { fromDate, toDate, rows } = parsed.data;
      const userId = req.user?.id;
      const clientId = getClientId(req);
      const reference = `Xero import ${fromDate} to ${toDate}`;
      const existing = await db.select().from(stockTransactions).where(
        and2(
          eq3(stockTransactions.clientId, clientId),
          eq3(stockTransactions.transactionType, "SALES_OUT"),
          eq3(stockTransactions.reference, reference)
        )
      ).limit(1);
      if (existing.length > 0) {
        await db.delete(stockTransactions).where(
          and2(
            eq3(stockTransactions.clientId, clientId),
            eq3(stockTransactions.transactionType, "SALES_OUT"),
            eq3(stockTransactions.reference, reference)
          )
        );
      }
      const toDateObj = new Date(toDate);
      const periodMonth = toDateObj.getMonth() + 1;
      const periodYear = toDateObj.getFullYear();
      let created = 0;
      for (const row of rows) {
        if (row.channel === "C") continue;
        const debitLocation = CHANNELS[row.channel]?.debitLocation ?? "THH";
        const activeBatches = await db.select().from(batches).where(
          and2(
            eq3(batches.clientId, clientId),
            eq3(batches.skuCode, row.baseSku),
            eq3(batches.stockLocation, debitLocation),
            eq3(batches.isActive, true)
          )
        ).orderBy(asc2(batches.manufactureDate));
        let remainingQty = row.quantity;
        let batchId = activeBatches[0]?.id ?? null;
        const txReference = row.invoiceNumber ? `${row.invoiceNumber} (${reference})` : reference;
        await db.insert(stockTransactions).values({
          clientId,
          batchId,
          skuCode: row.baseSku,
          stockLocation: debitLocation,
          transactionType: "SALES_OUT",
          quantity: -row.quantity,
          // Negative for OUT
          transactionDate: toDate,
          periodMonth,
          periodYear,
          reference: txReference,
          channel: row.channel,
          createdBy: userId
        });
        created++;
      }
      logAudit(req, "XERO_IMPORT", {
        resourceType: "StockTransaction",
        detail: `Imported ${created} transactions from Xero Sales by Item (${fromDate} to ${toDate})`
      });
      res.json({ created, fromDate, toDate });
    } catch (err) {
      console.error("Xero import commit error:", err);
      res.status(500).json({ message: "Failed to commit import", error: err.message });
    }
  });
  router2.get("/api/xero/import/ledger-date", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const ledgerSetting = await db.select().from(systemSettings).where(and2(eq3(systemSettings.clientId, clientId), eq3(systemSettings.key, "ledger_start_date"))).limit(1);
      res.json({
        ledgerStartDate: ledgerSetting[0]?.value ?? null,
        hasOpeningBalance: ledgerSetting.length > 0
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch ledger date", error: err.message });
    }
  });
  router2.get("/api/xero/import/history", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const imports = await db.select({
        reference: stockTransactions.reference,
        transactionCount: sql3`count(*)`.as("transaction_count"),
        totalUnits: sql3`sum(abs(${stockTransactions.quantity}))`.as("total_units"),
        importedAt: sql3`min(${stockTransactions.createdAt})`.as("imported_at")
      }).from(stockTransactions).where(
        and2(
          eq3(stockTransactions.clientId, clientId),
          eq3(stockTransactions.transactionType, "SALES_OUT"),
          like2(stockTransactions.reference, "%Xero import %")
        )
      ).groupBy(stockTransactions.reference).orderBy(desc2(sql3`min(${stockTransactions.createdAt})`));
      const history = imports.map((imp) => {
        const match = imp.reference?.match(/Xero import (\S+) to (\S+)/);
        return {
          reference: imp.reference,
          fromDate: match?.[1] ?? null,
          toDate: match?.[2] ?? null,
          transactionCount: Number(imp.transactionCount),
          totalUnits: Number(imp.totalUnits),
          importedAt: imp.importedAt
        };
      });
      res.json(history);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch import history", error: err.message });
    }
  });
  return router2;
}

// server/pnpProcess.ts
import multer2 from "multer";
import * as XLSX2 from "xlsx";
import { z as z3 } from "zod";
import { eq as eq4, and as and3, desc as desc3, asc as asc3, sql as sql4, sum as sum2 } from "drizzle-orm";
var upload2 = multer2({ storage: multer2.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
var PNP_DCS = {
  MA15: "PnP Eastport Inland DC (Gauteng)",
  MA05: "Philippi DC Groceries (Western Cape)",
  KC37: "Cornubia (KwaZulu-Natal)",
  KC19: "Hyper Midlands Mall (KwaZulu-Natal)",
  EF05: "Family Queenstown (Eastern Cape)"
};
var DC_CODES = Object.keys(PNP_DCS);
function registerPnpRoutes(router2) {
  router2.post(
    "/api/pnp/upload",
    isAuthenticated,
    upload2.single("file"),
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
        let workbook;
        const fileName = req.file.originalname?.toLowerCase() ?? "";
        if (fileName.endsWith(".csv")) {
          const csvText = req.file.buffer.toString("utf-8");
          workbook = XLSX2.read(csvText, { type: "string" });
        } else {
          workbook = XLSX2.read(req.file.buffer, { type: "buffer" });
        }
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX2.utils.sheet_to_json(sheet);
        const clientId = getClientId(req);
        const mappings = await db.select().from(pnpProductMappings).where(eq4(pnpProductMappings.clientId, clientId));
        const mappingByName = new Map(mappings.map((m) => [m.pnpProductName.toLowerCase(), m.skuCode]));
        const allProducts = await db.select().from(products).where(and3(eq4(products.clientId, clientId), eq4(products.isActive, true)));
        const lines = [];
        for (const row of rawRows) {
          const productName = String(
            row["Product"] ?? row["Product Name"] ?? row["Description"] ?? row["Item"] ?? row["product"] ?? ""
          ).trim();
          if (!productName) continue;
          const dcQuantities = {};
          let hasAnyQty = false;
          for (const dc of DC_CODES) {
            let qty = 0;
            if (row[dc] !== void 0) {
              qty = Math.max(0, Math.round(Number(row[dc]) || 0));
            } else {
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
          let skuCode = null;
          let matched = false;
          const exactMatch = mappingByName.get(productName.toLowerCase());
          if (exactMatch) {
            skuCode = exactMatch;
            matched = true;
          }
          if (!matched) {
            for (const [mapName, mapSku] of mappingByName.entries()) {
              if (productName.toLowerCase().includes(mapName) || mapName.includes(productName.toLowerCase())) {
                skuCode = mapSku;
                matched = true;
                break;
              }
            }
          }
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
            dcQuantities
          });
        }
        res.json({
          weekEndingDate,
          appointmentTime: appointmentTime || null,
          fileName: req.file.originalname,
          lines
        });
      } catch (err) {
        console.error("PnP upload parse error:", err);
        res.status(500).json({ message: "Failed to parse file", error: err.message });
      }
    }
  );
  const createSchema = z3.object({
    weekEndingDate: z3.string(),
    appointmentTime: z3.string().optional().nullable(),
    fileName: z3.string().optional(),
    lines: z3.array(
      z3.object({
        skuCode: z3.string(),
        dcCode: z3.string(),
        dcName: z3.string(),
        orderedCases: z3.number().min(0),
        orderedUnits: z3.number().min(0)
      })
    )
  });
  router2.post("/api/pnp/create", isAuthenticated, async (req, res) => {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const { weekEndingDate, appointmentTime, fileName, lines } = parsed.data;
      const userId = req.user?.id;
      const clientId = getClientId(req);
      const [order] = await db.insert(pnpOrders).values({
        clientId,
        weekEndingDate,
        appointmentTime: appointmentTime ? new Date(appointmentTime) : null,
        uploadedFileName: fileName ?? null,
        status: "CONFIRMED",
        createdBy: userId
      }).returning();
      const allProducts = await db.select().from(products).where(and3(eq4(products.clientId, clientId), eq4(products.isActive, true)));
      const productMap = new Map(allProducts.map((p) => [p.skuCode, p]));
      const skuCodes = [...new Set(lines.map((l) => l.skuCode))];
      const stockBySkuResult = await db.select({
        skuCode: stockTransactions.skuCode,
        totalQty: sum2(stockTransactions.quantity)
      }).from(stockTransactions).where(
        and3(
          eq4(stockTransactions.clientId, clientId),
          eq4(stockTransactions.stockLocation, "88"),
          sql4`${stockTransactions.skuCode} = ANY(${skuCodes})`
        )
      ).groupBy(stockTransactions.skuCode);
      const stockBySku = new Map(stockBySkuResult.map((r) => [r.skuCode, Number(r.totalQty) || 0]));
      const totalOrderedBySku = /* @__PURE__ */ new Map();
      for (const line of lines) {
        const current = totalOrderedBySku.get(line.skuCode) || 0;
        totalOrderedBySku.set(line.skuCode, current + line.orderedUnits);
      }
      const createdLines = [];
      for (const line of lines) {
        if (line.orderedCases === 0 && line.orderedUnits === 0) continue;
        const available = stockBySku.get(line.skuCode) ?? 0;
        const product = productMap.get(line.skuCode);
        const unitsPerCase = product?.unitsPerCase ?? 1;
        const availableCases = Math.floor(available / unitsPerCase);
        const totalOrdered = totalOrderedBySku.get(line.skuCode) ?? 0;
        const totalOrderedCases = Math.ceil(totalOrdered / unitsPerCase);
        const shortfallCases = Math.max(0, totalOrderedCases - availableCases);
        const lineShortfall = shortfallCases > 0 ? Math.max(0, line.orderedCases - availableCases) : 0;
        const [created] = await db.insert(pnpOrderLines).values({
          clientId,
          pnpOrderId: order.id,
          skuCode: line.skuCode,
          dcCode: line.dcCode,
          dcName: line.dcName,
          orderedCases: line.orderedCases,
          orderedUnits: line.orderedUnits,
          availableCases,
          shortfallCases: lineShortfall
        }).returning();
        createdLines.push(created);
      }
      logAudit(req, "PNP_ORDER_CREATE", {
        resourceType: "PnpOrder",
        resourceId: String(order.id),
        detail: `Created PnP order for week ending ${weekEndingDate} with ${createdLines.length} lines`
      });
      res.json({
        order,
        lines: createdLines,
        stockCheck: Object.fromEntries(
          skuCodes.map((sku) => [
            sku,
            {
              availableUnits: stockBySku.get(sku) ?? 0,
              availableCases: Math.floor((stockBySku.get(sku) ?? 0) / (productMap.get(sku)?.unitsPerCase ?? 1))
            }
          ])
        )
      });
    } catch (err) {
      console.error("PnP order create error:", err);
      res.status(500).json({ message: "Failed to create order", error: err.message });
    }
  });
  router2.get("/api/pnp/orders", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      const orderList = await db.select().from(pnpOrders).where(eq4(pnpOrders.clientId, clientId)).orderBy(desc3(pnpOrders.createdAt));
      res.json(orderList);
    } catch (err) {
      console.error("PnP orders list error:", err);
      res.status(500).json({ message: "Failed to list orders", error: err.message });
    }
  });
  router2.get("/api/pnp/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }
      const clientId = getClientId(req);
      const [order] = await db.select().from(pnpOrders).where(and3(eq4(pnpOrders.clientId, clientId), eq4(pnpOrders.id, orderId)));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      const lines = await db.select().from(pnpOrderLines).where(and3(eq4(pnpOrderLines.clientId, clientId), eq4(pnpOrderLines.pnpOrderId, orderId)));
      const byDc = {};
      for (const line of lines) {
        if (!byDc[line.dcCode]) byDc[line.dcCode] = [];
        byDc[line.dcCode].push(line);
      }
      res.json({ order, lines, byDc });
    } catch (err) {
      console.error("PnP order detail error:", err);
      res.status(500).json({ message: "Failed to get order", error: err.message });
    }
  });
  router2.get("/api/pnp/orders/:id/dispatch-instruction", isAuthenticated, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }
      const clientId = getClientId(req);
      const [order] = await db.select().from(pnpOrders).where(and3(eq4(pnpOrders.clientId, clientId), eq4(pnpOrders.id, orderId)));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      const lines = await db.select().from(pnpOrderLines).where(and3(eq4(pnpOrderLines.clientId, clientId), eq4(pnpOrderLines.pnpOrderId, orderId)));
      const allProducts = await db.select().from(products).where(and3(eq4(products.clientId, clientId), eq4(products.isActive, true)));
      const productMap = new Map(allProducts.map((p) => [p.skuCode, p.productName]));
      const apptTime = order.appointmentTime ? new Date(order.appointmentTime).toLocaleString("en-ZA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }) : "TBC";
      const weekDate = order.weekEndingDate;
      const subject = `PnP Dispatch Instruction \u2014 Week of ${weekDate} \u2014 Appt ${apptTime}`;
      const byDc = {};
      for (const line of lines) {
        if (!byDc[line.dcCode]) byDc[line.dcCode] = [];
        byDc[line.dcCode].push(line);
      }
      let body = "";
      body += "APPOINTMENT\n";
      body += "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n";
      body += `Date/Time: ${apptTime}

`;
      body += "ORDER BY DISTRIBUTION CENTRE\n";
      body += "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n\n";
      for (const dcCode of DC_CODES) {
        const dcLines = byDc[dcCode];
        if (!dcLines || dcLines.length === 0) continue;
        body += `${dcCode} \u2014 ${PNP_DCS[dcCode]}
`;
        body += "\u2500".repeat(50) + "\n";
        body += "Product".padEnd(35) + "Cases".padStart(8) + "Units".padStart(8) + "\n";
        body += "\u2500".repeat(50) + "\n";
        for (const line of dcLines) {
          const name = (productMap.get(line.skuCode) ?? line.skuCode).substring(0, 34);
          body += name.padEnd(35) + String(line.orderedCases).padStart(8) + String(line.orderedUnits).padStart(8) + "\n";
        }
        body += "\n";
      }
      body += "INVOICE REFERENCE\n";
      body += "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n";
      body += "Xero Invoice: [TO BE ADDED]\n\n";
      body += "PRODUCT TOTALS (ALL DCs)\n";
      body += "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n";
      body += "Product".padEnd(35) + "Cases".padStart(8) + "Units".padStart(8) + "\n";
      body += "\u2500".repeat(50) + "\n";
      const totalsBySku = /* @__PURE__ */ new Map();
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
      const shortfallLines = lines.filter((l) => (l.shortfallCases ?? 0) > 0);
      body += "NOTES / SHORTFALLS\n";
      body += "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n";
      if (shortfallLines.length > 0) {
        for (const line of shortfallLines) {
          const name = productMap.get(line.skuCode) ?? line.skuCode;
          body += `\u26A0 ${name} at ${line.dcCode}: ordered ${line.orderedCases} cases, shortfall ${line.shortfallCases} cases
`;
        }
      } else {
        body += "No shortfalls identified. All stock available at 8/8.\n";
      }
      body += "\n";
      body += "Kind regards,\n";
      body += "Beryl Shuttleworth\n";
      body += "The Herbal Horse & Pet\n";
      res.json({ subject, body, order });
    } catch (err) {
      console.error("PnP dispatch instruction error:", err);
      res.status(500).json({ message: "Failed to generate dispatch instruction", error: err.message });
    }
  });
  router2.post("/api/pnp/orders/:id/dispatch", isAuthenticated, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }
      const clientId = getClientId(req);
      const [order] = await db.select().from(pnpOrders).where(and3(eq4(pnpOrders.clientId, clientId), eq4(pnpOrders.id, orderId)));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (order.status === "DISPATCHED") {
        return res.status(400).json({ message: "Order already dispatched" });
      }
      const lines = await db.select().from(pnpOrderLines).where(and3(eq4(pnpOrderLines.clientId, clientId), eq4(pnpOrderLines.pnpOrderId, orderId)));
      const userId = req.user?.id;
      const transactionDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const now = /* @__PURE__ */ new Date();
      const periodMonth = now.getMonth() + 1;
      const periodYear = now.getFullYear();
      for (const line of lines) {
        if (line.orderedUnits === 0) continue;
        const activeBatches = await db.select().from(batches).where(
          and3(
            eq4(batches.clientId, clientId),
            eq4(batches.skuCode, line.skuCode),
            eq4(batches.stockLocation, "88"),
            eq4(batches.isActive, true)
          )
        ).orderBy(asc3(batches.manufactureDate));
        const batchId = activeBatches[0]?.id ?? null;
        await db.insert(stockTransactions).values({
          clientId,
          batchId,
          skuCode: line.skuCode,
          stockLocation: "88",
          transactionType: "PNP_OUT",
          quantity: -line.orderedUnits,
          // Negative for OUT
          transactionDate,
          periodMonth,
          periodYear,
          reference: `PnP order #${orderId} \u2014 ${line.dcCode}`,
          channel: "C",
          createdBy: userId
        });
      }
      await db.update(pnpOrders).set({
        status: "DISPATCHED",
        dispatchInstructionSentAt: now
      }).where(and3(eq4(pnpOrders.clientId, clientId), eq4(pnpOrders.id, orderId)));
      const allProducts = await db.select().from(products).where(and3(eq4(products.clientId, clientId), eq4(products.isActive, true)));
      const productMap = new Map(allProducts.map((p) => [p.skuCode, p]));
      const affectedSkus = [...new Set(lines.map((l) => l.skuCode))];
      const lowStockAlerts = [];
      for (const sku of affectedSkus) {
        const product = productMap.get(sku);
        if (!product) continue;
        const [stockResult] = await db.select({ totalQty: sum2(stockTransactions.quantity) }).from(stockTransactions).where(
          and3(
            eq4(stockTransactions.clientId, clientId),
            eq4(stockTransactions.skuCode, sku),
            eq4(stockTransactions.stockLocation, "88")
          )
        );
        const currentStock = Number(stockResult?.totalQty) || 0;
        const reorderPoint = product.reorderPointOverride ?? 0;
        if (currentStock <= reorderPoint && reorderPoint > 0) {
          lowStockAlerts.push(sku);
          await db.insert(notifications).values({
            clientId,
            type: "LOW_STOCK_88",
            title: `Low 8/8 stock: ${product.productName}`,
            message: `After PnP dispatch, ${product.productName} (${sku}) is at ${currentStock} units at 8/8, below reorder point of ${reorderPoint}.`,
            resourceType: "Product",
            resourceId: sku
          });
        }
      }
      logAudit(req, "PNP_DISPATCH", {
        resourceType: "PnpOrder",
        resourceId: String(orderId),
        detail: `Dispatched PnP order #${orderId} \u2014 ${lines.length} lines, ${lowStockAlerts.length} low stock alerts`
      });
      res.json({
        success: true,
        orderId,
        transactionsCreated: lines.filter((l) => l.orderedUnits > 0).length,
        lowStockAlerts
      });
    } catch (err) {
      console.error("PnP dispatch error:", err);
      res.status(500).json({ message: "Failed to dispatch order", error: err.message });
    }
  });
  return router2;
}

// server/xeroAuth.ts
import { eq as eq5, and as and4 } from "drizzle-orm";
var XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
var XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
var XERO_API_BASE = "https://api.xero.com";
var XERO_SCOPES = "openid profile email offline_access accounting.invoices.read accounting.settings.read";
function getXeroRedirectUri() {
  return process.env.NODE_ENV === "production" ? `${process.env.PRODUCTION_URL}/auth/xero/callback` : "http://localhost:5000/auth/xero/callback";
}
async function getXeroTokens(clientId) {
  const result = await db.select().from(systemSettings).where(and4(eq5(systemSettings.clientId, clientId), eq5(systemSettings.key, "xero_tokens")));
  if (result.length === 0 || !result[0].value) return null;
  try {
    return JSON.parse(result[0].value);
  } catch {
    return null;
  }
}
async function saveXeroTokens(clientId, tokens) {
  const existing = await db.select().from(systemSettings).where(and4(eq5(systemSettings.clientId, clientId), eq5(systemSettings.key, "xero_tokens")));
  const value = JSON.stringify(tokens);
  if (existing.length > 0) {
    await db.update(systemSettings).set({ value, updatedAt: /* @__PURE__ */ new Date() }).where(and4(eq5(systemSettings.clientId, clientId), eq5(systemSettings.key, "xero_tokens")));
  } else {
    await db.insert(systemSettings).values({ clientId, key: "xero_tokens", value });
  }
}
async function refreshAccessToken(refreshToken) {
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
      ).toString("base64")}`
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
  if (!res.ok) {
    console.error("Xero token refresh failed:", await res.text());
    return null;
  }
  return res.json();
}
async function getValidAccessToken(clientId) {
  const tokens = await getXeroTokens(clientId);
  if (!tokens) return null;
  if (Date.now() > tokens.expiresAt - 5 * 60 * 1e3) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    if (!refreshed) return null;
    const newTokens = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: Date.now() + refreshed.expires_in * 1e3,
      tenantId: tokens.tenantId
    };
    await saveXeroTokens(clientId, newTokens);
    return { accessToken: newTokens.accessToken, tenantId: newTokens.tenantId };
  }
  return { accessToken: tokens.accessToken, tenantId: tokens.tenantId };
}
function registerXeroAuthRoutes(router2) {
  router2.get("/auth/xero", isAuthenticated, (_req, res) => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.XERO_CLIENT_ID,
      redirect_uri: getXeroRedirectUri(),
      scope: XERO_SCOPES,
      state: "xero-connect"
    });
    res.redirect(`${XERO_AUTH_URL}?${params}`);
  });
  router2.get("/auth/xero/callback", async (req, res) => {
    const { code, error } = req.query;
    const clientUrl = process.env.NODE_ENV === "production" ? "" : "http://localhost:5173";
    if (error || !code) {
      return res.redirect(`${clientUrl}/settings?xero=error&message=${error ?? "no_code"}`);
    }
    try {
      const tokenRes = await fetch(XERO_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
          ).toString("base64")}`
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: String(code),
          redirect_uri: getXeroRedirectUri()
        })
      });
      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("Xero token exchange failed:", errText);
        return res.redirect(`${clientUrl}/settings?xero=error&message=token_exchange_failed`);
      }
      const tokenData = await tokenRes.json();
      const connectionsRes = await fetch(`${XERO_API_BASE}/connections`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const connections = await connectionsRes.json();
      if (!connections.length) {
        return res.redirect(`${clientUrl}/settings?xero=error&message=no_organisation`);
      }
      const tenantId = connections[0].tenantId;
      const tenantName = connections[0].tenantName;
      const clientId = getClientId(req);
      await saveXeroTokens(clientId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1e3,
        tenantId
      });
      const existing = await db.select().from(systemSettings).where(and4(eq5(systemSettings.clientId, clientId), eq5(systemSettings.key, "xero_org_name")));
      if (existing.length > 0) {
        await db.update(systemSettings).set({ value: tenantName, updatedAt: /* @__PURE__ */ new Date() }).where(and4(eq5(systemSettings.clientId, clientId), eq5(systemSettings.key, "xero_org_name")));
      } else {
        await db.insert(systemSettings).values({ clientId, key: "xero_org_name", value: tenantName });
      }
      res.redirect(`${clientUrl}/settings?xero=connected&org=${encodeURIComponent(tenantName)}`);
    } catch (err) {
      console.error("Xero OAuth error:", err);
      res.redirect(`${clientUrl}/settings?xero=error&message=${err.message}`);
    }
  });
  router2.get("/api/xero/status", isAuthenticated, async (req, res) => {
    const clientId = getClientId(req);
    const tokens = await getXeroTokens(clientId);
    const orgName = await db.select().from(systemSettings).where(and4(eq5(systemSettings.clientId, clientId), eq5(systemSettings.key, "xero_org_name")));
    res.json({
      connected: !!tokens,
      organisationName: orgName[0]?.value ?? null,
      tokenExpiry: tokens?.expiresAt ? new Date(tokens.expiresAt).toISOString() : null
    });
  });
  router2.post("/api/xero/disconnect", isAuthenticated, async (req, res) => {
    const clientId = getClientId(req);
    await db.delete(systemSettings).where(and4(eq5(systemSettings.clientId, clientId), eq5(systemSettings.key, "xero_tokens")));
    await db.delete(systemSettings).where(and4(eq5(systemSettings.clientId, clientId), eq5(systemSettings.key, "xero_org_name")));
    logAudit(req, "XERO_DISCONNECTED");
    res.json({ ok: true });
  });
  router2.get("/api/xero/sales-report", isAuthenticated, async (req, res) => {
    try {
      const { fromDate, toDate } = req.query;
      if (!fromDate || !toDate) {
        return res.status(400).json({ message: "fromDate and toDate are required" });
      }
      const auth = await getValidAccessToken(getClientId(req));
      if (!auth) {
        return res.status(401).json({
          message: "Xero not connected. Please connect via Settings.",
          notConnected: true
        });
      }
      let allInvoices = [];
      let page = 1;
      while (true) {
        const invoicesUrl = `${XERO_API_BASE}/api.xro/2.0/Invoices?where=Type%3D%22ACCREC%22%20AND%20Date%3E%3DDateTime(${String(fromDate).replace(/-/g, "%2C")})%20AND%20Date%3C%3DDateTime(${String(toDate).replace(/-/g, "%2C")})&page=${page}`;
        const invoiceRes = await fetch(invoicesUrl, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            "Xero-Tenant-Id": auth.tenantId,
            Accept: "application/json"
          }
        });
        if (!invoiceRes.ok) {
          const errBody = await invoiceRes.text();
          console.error("Xero API error:", invoiceRes.status, errBody);
          if (invoiceRes.status === 401) {
            return res.status(401).json({
              message: "Xero token expired. Please reconnect via Settings.",
              notConnected: true
            });
          }
          return res.status(502).json({ message: "Xero API error", detail: errBody });
        }
        const data = await invoiceRes.json();
        const invoices = data.Invoices ?? [];
        allInvoices = allInvoices.concat(invoices);
        if (invoices.length < 100) break;
        page++;
      }
      const lineItems = [];
      for (const inv of allInvoices) {
        const fullInvRes = await fetch(
          `${XERO_API_BASE}/api.xro/2.0/Invoices/${inv.InvoiceID}`,
          {
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
              "Xero-Tenant-Id": auth.tenantId,
              Accept: "application/json"
            }
          }
        );
        if (!fullInvRes.ok) continue;
        const fullInvData = await fullInvRes.json();
        const fullInv = fullInvData.Invoices?.[0];
        if (!fullInv) continue;
        for (const line of fullInv.LineItems ?? []) {
          if (!line.ItemCode || !line.Quantity) continue;
          lineItems.push({
            invoiceNumber: fullInv.InvoiceNumber ?? fullInv.InvoiceID,
            invoiceDate: fullInv.DateString ?? fullInv.Date,
            contactName: fullInv.Contact?.Name ?? "",
            itemCode: line.ItemCode,
            description: line.Description ?? "",
            quantity: line.Quantity ?? 0,
            unitPrice: line.UnitAmount ?? 0,
            lineAmount: line.LineAmount ?? 0
          });
        }
      }
      const aggregated = {};
      for (const li of lineItems) {
        if (!aggregated[li.itemCode]) {
          aggregated[li.itemCode] = {
            itemCode: li.itemCode,
            description: li.description,
            quantity: 0,
            invoiceCount: 0
          };
        }
        aggregated[li.itemCode].quantity += li.quantity;
        aggregated[li.itemCode].invoiceCount++;
      }
      const summary = Object.values(aggregated).sort(
        (a, b) => a.itemCode.localeCompare(b.itemCode)
      );
      logAudit(req, "XERO_REPORT_PULLED", {
        detail: `Pulled sales data from ${fromDate} to ${toDate}: ${lineItems.length} line items from ${allInvoices.length} invoices`
      });
      res.json({
        fromDate,
        toDate,
        invoiceCount: allInvoices.length,
        lineItemCount: lineItems.length,
        // Individual line items (for commit — each becomes a stock transaction)
        lineItems,
        // Aggregated summary (for preview display)
        summary
      });
    } catch (err) {
      console.error("Xero sales report error:", err);
      res.status(500).json({ message: "Failed to fetch Xero sales data", error: err.message });
    }
  });
  return router2;
}

// server/openingBalanceImport.ts
import multer3 from "multer";
import * as XLSX3 from "xlsx";
import { eq as eq6, and as and5 } from "drizzle-orm";
var upload3 = multer3({ storage: multer3.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
var SKU_MAP = {
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
  ItM2000: "ItM500",
  // sheet has ItM2000 but our system may not — map to closest
  MM250: "MM250",
  MM2000: "MM250",
  // MM only has 250g in our system
  RM500: "RM500",
  RM2000: "RM2000",
  UM500: "UM500",
  UM2000: "UM2000",
  SHM500: "SHM500",
  // Pet formulas — sheet uses AF200, we use AF200G
  AF200: "AF200G",
  AF500: "AF500G",
  EF200: "EF200G",
  EF500: "EF200G",
  // EF only has 200g in our system
  JF200: "JF200G",
  JF500: "JF500G",
  "HP O3F75": "O3F75G",
  PCF240: "PCF240G",
  PCF500: "PCF500G",
  SF200: "SF200G",
  SF500: "SF200G",
  // SF only has 40g and 200g; map 500 to 200 as closest
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
  NPTFS200: "NPTFS200"
};
function parseRowData(data) {
  const rows = [];
  for (let d = 0; d < Math.min(5, data.length); d++) {
    console.log(`Row ${d}:`, JSON.stringify(data[d]?.slice(0, 12)));
  }
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;
    const code = String(row[1] ?? "").trim();
    if (!code || code === "Code" || code === "") continue;
    const parseNum = (val) => {
      if (val === null || val === void 0 || val === "") return 0;
      const n = Number(val);
      return isNaN(n) ? 0 : Math.round(n);
    };
    const totalStock = parseNum(row[3]);
    const reorderPointRaw = Number(row[4]);
    const eightEightStock = parseNum(row[6]);
    const thhStock = parseNum(row[8]);
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
      matchIssue: skuCode ? void 0 : `No SKU mapping for code "${code}"`
    });
  }
  return rows;
}
function parseSummarySheet(buffer) {
  const wb = XLSX3.read(buffer, { type: "buffer" });
  const summary = wb.Sheets["Summary master"];
  if (!summary) throw new Error("Sheet 'Summary master' not found in the workbook.");
  const data = XLSX3.utils.sheet_to_json(summary, { header: 1, defval: "" });
  return parseRowData(data);
}
function registerOpeningBalanceRoutes(router2) {
  router2.post(
    "/api/stock-in/opening-balance/preview",
    isAuthenticated,
    upload3.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }
        const parsed = parseSummarySheet(req.file.buffer);
        const clientId = getClientId(req);
        const allProducts = await db.select().from(products).where(and5(eq6(products.clientId, clientId), eq6(products.isActive, true)));
        const productMap = new Map(allProducts.map((p) => [p.skuCode, p]));
        const enriched = parsed.map((row) => {
          if (row.skuCode && !productMap.has(row.skuCode)) {
            return {
              ...row,
              matched: false,
              matchIssue: `SKU "${row.skuCode}" mapped but not found in product master`
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
            totalRows: enriched.length
          }
        });
      } catch (err) {
        console.error("Opening balance preview error:", err);
        res.status(500).json({ message: "Failed to parse file", error: err.message });
      }
    }
  );
  router2.post("/api/stock-in/opening-balance/commit", isAuthenticated, async (req, res) => {
    try {
      const { rows, asOfDate } = req.body;
      if (!rows || !Array.isArray(rows) || !asOfDate) {
        return res.status(400).json({ message: "rows and asOfDate are required" });
      }
      const userId = req.user?.id;
      const clientId = getClientId(req);
      const dateObj = new Date(asOfDate);
      const periodMonth = dateObj.getMonth() + 1;
      const periodYear = dateObj.getFullYear();
      const reference = `Opening balance as of ${asOfDate}`;
      const existing = await db.select().from(stockTransactions).where(and5(eq6(stockTransactions.clientId, clientId), eq6(stockTransactions.reference, reference))).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({
          message: `Opening balances for ${asOfDate} have already been imported. Delete existing records first to re-import.`
        });
      }
      let created = 0;
      for (const row of rows) {
        if (!row.skuCode || !row.matched) continue;
        if (row.thhStock > 0) {
          const [batch] = await db.insert(batches).values({
            clientId,
            skuCode: row.skuCode,
            sizeVariant: row.size || "opening",
            stockLocation: "THH",
            batchNumber: `OB-${asOfDate}-${row.skuCode}`,
            manufactureDate: asOfDate,
            expiryDate: new Date(dateObj.getFullYear() + 2, dateObj.getMonth(), dateObj.getDate()).toISOString().split("T")[0],
            initialQuantity: row.thhStock,
            isActive: true,
            receivedDate: asOfDate,
            deliveryNoteRef: "Opening Balance",
            notes: `Opening balance imported from Animal Farm spreadsheet`
          }).returning();
          await db.insert(stockTransactions).values({
            clientId,
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
            notes: "Opening balance from Animal Farm"
          });
          created++;
        }
        if (row.eightEightStock > 0) {
          const [batch] = await db.insert(batches).values({
            clientId,
            skuCode: row.skuCode,
            sizeVariant: row.size || "opening",
            stockLocation: "88",
            batchNumber: `OB-${asOfDate}-${row.skuCode}-88`,
            manufactureDate: asOfDate,
            expiryDate: new Date(dateObj.getFullYear() + 2, dateObj.getMonth(), dateObj.getDate()).toISOString().split("T")[0],
            initialQuantity: row.eightEightStock,
            isActive: true,
            receivedDate: asOfDate,
            deliveryNoteRef: "Opening Balance",
            notes: `Opening balance imported from Animal Farm spreadsheet`
          }).returning();
          await db.insert(stockTransactions).values({
            clientId,
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
            notes: "Opening balance from Animal Farm"
          });
          created++;
        }
        if (row.reorderPoint !== null && row.reorderPoint > 0) {
          await db.update(products).set({ reorderPointOverride: row.reorderPoint }).where(and5(eq6(products.clientId, clientId), eq6(products.skuCode, row.skuCode)));
        }
      }
      const existingLedgerDate = await db.select().from(systemSettings).where(and5(eq6(systemSettings.clientId, clientId), eq6(systemSettings.key, "ledger_start_date"))).limit(1);
      if (existingLedgerDate.length > 0) {
        await db.update(systemSettings).set({ value: asOfDate, updatedAt: /* @__PURE__ */ new Date() }).where(and5(eq6(systemSettings.clientId, clientId), eq6(systemSettings.key, "ledger_start_date")));
      } else {
        await db.insert(systemSettings).values({
          clientId,
          key: "ledger_start_date",
          value: asOfDate
        });
      }
      logAudit(req, "OPENING_BALANCE_IMPORT", {
        resourceType: "StockTransaction",
        detail: `Imported ${created} opening balance transactions as of ${asOfDate}. Ledger start date set to ${asOfDate}.`
      });
      res.json({ created, asOfDate });
    } catch (err) {
      console.error("Opening balance commit error:", err);
      res.status(500).json({ message: "Failed to import opening balances", error: err.message });
    }
  });
  router2.get("/api/stock-in/opening-balance/pull-sheet", isAuthenticated, async (req, res) => {
    try {
      const googleAccessToken = req.user?.googleAccessToken;
      if (!googleAccessToken) {
        return res.status(401).json({
          message: "Google Sheets access not available. Please sign out and sign in again to grant Sheets permission.",
          needsReauth: true
        });
      }
      const sheetId = process.env.ANIMAL_FARM_SHEET_ID;
      if (!sheetId) {
        return res.status(400).json({
          message: "ANIMAL_FARM_SHEET_ID not configured in environment."
        });
      }
      let parsed;
      const sheetName = "Summary master";
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;
      const sheetsRes = await fetch(sheetsUrl, {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          Accept: "application/json"
        }
      });
      if (sheetsRes.ok) {
        const sheetsData = await sheetsRes.json();
        const rawRows = sheetsData.values ?? [];
        parsed = parseRowData(rawRows);
      } else {
        console.log("Sheets API failed, trying Drive API download...");
        const driveUrl = `https://www.googleapis.com/drive/v3/files/${sheetId}?alt=media`;
        const driveRes = await fetch(driveUrl, {
          headers: {
            Authorization: `Bearer ${googleAccessToken}`
          }
        });
        if (!driveRes.ok) {
          const exportUrl = `https://www.googleapis.com/drive/v3/files/${sheetId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
          const exportRes = await fetch(exportUrl, {
            headers: {
              Authorization: `Bearer ${googleAccessToken}`
            }
          });
          if (!exportRes.ok) {
            const errBody = await exportRes.text();
            console.error("Google Drive export error:", exportRes.status, errBody);
            if (exportRes.status === 401 || exportRes.status === 403) {
              return res.status(401).json({
                message: "Google Drive permission denied or token expired. Please sign out and sign in again.",
                needsReauth: true
              });
            }
            return res.status(502).json({
              message: `Could not access the Animal Farm file. Check that the file ID is correct and you have access. (${exportRes.status})`
            });
          }
          const buffer = Buffer.from(await exportRes.arrayBuffer());
          parsed = parseSummarySheet(buffer);
        } else {
          const buffer = Buffer.from(await driveRes.arrayBuffer());
          parsed = parseSummarySheet(buffer);
        }
      }
      const clientId = getClientId(req);
      const allProducts = await db.select().from(products).where(and5(eq6(products.clientId, clientId), eq6(products.isActive, true)));
      const productMap = new Map(allProducts.map((p) => [p.skuCode, p]));
      const enriched = parsed.map((row) => {
        if (row.skuCode && !productMap.has(row.skuCode)) {
          return {
            ...row,
            matched: false,
            matchIssue: `SKU "${row.skuCode}" mapped but not found in product master`
          };
        }
        return row;
      });
      const matchedCount = enriched.filter((r) => r.matched).length;
      const unmatchedCount = enriched.filter((r) => !r.matched).length;
      const totalThhUnits = enriched.filter((r) => r.matched).reduce((s, r) => s + r.thhStock, 0);
      const totalEeUnits = enriched.filter((r) => r.matched).reduce((s, r) => s + r.eightEightStock, 0);
      logAudit(req, "GOOGLE_SHEET_PULLED", {
        detail: `Pulled Animal Farm data from Google Sheets: ${enriched.length} rows, ${matchedCount} matched`
      });
      res.json({
        rows: enriched,
        summary: {
          matchedCount,
          unmatchedCount,
          totalThhUnits,
          totalEeUnits,
          totalRows: enriched.length
        },
        source: "Google Sheets (live)"
      });
    } catch (err) {
      console.error("Google Sheets pull error:", err);
      res.status(500).json({ message: "Failed to pull from Google Sheets", error: err.message });
    }
  });
  router2.get("/api/stock-in/opening-balance/debug-sheet", isAuthenticated, async (req, res) => {
    try {
      const googleAccessToken = req.user?.googleAccessToken;
      if (!googleAccessToken) return res.status(401).json({ message: "No Google token" });
      const sheetId = process.env.ANIMAL_FARM_SHEET_ID;
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Summary%20master?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;
      const sheetsRes = await fetch(sheetsUrl, {
        headers: { Authorization: `Bearer ${googleAccessToken}`, Accept: "application/json" }
      });
      if (!sheetsRes.ok) {
        return res.json({ sheetsApiError: sheetsRes.status, body: await sheetsRes.text() });
      }
      const data = await sheetsRes.json();
      const rows = (data.values ?? []).slice(0, 10);
      res.json({ source: "Sheets API", rowCount: data.values?.length, sampleRows: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  return router2;
}

// server/api.ts
var app = express();
var PgSession = connectPgSimple(session);
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: ["https://mycanary.biz", "https://www.mycanary.biz"],
    credentials: true
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL_PRODUCTION ?? process.env.DATABASE_URL,
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1e3,
      httpOnly: true,
      secure: true,
      sameSite: "lax"
    }
  })
);
app.use(auth_default.initialize());
app.use(auth_default.session());
app.get("/auth/google", auth_default.authenticate("google"));
app.get(
  "/auth/callback",
  auth_default.authenticate("google", { failureRedirect: "/?error=auth_failed" }),
  (_req, res) => res.redirect("/")
);
app.post("/auth/logout", (req, res) => {
  req.logout(() => res.json({ ok: true }));
});
app.use(clientContext);
var router = express.Router();
registerRoutes(router);
registerXeroRoutes(router);
registerXeroAuthRoutes(router);
registerPnpRoutes(router);
registerOpeningBalanceRoutes(router);
app.use(router);
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});
var api_default = app;
export {
  api_default as default
};
