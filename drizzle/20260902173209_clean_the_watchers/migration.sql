CREATE TABLE "verification_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"member_id" uuid,
	"channel" text NOT NULL,
	"destination" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "team_members_team_phone_unique";--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "status" SET DEFAULT 'awaiting_verification';--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "verify_token_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "link_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "link_send_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "hub_token_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "verification_expires_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "igl_email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "igl_phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "roster_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_member_id_team_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_challenges_member_idx" ON "verification_challenges" USING btree ("member_id","channel","created_at");--> statement-breakpoint
CREATE INDEX "verification_challenges_team_idx" ON "verification_challenges" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_phone_unique" ON "team_members" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_verify_token_unique" ON "team_members" USING btree ("verify_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_hub_token_unique" ON "teams" USING btree ("hub_token_hash");