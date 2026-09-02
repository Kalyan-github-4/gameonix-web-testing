import { sql } from "drizzle-orm"
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * A team registration submitted by an IGL (In-Game Leader) on behalf of the
 * whole roster. One row per team, plus one `teamMembers` row per player.
 */
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Team details
    teamName: text("team_name").notNull(),
    logoUrl: text("logo_url").notNull(),
    logoMimeType: text("logo_mime_type").notNull(),
    logoSizeBytes: integer("logo_size_bytes").notNull(),

    // IGL (submits on behalf of the team)
    iglName: text("igl_name").notNull(),
    iglPhone: text("igl_phone").notNull(),
    iglEmail: text("igl_email").notNull(),

    // Organizer workflow
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Team names are unique regardless of casing/spacing entered by the IGL.
    uniqueIndex("teams_team_name_unique").on(sql`lower(${table.teamName})`),
    uniqueIndex("teams_igl_email_unique").on(sql`lower(${table.iglEmail})`),
    uniqueIndex("teams_igl_phone_unique").on(table.iglPhone),
    index("teams_status_idx").on(table.status),
  ]
)

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),

    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    inGameId: text("in_game_id").notNull(),

    // Roster order as entered in the form (1-based).
    position: integer("position").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("team_members_team_id_idx").on(table.teamId),
    // No duplicate players inside a single team.
    uniqueIndex("team_members_team_email_unique").on(
      table.teamId,
      sql`lower(${table.email})`
    ),
    uniqueIndex("team_members_team_phone_unique").on(table.teamId, table.phone),
    uniqueIndex("team_members_team_ign_unique").on(
      table.teamId,
      sql`lower(${table.inGameId})`
    ),
    // A player may not be rostered on two different teams.
    uniqueIndex("team_members_ign_unique").on(sql`lower(${table.inGameId})`),
    uniqueIndex("team_members_email_unique").on(sql`lower(${table.email})`),
  ]
)

export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
export type TeamMember = typeof teamMembers.$inferSelect
export type NewTeamMember = typeof teamMembers.$inferInsert
