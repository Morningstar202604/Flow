ALTER TABLE "inquiry_sessions" ADD COLUMN IF NOT EXISTS "seller_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inquiry_sessions" ADD CONSTRAINT "inquiry_sessions_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiry_sessions_seller_idx" ON "inquiry_sessions" ("seller_id","last_message_at");
