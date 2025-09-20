ALTER TABLE "group_payments" ALTER COLUMN "payer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payer_id" varchar;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;