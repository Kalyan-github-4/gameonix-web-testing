/** Roster rules for the tournament. */
export const MIN_TEAM_MEMBERS = 4
export const MAX_TEAM_MEMBERS = 6

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
