CREATE TABLE "access_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"cell" varchar(50),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ap_brand_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"ap_product_code" varchar(50) NOT NULL,
	"thh_sku_code" varchar(50) NOT NULL,
	"ap_product_name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100),
	"resource_id" varchar(255),
	"outcome" varchar(50),
	"detail" text,
	"ip_address" varchar(45),
	"before_value" json,
	"after_value" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"sku_code" varchar(50) NOT NULL,
	"size_variant" varchar(50) NOT NULL,
	"stock_location" varchar(10) NOT NULL,
	"batch_number" varchar(100) NOT NULL,
	"manufacture_date" date NOT NULL,
	"expiry_date" date NOT NULL,
	"initial_quantity" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"received_date" date NOT NULL,
	"delivery_note_ref" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"setup_complete" boolean DEFAULT false NOT NULL,
	"setup_progress" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "invited_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"invited_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invited_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "manufacturers" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"contact_person" varchar(255),
	"phone" varchar(50),
	"standard_lead_time_days" integer DEFAULT 40 NOT NULL,
	"max_lead_time_days" integer DEFAULT 60 NOT NULL,
	"po_format_notes" text,
	"moq_notes" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"user_id" integer,
	"resource_type" varchar(100),
	"resource_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"sku_code" varchar(50) NOT NULL,
	"size_variant" varchar(50),
	"quantity_ordered" integer NOT NULL,
	"available_quantity" integer,
	"shortfall" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"order_date" date NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"customer_email" varchar(255),
	"customer_phone" varchar(50),
	"delivery_street" text,
	"delivery_suburb" varchar(255),
	"delivery_city" varchar(255),
	"delivery_province" varchar(100),
	"delivery_postal_code" varchar(10),
	"sales_channel" varchar(20) NOT NULL,
	"order_reference" varchar(100),
	"special_instructions" text,
	"status" varchar(30) DEFAULT 'RECEIVED' NOT NULL,
	"courier_service" varchar(50),
	"waybill_number" varchar(100),
	"xero_invoice_ref" varchar(100),
	"created_by" integer,
	"approved_by" integer,
	"dispatched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pnp_order_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"pnp_order_id" integer NOT NULL,
	"sku_code" varchar(50) NOT NULL,
	"dc_code" varchar(10) NOT NULL,
	"dc_name" varchar(100) NOT NULL,
	"ordered_cases" integer NOT NULL,
	"ordered_units" integer NOT NULL,
	"available_cases" integer,
	"shortfall_cases" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "pnp_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"week_ending_date" date NOT NULL,
	"appointment_time" timestamp with time zone,
	"uploaded_file_name" varchar(255),
	"upload_date" timestamp with time zone DEFAULT now(),
	"status" varchar(30) DEFAULT 'UPLOADED' NOT NULL,
	"dispatch_instruction_sent_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pnp_product_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"pnp_product_name" varchar(255) NOT NULL,
	"sku_code" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"sku_code" varchar(50) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"brand" varchar(10) NOT NULL,
	"category" varchar(50) NOT NULL,
	"pack_size_g" integer,
	"units_per_case" integer,
	"manufacturer_id" integer,
	"primary_stock_location" varchar(10) DEFAULT 'THH' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"xero_item_code" varchar(50),
	"ap_brand_equivalent" varchar(50),
	"reorder_point_override" integer,
	"weight_kg" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"po_id" integer NOT NULL,
	"sku_code" varchar(50) NOT NULL,
	"size_variant" varchar(50) NOT NULL,
	"quantity_ordered" integer NOT NULL,
	"trigger_reason" text
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"manufacturer_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"created_date" date NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"expected_delivery_date" date,
	"notes" text,
	"draft_email_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar(255) PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"batch_id" integer,
	"sku_code" varchar(50) NOT NULL,
	"stock_location" varchar(10) NOT NULL,
	"transaction_type" varchar(30) NOT NULL,
	"quantity" integer NOT NULL,
	"transaction_date" date NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"reference" varchar(255),
	"channel" varchar(5),
	"created_by" integer,
	"approved_by" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplies" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"name" varchar(500) NOT NULL,
	"category" varchar(20) NOT NULL,
	"subcategory" varchar(50),
	"unit_of_measure" varchar(50),
	"supplier" varchar(255),
	"supplier_contact" varchar(255),
	"price_description" varchar(255),
	"moq" varchar(100),
	"lead_time" varchar(100),
	"reorder_point" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_product_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"supply_id" integer NOT NULL,
	"sku_code" varchar(50) NOT NULL,
	"quantity_per_unit" integer DEFAULT 1 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "supply_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"supply_id" integer NOT NULL,
	"transaction_type" varchar(30) NOT NULL,
	"quantity" integer NOT NULL,
	"transaction_date" date NOT NULL,
	"related_po_id" integer,
	"manufacturer_name" varchar(255),
	"reference" varchar(255),
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"profile_image_url" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ap_brand_mappings" ADD CONSTRAINT "ap_brand_mappings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invited_users" ADD CONSTRAINT "invited_users_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturers" ADD CONSTRAINT "manufacturers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pnp_order_lines" ADD CONSTRAINT "pnp_order_lines_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pnp_order_lines" ADD CONSTRAINT "pnp_order_lines_pnp_order_id_pnp_orders_id_fk" FOREIGN KEY ("pnp_order_id") REFERENCES "public"."pnp_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pnp_orders" ADD CONSTRAINT "pnp_orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pnp_orders" ADD CONSTRAINT "pnp_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pnp_product_mappings" ADD CONSTRAINT "pnp_product_mappings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplies" ADD CONSTRAINT "supplies_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_product_mappings" ADD CONSTRAINT "supply_product_mappings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_product_mappings" ADD CONSTRAINT "supply_product_mappings_supply_id_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_transactions" ADD CONSTRAINT "supply_transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_transactions" ADD CONSTRAINT "supply_transactions_supply_id_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_transactions" ADD CONSTRAINT "supply_transactions_related_po_id_purchase_orders_id_fk" FOREIGN KEY ("related_po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_transactions" ADD CONSTRAINT "supply_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_clients" ADD CONSTRAINT "user_clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_clients" ADD CONSTRAINT "user_clients_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "products_client_sku_idx" ON "products" USING btree ("client_id","sku_code");--> statement-breakpoint
CREATE UNIQUE INDEX "system_settings_client_key_idx" ON "system_settings" USING btree ("client_id","key");