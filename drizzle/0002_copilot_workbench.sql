CREATE TABLE "copilot_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tool_name" varchar(64) NOT NULL,
	"kind" varchar(8) DEFAULT 'write' NOT NULL,
	"summary" varchar(500) DEFAULT '' NOT NULL,
	"args" text DEFAULT '{}' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"result" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "copilot_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) DEFAULT '新对话' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"tool_name" varchar(64),
	"tool_args" text,
	"tool_ok" boolean,
	"action_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "copilot_actions" ADD CONSTRAINT "copilot_actions_conversation_id_copilot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."copilot_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_actions" ADD CONSTRAINT "copilot_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_conversations" ADD CONSTRAINT "copilot_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_conversation_id_copilot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."copilot_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copilot_actions_conversation_status_idx" ON "copilot_actions" USING btree ("conversation_id","status");--> statement-breakpoint
CREATE INDEX "copilot_actions_user_status_idx" ON "copilot_actions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "copilot_conversations_user_updated_idx" ON "copilot_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "copilot_messages_conversation_created_idx" ON "copilot_messages" USING btree ("conversation_id","created_at");