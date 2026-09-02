/**
 * Roster rules for the tournament.
 *
 * Currently pinned to a single member so the verification flow can be
 * exercised end to end with two real inboxes (the IGL and member 1). Raise
 * MAX_TEAM_MEMBERS back to the real squad size once that is proven.
 */
export const MIN_TEAM_MEMBERS = 1
export const MAX_TEAM_MEMBERS = 1

/** Team logo upload rules. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB
export const ACCEPTED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const
export const ACCEPTED_LOGO_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
}
/** `accept` attribute for the file input. */
export const LOGO_ACCEPT_ATTRIBUTE = ACCEPTED_LOGO_TYPES.join(",")

/**
 * Verification rules.
 *
 * The email link proves the inbox (only the person reading it can open the
 * page), so email needs no code of its own. The phone still does.
 */
export const VERIFICATION_WINDOW_HOURS = 72
export const OTP_LENGTH = 6
export const OTP_TTL_MINUTES = 10
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_COOLDOWN_SECONDS = 60
/** Per person, per channel, rolling 24 hours. */
export const OTP_MAX_SENDS_PER_DAY = 5
/** Per team, rolling 24 hours — catches a loop the per-person cap misses. */
export const OTP_MAX_TEAM_SENDS_PER_DAY = 40

/** How often the IGL may re-send a player's verification link, and how often in total. */
export const LINK_RESEND_COOLDOWN_SECONDS = 60
export const MAX_LINK_SENDS_PER_MEMBER = 10

/** Human-readable roster size, e.g. "4–6 players" or "1 player". */
export const ROSTER_SIZE_LABEL =
  MIN_TEAM_MEMBERS === MAX_TEAM_MEMBERS
    ? `${MIN_TEAM_MEMBERS} player${MIN_TEAM_MEMBERS === 1 ? "" : "s"}`
    : `${MIN_TEAM_MEMBERS}–${MAX_TEAM_MEMBERS} players`
