CREATE TABLE "ai_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(500) DEFAULT '' NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt_template" text DEFAULT '{{input}}' NOT NULL,
	"response_format" varchar(10) DEFAULT 'text' NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.70' NOT NULL,
	"max_tokens" integer DEFAULT 2000 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_agents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"key" varchar(50) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
