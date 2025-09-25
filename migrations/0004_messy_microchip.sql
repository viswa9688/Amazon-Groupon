ALTER TABLE "orders" ADD COLUMN "expected_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "actual_delivery_date" timestamp;