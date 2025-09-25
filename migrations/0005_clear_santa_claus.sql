ALTER TABLE "users" ADD COLUMN "delivery_fee" numeric(10, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "free_delivery_threshold" numeric(10, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "minimum_order_value" numeric(10, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "delivery_radius_km" integer DEFAULT 10;