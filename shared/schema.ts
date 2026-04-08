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
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Platform: Clients ──────────────────────────────────────
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(), // subdomain: slug.mycanary.biz
  isActive: boolean("is_active").default(true).notNull(),
  setupComplete: boolean("setup_complete").default(false).notNull(),
  setupProgress: json("setup_progress"), // { products, suppliers, openingStock, reorderPoints, salesData }
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Platform: Auth & Users (NO clientId) ───────────────────
export const sessions = pgTable("sessions", {
  sid: varchar("sid", { length: 255 }).primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { withTimezone: true }).notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  profileImageUrl: text("profile_image_url"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userClients = pgTable("user_clients", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  role: varchar("role", { length: 20 }).default("member").notNull(), // owner, admin, member
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const invitedUsers = pgTable("invited_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  invitedBy: integer("invited_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  cell: varchar("cell", { length: 50 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Platform: Audit Logs (NO clientId) ─────────────────────
export const auditLogs = pgTable("audit_logs", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Client-Scoped: Manufacturers ───────────────────────────
export const manufacturers = pgTable("manufacturers", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  standardLeadTimeDays: integer("standard_lead_time_days").default(40).notNull(),
  maxLeadTimeDays: integer("max_lead_time_days").default(60).notNull(),
  poFormatNotes: text("po_format_notes"),
  moqNotes: text("moq_notes"),
});

// ─── Client-Scoped: Products ────────────────────────────────
export const products = pgTable("products", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("products_client_sku_idx").on(table.clientId, table.skuCode),
]);

// ─── Client-Scoped: Batches ─────────────────────────────────
export const batches = pgTable("batches", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Client-Scoped: Stock Transactions ──────────────────────
export const stockTransactions = pgTable("stock_transactions", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Client-Scoped: Purchase Orders ─────────────────────────
export const purchaseOrders = pgTable("purchase_orders", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  poId: integer("po_id").references(() => purchaseOrders.id).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  sizeVariant: varchar("size_variant", { length: 50 }).notNull(),
  quantityOrdered: integer("quantity_ordered").notNull(),
  triggerReason: text("trigger_reason"),
});

// ─── Client-Scoped: PnP Orders ──────────────────────────────
export const pnpOrders = pgTable("pnp_orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  weekEndingDate: date("week_ending_date").notNull(),
  appointmentTime: timestamp("appointment_time", { withTimezone: true }),
  uploadedFileName: varchar("uploaded_file_name", { length: 255 }),
  uploadDate: timestamp("upload_date", { withTimezone: true }).defaultNow(),
  status: varchar("status", { length: 30 }).default("UPLOADED").notNull(),
  dispatchInstructionSentAt: timestamp("dispatch_instruction_sent_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pnpOrderLines = pgTable("pnp_order_lines", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  pnpOrderId: integer("pnp_order_id").references(() => pnpOrders.id).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  dcCode: varchar("dc_code", { length: 10 }).notNull(),
  dcName: varchar("dc_name", { length: 100 }).notNull(),
  orderedCases: integer("ordered_cases").notNull(),
  orderedUnits: integer("ordered_units").notNull(),
  availableCases: integer("available_cases"),
  shortfallCases: integer("shortfall_cases").default(0),
});

// ─── Client-Scoped: Email Orders ────────────────────────────
export const orders = pgTable("orders", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderLines = pgTable("order_lines", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
  sizeVariant: varchar("size_variant", { length: 50 }),
  quantityOrdered: integer("quantity_ordered").notNull(),
  availableQuantity: integer("available_quantity"),
  shortfall: integer("shortfall").default(0),
});

// ─── Client-Scoped: Notifications ───────────────────────────
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  isRead: boolean("is_read").default(false).notNull(),
  userId: integer("user_id").references(() => users.id),
  resourceType: varchar("resource_type", { length: 100 }),
  resourceId: varchar("resource_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Client-Scoped: System Settings ─────────────────────────
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("system_settings_client_key_idx").on(table.clientId, table.key),
]);

// ─── Client-Scoped: Raw Materials ───────────────────────────
export const rawMaterials = pgTable("raw_materials", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  currentStock: integer("current_stock").default(0),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }),
  supplier: varchar("supplier", { length: 255 }),
  reorderFlag: boolean("reorder_flag").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const productRawMaterials = pgTable("product_raw_materials", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  rawMaterialId: integer("raw_material_id").references(() => rawMaterials.id).notNull(),
  quantityPerBatch: integer("quantity_per_batch"),
  notes: text("notes"),
});

// ─── Client-Scoped: PnP Product Mapping ─────────────────────
export const pnpProductMappings = pgTable("pnp_product_mappings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  pnpProductName: varchar("pnp_product_name", { length: 255 }).notNull(),
  skuCode: varchar("sku_code", { length: 50 }).notNull(),
});

// ─── Client-Scoped: AP Brand Mapping ────────────────────────
export const apBrandMappings = pgTable("ap_brand_mappings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  apProductCode: varchar("ap_product_code", { length: 50 }).notNull(),
  thhSkuCode: varchar("thh_sku_code", { length: 50 }).notNull(),
  apProductName: varchar("ap_product_name", { length: 255 }),
});
