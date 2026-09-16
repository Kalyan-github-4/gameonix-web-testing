CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"in_game_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_name" text NOT NULL,
	"logo_url" text NOT NULL,
	"logo_mime_type" text NOT NULL,
	"logo_size_bytes" integer NOT NULL,
	"igl_name" text NOT NULL,
	"igl_phone" text NOT NULL,
	"igl_email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_members_team_id_idx" ON "team_members" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_email_unique" ON "team_members" USING btree ("team_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_phone_unique" ON "team_members" USING btree ("team_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_ign_unique" ON "team_members" USING btree ("team_id",lower("in_game_id"));--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_ign_unique" ON "team_members" USING btree (lower("in_game_id"));--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_email_unique" ON "team_members" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "teams_team_name_unique" ON "teams" USING btree (lower("team_name"));--> statement-breakpoint
CREATE UNIQUE INDEX "teams_igl_email_unique" ON "teams" USING btree (lower("igl_email"));--> statement-breakpoint
CREATE UNIQUE INDEX "teams_igl_phone_unique" ON "teams" USING btree ("igl_phone");--> statement-breakpoint
CREATE INDEX "teams_status_idx" ON "teams" USING btree ("status");