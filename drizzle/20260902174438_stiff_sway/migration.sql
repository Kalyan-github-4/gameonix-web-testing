ALTER TABLE "teams" ADD COLUMN "igl_in_game_id" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_igl_ign_unique" ON "teams" USING btree (lower("igl_in_game_id"));