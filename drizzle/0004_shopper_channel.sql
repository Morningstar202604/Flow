ALTER TABLE "copilot_actions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "copilot_conversations" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "copilot_actions" ADD COLUMN "session_id" varchar(64);--> statement-breakpoint
ALTER TABLE "copilot_conversations" ADD COLUMN "session_id" varchar(64);--> statement-breakpoint
ALTER TABLE "copilot_conversations" ADD COLUMN "channel" varchar(16) DEFAULT 'seller' NOT NULL;--> statement-breakpoint
CREATE INDEX "copilot_actions_session_idx" ON "copilot_actions" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "copilot_conversations_session_idx" ON "copilot_conversations" USING btree ("session_id","updated_at");