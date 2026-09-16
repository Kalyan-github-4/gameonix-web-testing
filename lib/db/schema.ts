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
 * Where a registration sits in the pipeline.
 *
 * `awaiting_verification` is the entry state: the row exists and links have
 * gone out, but no organizer should look at it yet. It only becomes `pending`
 * once the IGL and every player have proven their email and phone, and the IGL
 * has confirmed the final roster.
 */
export const TEAM_STATUSES = [
  "awaiting_verification",
  "pending",
  "approved",
  "rejected",
  "expired",
] as const

export type TeamStatus = (typeof TEAM_STATUSES)[number]

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
    iglInGameName: text("igl_in_game_name").notNull(),
    iglInGameId: text("igl_in_game_id").notNull(),

    // Organizer workflow
    status: text("status", { enum: TEAM_STATUSES })
      .notNull()
      .default("awaiting_verification"),

    // Verification. The hub token addresses the IGL's roster dashboard; it is
    // stored only as a keyed digest, so a database leak hands over no live
    // links.
    hubTokenHash: text("hub_token_hash").notNull(),
    verificationExpiresAt: timestamp("verification_expires_at", {
      withTimezone: true,
    }).notNull(),
    iglEmailVerifiedAt: timestamp("igl_email_verified_at", {
      withTimezone: true,
    }),
    iglPhoneVerifiedAt: timestamp("igl_phone_verified_at", {
      withTimezone: true,
    }),
    /** Set when the IGL locks the roster in; this is what promotes to `pending`. */
    rosterSubmittedAt: timestamp("roster_submitted_at", { withTimezone: true }),

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
    uniqueIndex("teams_igl_ign_unique").on(sql`lower(${table.iglInGameId})`),
    uniqueIndex("teams_hub_token_unique").on(table.hubTokenHash),
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
    // The display name shown in-game. Unlike `inGameId` this is not an
    // identity: two players may legitimately share one, so it carries no
    // unique index.
    inGameName: text("in_game_name").notNull(),
    inGameId: text("in_game_id").notNull(),

    // Roster order as entered in the form (1-based).
    position: integer("position").notNull(),

    // Verification. Opening the emailed link is what proves the inbox, so
    // `emailVerifiedAt` is stamped on the player's first deliberate action on
    // their page — never on page load, which an email scanner could trigger.
    verifyTokenHash: text("verify_token_hash").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    /** Rate-limits the IGL re-sending a link that bounced or went to spam. */
    linkSentAt: timestamp("link_sent_at", { withTimezone: true }),
    linkSendCount: integer("link_send_count").notNull().default(0),

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
    uniqueIndex("team_members_team_ign_unique").on(
      table.teamId,
      sql`lower(${table.inGameId})`
    ),
    // A player may not be rostered on two different teams. Phone is global
    // too: one handset carrying two rosters is exactly the fraud the OTP step
    // exists to make expensive.
    uniqueIndex("team_members_ign_unique").on(sql`lower(${table.inGameId})`),
    uniqueIndex("team_members_email_unique").on(sql`lower(${table.email})`),
    uniqueIndex("team_members_phone_unique").on(table.phone),
    uniqueIndex("team_members_verify_token_unique").on(table.verifyTokenHash),
  ]
)

export const VERIFICATION_CHANNELS = ["email", "phone"] as const
export type VerificationChannel = (typeof VERIFICATION_CHANNELS)[number]

/**
 * One row per code ever sent. Keeping `destination` here means "which number
 * did this code go to" is a recorded fact: if the player edits their phone
 * mid-flight the open challenge stops matching and is dead without any extra
 * bookkeeping. It also makes every send-rate cap a plain `count(*)`.
 */
export const verificationChallenges = pgTable(
  "verification_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    /** Null means the challenge belongs to the IGL rather than a roster row. */
    memberId: uuid("member_id").references(() => teamMembers.id, {
      onDelete: "cascade",
    }),

    channel: text("channel", { enum: VERIFICATION_CHANNELS }).notNull(),
    /** Normalized, exactly as dispatched. */
    destination: text("destination").notNull(),
    codeHash: text("code_hash").notNull(),

    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("verification_challenges_member_idx").on(
      table.memberId,
      table.channel,
      table.createdAt
    ),
    index("verification_challenges_team_idx").on(table.teamId, table.createdAt),
  ]
)

export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
export type TeamMember = typeof teamMembers.$inferSelect
export type NewTeamMember = typeof teamMembers.$inferInsert
export type VerificationChallenge = typeof verificationChallenges.$inferSelect
