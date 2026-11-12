CREATE TABLE "activity_logs" (
	"id" uuid NOT NULL,
	"account_type" varchar(8) NOT NULL,
	"account_id" uuid NOT NULL,
	"store_id" uuid,
	"method" varchar(8) NOT NULL,
	"route" varchar(200) NOT NULL,
	"path" varchar(500) NOT NULL,
	"status_code" integer NOT NULL,
	"request_id" varchar(64),
	"ip" varchar(64),
	"user_agent" varchar(300),
	"body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_activity_logs" PRIMARY KEY("id")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "ix_activity_logs_store_id_created_at" ON "activity_logs" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_activity_logs_account_id_created_at" ON "activity_logs" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_activity_logs_created_at" ON "activity_logs" USING btree ("created_at");