CREATE TABLE "kiosks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"ip_address" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kiosks_ip_address_unique" UNIQUE("ip_address")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "card_number" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_card_number_unique" UNIQUE("card_number");

-- Add kiosk permissions
INSERT INTO permissions (name) VALUES
	('kiosks.list'),
	('kiosks.get'),
	('kiosks.create'),
	('kiosks.update'),
	('kiosks.delete');