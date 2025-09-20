ALTER TABLE "group_payments" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "group_payments" ALTER COLUMN "status" SET NOT NULL;