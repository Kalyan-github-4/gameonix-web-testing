import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto"

import { OTP_LENGTH } from "@/lib/tournament/constants"

import { verificationPepper } from "./config"

/**
 * Link tokens and OTP codes are both stored as keyed digests. Lookup is by
 * digest, so the database index does the comparison and there is no secret to
 * compare in application code.
 */
function digest(value: string, domain: string): string {
  return createHmac("sha256", verificationPepper())
    .update(`${domain}:${value}`)
    .digest("base64url")
}

export function mintToken(): { token: string; hash: string } {
  // 32 bytes: far beyond guessing, still short enough to survive an email
  // client wrapping the URL.
  const token = randomBytes(32).toString("base64url")
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string): string {
  return digest(token, "token")
}

export function generateOtp(): string {
  let code = ""
  for (let i = 0; i < OTP_LENGTH; i += 1) code += randomInt(0, 10)
  return code
}

export function hashOtp(code: string): string {
  return digest(code, "otp")
}

export function otpMatches(code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(code))
  const expected = Buffer.from(expectedHash)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}
