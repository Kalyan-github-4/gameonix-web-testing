import { randomUUID } from "node:crypto"

/**
 * Logos live in Postgres (`team_logos.data`) and are served by
 * `app/logos/[id]/route.ts`, so no filesystem or object store is involved.
 */
export function logoUrl(id: string): string {
  return `/logos/${id}`
}

/**
 * Sniffs the real image type from the file header. The browser-supplied
 * `File.type` is attacker-controlled, so it is never trusted on its own.
 */
export function sniffImageMimeType(bytes: Uint8Array): string | null {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte)

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return "image/png"
  }
  if (startsWith(0xff, 0xd8, 0xff)) {
    return "image/jpeg"
  }
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) && // "RIFF"
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 // "WEBP"
  ) {
    return "image/webp"
  }
  return null
}

export type PreparedLogo = {
  id: string
  url: string
  data: Buffer
  mimeType: string
  sizeBytes: number
}

/**
 * Reads and checks the upload, and assigns the id up front so the team row can
 * carry the logo URL in the same transaction that inserts the image.
 */
export async function prepareTeamLogo(file: File): Promise<PreparedLogo> {
  const data = Buffer.from(await file.arrayBuffer())
  const mimeType = sniffImageMimeType(data)

  if (!mimeType) {
    throw new InvalidLogoError("Logo must be a PNG, JPEG or WebP image")
  }

  const id = randomUUID()
  return { id, url: logoUrl(id), data, mimeType, sizeBytes: data.byteLength }
}

export class InvalidLogoError extends Error {}
