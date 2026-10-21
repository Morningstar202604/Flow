ALTER TABLE "copilot_actions" ADD COLUMN "batch_id" varchar(36);--> statement-breakpoint
CREATE INDEX "copilot_actions_batch_idx" ON "copilot_actions" USING btree ("batch_id");
