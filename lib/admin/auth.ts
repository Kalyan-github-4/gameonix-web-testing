/**
 * HTTP Basic credentials for the organizer-only pages.
 *
 * The roster tables expose every player's legal name, phone number and email,
 * so the check fails closed: if `ADMIN_USER` or `ADMIN_PASSWORD` is missing,
 * nobody gets in rather than everybody.
 *
 * Only Web Crypto is used here so the same module runs unchanged in the proxy
 * (which may execute on the Edge runtime) and in a server component.
 */

const encoder = new TextEncoder()

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value))
  return new Uint8Array(digest)
}

/**
 * Constant-time string comparison. Both sides are hashed first so that the
 * lengths being compared are always equal and the comparison leaks nothing
 * about the real password's length.
 */
async function secureEquals(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([sha256(a), sha256(b)])
  let mismatch = 0
  for (let i = 0; i < left.length; i += 1) mismatch |= left[i] ^ right[i]
  return mismatch === 0
}

/** Decodes `Authorization: Basic base64(user:password)`. */
function parseBasicAuth(
  header: string | null
): { user: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null

  let decoded: string
  try {
    decoded = atob(header.slice(6).trim())
  } catch {
    return null
  }

  // Only the first colon separates the pair; a password may contain more.
  const separator = decoded.indexOf(":")
  if (separator === -1) return null

  return {
    user: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  }
}

/**
 * Whether the request carries valid organizer credentials. Both fields are
 * always compared, even when the username is already wrong, so a response
 * time cannot be used to discover a valid username.
 */
export async function hasAdminCredentials(
  authorization: string | null
): Promise<boolean> {
  const expectedUser = process.env.ADMIN_USER
  const expectedPassword = process.env.ADMIN_PASSWORD

  if (!expectedUser || !expectedPassword) {
    console.error(
      "[admin] ADMIN_USER or ADMIN_PASSWORD is not set — denying access to /admin."
    )
    return false
  }

  const provided = parseBasicAuth(authorization)
  if (!provided) return false

  const [userOk, passwordOk] = await Promise.all([
    secureEquals(provided.user, expectedUser),
    secureEquals(provided.password, expectedPassword),
  ])

  return userOk && passwordOk
}

/** Sent with a 401 so the browser shows its own credential prompt. */
export const BASIC_AUTH_CHALLENGE = 'Basic realm="Gamonix organizers", charset="UTF-8"'
