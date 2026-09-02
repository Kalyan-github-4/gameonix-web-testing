import { randomUUID } from "node:crypto"
import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import { ACCEPTED_LOGO_EXTENSIONS } from "./constants"

const LOGO_DIR = path.join(process.cwd(), "public", "uploads", "team-logos")
const PUBLIC_PREFIX = "/uploads/team-logos"

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

export type StoredLogo = {
  url: string
  mimeType: string
  sizeBytes: number
}

/**
 * Persists the logo under `public/uploads/team-logos` and returns the public
 * URL to store alongside the registration.
 *
 * Note: this writes to the local filesystem, which is fine for a single
 * server/VM deployment. On a serverless host, swap this function for an
 * object-storage upload (S3, R2, Vercel Blob) — nothing else has to change.
 */
export async function saveTeamLogo(file: File): Promise<StoredLogo> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = sniffImageMimeType(bytes)

  if (!mimeType) {
    throw new InvalidLogoError("Logo must be a PNG, JPEG or WebP image")
  }

  const fileName = `${randomUUID()}${ACCEPTED_LOGO_EXTENSIONS[mimeType]}`
  await mkdir(LOGO_DIR, { recursive: true })
  await writeFile(path.join(LOGO_DIR, fileName), bytes)

  return {
    url: `${PUBLIC_PREFIX}/${fileName}`,
    mimeType,
    sizeBytes: bytes.byteLength,
  }
}

/** Removes an already-stored logo, e.g. when the database insert fails. */
export async function deleteTeamLogo(url: string): Promise<void> {
  if (!url.startsWith(`${PUBLIC_PREFIX}/`)) return
  const fileName = path.basename(url)
  try {
    await unlink(path.join(LOGO_DIR, fileName))
  } catch {
    // Best-effort cleanup; a stray file must never fail the request.
  }
}

export class InvalidLogoError extends Error {}
