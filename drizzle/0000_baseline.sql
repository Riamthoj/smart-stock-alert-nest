CREATE TABLE "categories" (
	"id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"image" varchar(500),
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_categories" PRIMARY KEY("id"),
	CONSTRAINT "uq_categories_store_id" UNIQUE("store_id","name")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"phone" varchar(15),
	"profile" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_customers" PRIMARY KEY("id"),
	CONSTRAINT "uq_customers_store_id" UNIQUE("store_id","phone")
);
--> statement-breakpoint
CREATE TABLE "inventories" (
	"id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL,
	"reserved_qty" integer DEFAULT 0 NOT NULL,
	"reorder_level" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_inventories" PRIMARY KEY("id"),
	CONSTRAINT "uq_inventories_store_id" UNIQUE("store_id","product_id"),
	CONSTRAINT "ck_inventories_qty_non_negative" CHECK ("inventories"."qty" >= 0),
	CONSTRAINT "ck_inventories_reserved_qty_non_negative" CHECK ("inventories"."reserved_qty" >= 0),
	CONSTRAINT "ck_inventories_reserved_not_above_qty" CHECK ("inventories"."reserved_qty" <= "inventories"."qty"),
	CONSTRAINT "ck_inventories_reorder_level_non_negative" CHECK ("inventories"."reorder_level" >= 0)
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"phone" varchar(15),
	"profile" varchar(500),
	"is_owner" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_owners" PRIMARY KEY("id"),
	CONSTRAINT "uq_owners_phone" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"payment_method" varchar(16) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"status" varchar(16) DEFAULT 'paid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_payments" PRIMARY KEY("id"),
	CONSTRAINT "ck_payments_amount_positive" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"category_id" uuid,
	"name" varchar(255) NOT NULL,
	"image" varchar(500),
	"bar_code" varchar(64),
	"cost_price" numeric(14, 2) NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_products" PRIMARY KEY("id"),
	CONSTRAINT "uq_products_store_id" UNIQUE("store_id","bar_code"),
	CONSTRAINT "ck_products_cost_price_non_negative" CHECK ("products"."cost_price" >= 0),
	CONSTRAINT "ck_products_price_non_negative" CHECK ("products"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"cost_price" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_sale_items" PRIMARY KEY("id"),
	CONSTRAINT "ck_sale_items_qty_positive" CHECK ("sale_items"."qty" > 0),
	CONSTRAINT "ck_sale_items_unit_price_non_negative" CHECK ("sale_items"."unit_price" >= 0),
	CONSTRAINT "ck_sale_items_cost_price_non_negative" CHECK ("sale_items"."cost_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"customer_id" uuid,
	"receipt_number" varchar(32) NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"sold_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_sales" PRIMARY KEY("id"),
	CONSTRAINT "uq_sales_store_id" UNIQUE("store_id","receipt_number"),
	CONSTRAINT "ck_sales_discount_non_negative" CHECK ("sales"."discount" >= 0),
	CONSTRAINT "ck_sales_tax_non_negative" CHECK ("sales"."tax" >= 0),
	CONSTRAINT "ck_sales_total_non_negative" CHECK ("sales"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_alerts" (
	"id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_at_trigger" integer NOT NULL,
	"threshold_at_trigger" integer NOT NULL,
	"alert" varchar(16) DEFAULT 'low_stock' NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_stock_alerts" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE "stock_moves" (
	"id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"move_type" varchar(16) NOT NULL,
	"reference" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_stock_moves" PRIMARY KEY("id"),
	CONSTRAINT "ck_stock_moves_qty_not_zero" CHECK ("stock_moves"."qty" <> 0)
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"image" varchar(500),
	"detail" text,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_stores" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"phone" varchar(15),
	"profile" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_users" PRIMARY KEY("id"),
	CONSTRAINT "uq_users_phone" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "fk_categories_store_id_stores" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "fk_customers_store_id_stores" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventories" ADD CONSTRAINT "fk_inventories_store_id_stores" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventories" ADD CONSTRAINT "fk_inventories_product_id_products" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "fk_owners_store_id_stores" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_sale_id_sales" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "fk_products_store_id_stores" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "fk_products_category_id_categories" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "fk_sale_items_sale_id_sales" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "fk_sale_items_product_id_products" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "fk_sales_store_id_stores" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "fk_sales_owner_id_owners" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "fk_sales_customer_id_customers" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alerts" ADD CONSTRAINT "fk_stock_alerts_store_id_stores" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alerts" ADD CONSTRAINT "fk_stock_alerts_product_id_products" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "fk_stock_moves_store_id_stores" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "fk_stock_moves_product_id_products" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_categories_store_id" ON "categories" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "ix_customers_store_id" ON "customers" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_customers_code" ON "customers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "ix_inventories_store_id" ON "inventories" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "ix_inventories_product_id" ON "inventories" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ix_owners_store_id" ON "owners" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_owners_username" ON "owners" USING btree ("username");--> statement-breakpoint
CREATE INDEX "ix_payments_sale_id" ON "payments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "ix_payments_payment_method" ON "payments" USING btree ("payment_method");--> statement-breakpoint
CREATE INDEX "ix_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_products_store_id" ON "products" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "ix_products_category_id" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "ix_products_bar_code" ON "products" USING btree ("bar_code");--> statement-breakpoint
CREATE INDEX "ix_sale_items_sale_id" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "ix_sale_items_product_id" ON "sale_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ix_sales_store_id" ON "sales" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "ix_sales_owner_id" ON "sales" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "ix_sales_customer_id" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "ix_sales_receipt_number" ON "sales" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "ix_sales_sold_at" ON "sales" USING btree ("sold_at");--> statement-breakpoint
CREATE INDEX "ix_stock_alerts_store_id" ON "stock_alerts" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "ix_stock_alerts_product_id" ON "stock_alerts" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ix_stock_alerts_alert" ON "stock_alerts" USING btree ("alert");--> statement-breakpoint
CREATE INDEX "ix_stock_alerts_status" ON "stock_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_stock_moves_store_id" ON "stock_moves" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "ix_stock_moves_product_id" ON "stock_moves" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ix_stock_moves_move_type" ON "stock_moves" USING btree ("move_type");--> statement-breakpoint
CREATE INDEX "ix_stock_moves_reference" ON "stock_moves" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "ix_stores_name" ON "stores" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ix_stores_status" ON "stores" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_users_username" ON "users" USING btree ("username");