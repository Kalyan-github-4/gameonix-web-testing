/**
 * Environment the verification flow depends on. Read through these helpers
 * rather than `process.env` directly so a missing value fails once, loudly,
 * with an instruction attached.
 */

function required(name: string, hint: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set. ${hint}`)
  return value
}

/** Absolute base for emailed links — a relative URL is useless in an inbox. */
export function appUrl(): string {
  const value =
    process.env.APP_URL ??
    (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000")

  if (!value) {
    throw new Error(
      "APP_URL is not set. Point it at the public origin, e.g. https://gamonix.gg"
    )
  }
  return value.replace(/\/+$/, "")
}

/**
 * Keys every token and OTP digest. Without it a database leak would hand over
 * live verification links and live codes.
 */
export function verificationPepper(): string {
  return required(
    "VERIFICATION_TOKEN_PEPPER",
    "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
  )
}

export function resendApiKey(): string {
  return required("RESEND_API_KEY", "Create one at https://resend.com/api-keys")
}

/**
 * Resend only delivers to arbitrary inboxes from a verified domain. Until one
 * is set up, `onboarding@resend.dev` reaches the account owner's own address.
 */
export function mailFrom(): string {
  return process.env.MAIL_FROM ?? "Gamonix <onboarding@resend.dev>"
}

/** Master switch — flip it off to stop every outbound link and code at once. */
export function verificationEnabled(): boolean {
  return process.env.VERIFICATION_ENABLED !== "false"
}

export const isProduction = process.env.NODE_ENV === "production"
