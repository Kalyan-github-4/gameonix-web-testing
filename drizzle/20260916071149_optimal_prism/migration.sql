-- Added after teams were already registered, so the column arrives with a
-- temporary default to backfill existing rows, then drops it: new inserts must
-- supply a name rather than silently getting an empty one. Rows backfilled
-- with '' show as blank until the player edits them on their verification page.
ALTER TABLE "team_members" ADD COLUMN "in_game_name" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "team_members" ALTER COLUMN "in_game_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "igl_in_game_name" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "igl_in_game_name" DROP DEFAULT;
