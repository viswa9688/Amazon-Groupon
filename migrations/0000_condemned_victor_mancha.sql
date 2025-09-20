CREATE TABLE "admin_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_credentials_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"icon" varchar(50),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "discount_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"participant_count" integer NOT NULL,
	"discount_percentage" numeric(5, 2) NOT NULL,
	"final_price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"product_title" varchar(255),
	"product_description" text,
	"brand" varchar(100),
	"sku_id" varchar(50),
	"sku_code" varchar(50),
	"gtin" varchar(20),
	"barcode_symbology" varchar(20),
	"uom" varchar(20),
	"net_content_value" numeric(10, 3),
	"net_content_uom" varchar(20),
	"is_variable_weight" boolean DEFAULT false,
	"plu_code" varchar(20),
	"dietary_tags" text,
	"allergens" text,
	"country_of_origin" varchar(100),
	"temperature_zone" varchar(20),
	"shelf_life_days" integer,
	"storage_instructions" text,
	"substitutable" boolean DEFAULT true,
	"gross_weight_g" numeric(10, 2),
	"list_price_cents" integer,
	"sale_price_cents" integer,
	"effective_from" timestamp,
	"effective_to" timestamp,
	"tax_class" varchar(50),
	"inventory_on_hand" integer DEFAULT 0,
	"inventory_reserved" integer DEFAULT 0,
	"inventory_status" varchar(20) DEFAULT 'in_stock',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "grocery_products_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "group_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"user_group_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'usd',
	"status" varchar(20) DEFAULT 'pending',
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "group_payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"product_id" integer,
	"address_id" integer,
	"quantity" integer DEFAULT 1,
	"unit_price" numeric(10, 2),
	"total_price" numeric(10, 2) NOT NULL,
	"final_price" numeric(10, 2) NOT NULL,
	"shipping_address" text,
	"status" varchar(20) DEFAULT 'pending',
	"type" varchar(20) DEFAULT 'group',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" varchar NOT NULL,
	"category_id" integer,
	"name" varchar(255) NOT NULL,
	"description" text,
	"image_url" varchar(500),
	"original_price" numeric(10, 2) NOT NULL,
	"minimum_participants" integer DEFAULT 10 NOT NULL,
	"maximum_participants" integer DEFAULT 1000 NOT NULL,
	"offer_valid_till" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seller_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" varchar NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"is_read" boolean DEFAULT false,
	"priority" varchar(20) DEFAULT 'normal',
	"created_at" timestamp DEFAULT now(),
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "service_provider_staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_provider_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"skills" jsonb,
	"availability" jsonb,
	"rating" numeric(2, 1),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"legal_name" varchar(255),
	"display_name" varchar(255),
	"service_category" varchar(100),
	"status" varchar(20) DEFAULT 'active',
	"license_number" varchar(100),
	"insurance_valid_till" timestamp,
	"years_in_business" integer,
	"service_mode" varchar(20) DEFAULT 'in_person',
	"address_line_1" varchar(255),
	"address_line_2" varchar(255),
	"locality" varchar(100),
	"region" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(100) DEFAULT 'India',
	"service_area_polygon" jsonb,
	"service_name" varchar(255),
	"duration_minutes" integer,
	"pricing_model" varchar(50),
	"materials_included" boolean DEFAULT false,
	"tax_class" varchar(50),
	"age_restriction" integer,
	"availability_type" varchar(30),
	"operating_hours" jsonb,
	"advance_booking_days" integer DEFAULT 7,
	"cancellation_policy_url" varchar(500),
	"reschedule_allowed" boolean DEFAULT true,
	"avg_rating" numeric(2, 1) DEFAULT '0',
	"review_count" integer DEFAULT 0,
	"highlighted_testimonials" jsonb,
	"insurance_policy_number" varchar(100),
	"liability_waiver_required" boolean DEFAULT false,
	"health_safety_cert" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "service_providers_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"nickname" varchar(100) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"address_line" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"pincode" varchar(20) NOT NULL,
	"state" varchar(100),
	"country" varchar(100) DEFAULT 'India',
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_group_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_group_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_group_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_group_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"share_token" varchar(32) NOT NULL,
	"max_members" integer DEFAULT 5 NOT NULL,
	"is_public" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_groups_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" varchar,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"is_seller" boolean DEFAULT false,
	"store_id" varchar(50),
	"legal_name" varchar(255),
	"display_name" varchar(255),
	"shop_type" varchar(20) DEFAULT 'groceries',
	"status" varchar(20) DEFAULT 'active',
	"timezone" varchar(50),
	"currency" varchar(10),
	"languages" text,
	"address_line_1" varchar(255),
	"address_line_2" varchar(255),
	"locality" varchar(100),
	"region" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(100),
	"service_area_polygon" jsonb,
	"operating_hours" varchar(255),
	"pickup_hours" varchar(255),
	"delivery_hours" varchar(255),
	"age_check_enabled" boolean DEFAULT false,
	"substitution_policy" varchar(50),
	"refund_policy_url" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_store_id_unique" UNIQUE("store_id")
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_tiers" ADD CONSTRAINT "discount_tiers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_products" ADD CONSTRAINT "grocery_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_payments" ADD CONSTRAINT "group_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_payments" ADD CONSTRAINT "group_payments_user_group_id_user_groups_id_fk" FOREIGN KEY ("user_group_id") REFERENCES "public"."user_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_payments" ADD CONSTRAINT "group_payments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_user_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."user_addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_notifications" ADD CONSTRAINT "seller_notifications_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_provider_staff" ADD CONSTRAINT "service_provider_staff_service_provider_id_service_providers_id_fk" FOREIGN KEY ("service_provider_id") REFERENCES "public"."service_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_items" ADD CONSTRAINT "user_group_items_user_group_id_user_groups_id_fk" FOREIGN KEY ("user_group_id") REFERENCES "public"."user_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_items" ADD CONSTRAINT "user_group_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_participants" ADD CONSTRAINT "user_group_participants_user_group_id_user_groups_id_fk" FOREIGN KEY ("user_group_id") REFERENCES "public"."user_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_participants" ADD CONSTRAINT "user_group_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");