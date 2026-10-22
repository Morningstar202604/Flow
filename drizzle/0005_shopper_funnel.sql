CREATE TABLE "shopper_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" varchar(64),
	"stage" varchar(24) NOT NULL,
	"conversation_id" uuid,
	"product_id" uuid,
	"keyword" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopper_events" ADD CONSTRAINT "shopper_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopper_events" ADD CONSTRAINT "shopper_events_conversation_id_copilot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."copilot_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopper_events" ADD CONSTRAINT "shopper_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopper_events_stage_created_idx" ON "shopper_events" USING btree ("stage","created_at");--> statement-breakpoint
CREATE INDEX "shopper_events_session_idx" ON "shopper_events" USING btree ("session_id","stage");--> statement-breakpoint
CREATE INDEX "shopper_events_user_idx" ON "shopper_events" USING btree ("user_id","stage");