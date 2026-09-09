import { isProduction } from "@/lib/verification/config"

export type SmsResult = { ok: true } | { ok: false; error: string }

/**
 * The single seam every OTP goes through. Swapping the console transport for
 * MSG91, Twilio Verify or Firebase Phone Auth is a change to this file and
 * nothing else.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER ?? "console"

  switch (provider) {
    case "console":
      return consoleTransport(to, body)
    case "fast2sms":
      return fast2SmsTransport(to, body)
    default:
      return { ok: false, error: `Unknown SMS_PROVIDER "${provider}"` }
  }
}

async function fast2SmsTransport(to: string, body: string): Promise<SmsResult> {
  const apiKey = process.env.FAST2SMS_API_KEY
  if (!apiKey) return { ok: false, error: "FAST2SMS_API_KEY is not set" }

  const numbers = to.replace(/\D/g, "").slice(-10)
  if (numbers.length !== 10) {
    return { ok: false, error: "Fast2SMS requires an Indian 10-digit phone number" }
  }

  try {
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "q",
        message: body,
        language: "english",
        flash: 0,
        numbers,
      }),
    })

    const result = (await response.json()) as { message?: string[] | string }
    if (!response.ok) {
      return {
        ok: false,
        error: Array.isArray(result.message)
          ? result.message.join(", ")
          : result.message ?? `Fast2SMS returned HTTP ${response.status}`,
      }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Fast2SMS request failed",
    }
  }
}

/**
 * Development transport: prints the message where you are already watching.
 * Refuses to run in production so a missing provider fails loudly instead of
 * silently "verifying" everyone.
 */
async function consoleTransport(to: string, body: string): Promise<SmsResult> {
  if (isProduction) {
    return {
      ok: false,
      error:
        "No SMS provider configured. Set SMS_PROVIDER and its credentials before going live.",
    }
  }

  console.info(
    `\n┌─ SMS ─────────────────────────────────────────\n│ to:   ${to}\n│ body: ${body}\n└───────────────────────────────────────────────\n`
  )
  return { ok: true }
}

/**
 * In development the code is echoed back to the browser as well, so the flow
 * can be exercised without a provider. Hard-gated on NODE_ENV.
 */
export function shouldEchoCode(): boolean {
  return !isProduction && (process.env.SMS_PROVIDER ?? "console") === "console"
}
