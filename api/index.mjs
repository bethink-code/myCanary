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
  json
} from "drizzle-orm/pg-core";
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
  skuCode: varchar("sku_code", { length: 50 }).notNull().unique(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  brand: varchar("brand", { length: 10 }).notNull(),
  // THH or NP
  category: varchar("category", { length: 50 }).notNull(),
  // HORSE_MIX, PET_FORMULA, CHEW, SPRAY, SHAMPOO, GRAVY, OTHER
  packSizeG: integer("pack_size_g"),
  unitsPerCase: integer("units_per_case"),
  manufacturerId: integer("manufacturer_id").references(() => manufacturers.id),
  primaryStockLocation: varchar("primary_stock_location", { length: 10 }).default("THH").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  xeroItemCode: varchar("xero_item_code", { length: 50 }),
  apBrandEquivalent: varchar("ap_brand_equivalent", { length: 50 }),
  reorderPointOverride: integer("reorder_point_override"),
  weightKg: integer("weight_kg"),
  // for courier booking
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var batches = pgTable("batches", {
  id: serial("id").primaryKey(),
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
  batchId: integer("batch_id").references(() => batches.id),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  stockLocation: varchar("stock_location", { length: 10 }).notNull(),
  transactionType: varchar("transaction_type", { length: 30 }).notNull(),
  // DELIVERY_IN, SALES_OUT, PNP_OUT, TRANSFER_THH_TO_88, ADJUSTMENT
  quantity: integer("quantity").notNull(),
  // positive for IN, negative for OUT
  transactionDate: date("transaction_date").notNull(),
  periodMonth: integer("period_month").notNull(),
  periodYear: integer("period_year").notNull(),
  reference: varchar("reference", { length: 255 }),
  channel: varchar("channel", { length: 5 }),
  // D, W, R, C, G
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
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
  poId: integer("po_id").references(() => purchaseOrders.id).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  sizeVariant: varchar("size_variant", { length: 50 }).notNull(),
  quantityOrdered: integer("quantity_ordered").notNull(),
  triggerReason: text("trigger_reason")
});
var pnpOrders = pgTable("pnp_orders", {
  id: serial("id").primaryKey(),
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
  // Website, Takealot, Wholesale, Retail, Other
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
  orderId: integer("order_id").references(() => orders.id).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  sizeVariant: varchar("size_variant", { length: 50 }),
  quantityOrdered: integer("quantity_ordered").notNull(),
  availableQuantity: integer("available_quantity"),
  shortfall: integer("shortfall").default(0)
});
var notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
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
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var rawMaterials = pgTable("raw_materials", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  currentStock: integer("current_stock").default(0),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }),
  supplier: varchar("supplier", { length: 255 }),
  reorderFlag: boolean("reorder_flag").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var productRawMaterials = pgTable("product_raw_materials", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  rawMaterialId: integer("raw_material_id").references(() => rawMaterials.id).notNull(),
  quantityPerBatch: integer("quantity_per_batch"),
  notes: text("notes")
});
var pnpProductMappings = pgTable("pnp_product_mappings", {
  id: serial("id").primaryKey(),
  pnpProductName: varchar("pnp_product_name", { length: 255 }).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull()
});
var apBrandMappings = pgTable("ap_brand_mappings", {
  id: serial("id").primaryKey(),
  apProductCode: varchar("ap_product_code", { length: 50 }).notNull().unique(),
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
  done(null, user.email);
});
passport.deserializeUser(async (email, done) => {
  try {
    const user = await findUserByEmail(email);
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
      callbackURL: "/auth/callback",
      scope: ["profile", "email"]
    },
    async (_accessToken, _refreshToken, profile, done) => {
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
import { desc } from "drizzle-orm";
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Not authenticated" });
}
function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user?.isAdmin) return next();
  res.status(403).json({ message: "Admin access required" });
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
  router2.get("/api/admin/users", isAdmin, async (_req, res) => {
    const result = await getAllUsers();
    res.json(result);
  });
  router2.patch("/api/admin/users/:id/admin", isAdmin, async (req, res) => {
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
  router2.get("/api/admin/invites", isAdmin, async (_req, res) => {
    const result = await getInvitedUsers();
    res.json(result);
  });
  router2.post("/api/admin/invites", isAdmin, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const user = req.user;
    const result = await addInvitedUser(email, user.id);
    logAudit(req, "INVITE_CREATED", { resourceType: "Invite", detail: email });
    res.json(result[0]);
  });
  router2.delete("/api/admin/invites/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await removeInvitedUser(id);
    logAudit(req, "INVITE_REMOVED", { resourceType: "Invite", resourceId: String(id) });
    res.json({ ok: true });
  });
  router2.get("/api/admin/access-requests", isAdmin, async (_req, res) => {
    const result = await getAccessRequests();
    res.json(result);
  });
  router2.patch("/api/admin/access-requests/:id", isAdmin, async (req, res) => {
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
  router2.get("/api/admin/audit-logs", isAdmin, async (_req, res) => {
    const result = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200);
    res.json(result);
  });
  router2.get("/api/admin/security-overview", isAdmin, async (_req, res) => {
    const allUsers = await getAllUsers();
    const admins = allUsers.filter((u) => u.isAdmin);
    res.json({
      totalUsers: allUsers.length,
      adminCount: admins.length,
      recentLogins: allUsers.filter((u) => u.createdAt).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)
    });
  });
  return router2;
}

// server/api.ts
var app = express();
var PgSession = connectPgSimple(session);
app.use(helmet());
app.use(
  cors({
    origin: process.env.PRODUCTION_URL,
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
var router = express.Router();
registerRoutes(router);
app.use(router);
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});
var api_default = app;
export {
  api_default as default
};
