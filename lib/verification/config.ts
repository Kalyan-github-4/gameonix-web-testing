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
 * The envelope sender. Most SMTP providers — Gmail included — reject a From
 * that is not the authenticated mailbox, so this defaults to SMTP_USER.
 */
export function mailFrom(): string {
  return (
    process.env.MAIL_FROM ??
    (mailProvider() === "smtp"
      ? required(
          "SMTP_USER",
          "It is also used as the From address when MAIL_FROM is unset."
        )
      : "Gamonix <onboarding@resend.dev>")
  )
}

export function mailProvider(): "resend" | "smtp" {
  const provider = process.env.MAIL_PROVIDER ?? "smtp"
  if (provider !== "resend" && provider !== "smtp") {
    throw new Error(`Unknown MAIL_PROVIDER "${provider}". Use "resend" or "smtp".`)
  }
  return provider
}

/** Master switch — flip it off to stop every outbound link and code at once. */
export function verificationEnabled(): boolean {
  return process.env.VERIFICATION_ENABLED !== "false"
}

export const isProduction = process.env.NODE_ENV === "production"
