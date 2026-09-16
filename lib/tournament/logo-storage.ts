import { randomUUID } from "node:crypto"
import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import { del, put } from "@vercel/blob"

import { ACCEPTED_LOGO_EXTENSIONS } from "./constants"

const LOGO_DIR = path.join(process.cwd(), "public", "uploads", "team-logos")
const PUBLIC_PREFIX = "/uploads/team-logos"
const BLOB_PREFIX = "team-logos"

/**
 * Blob storage is used whenever its token is present, which is the case on
 * Vercel once a Blob store is attached. Without it — a plain `next dev`, or a
 * VM with a persistent disk — logos fall back to `public/uploads`.
 *
 * A serverless filesystem is read-only outside `/tmp` and is rebuilt on every
 * deploy, so the local branch is not a viable production path there.
 */
function blobStoreEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN
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

export type StoredLogo = {
  url: string
  mimeType: string
  sizeBytes: number
}

/**
 * Persists the logo and returns the URL to store alongside the registration.
 *
 * The returned URL is absolute on Blob and root-relative on disk; both are
 * valid `next/image` sources, so nothing downstream has to know which store
 * handled the write.
 */
export async function saveTeamLogo(file: File): Promise<StoredLogo> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = sniffImageMimeType(bytes)

  if (!mimeType) {
    throw new InvalidLogoError("Logo must be a PNG, JPEG or WebP image")
  }

  const fileName = `${randomUUID()}${ACCEPTED_LOGO_EXTENSIONS[mimeType]}`

  if (blobStoreEnabled()) {
    // The name is already a UUID, so the random suffix Blob adds by default
    // would only make the stored path harder to match back to the row.
    const blob = await put(`${BLOB_PREFIX}/${fileName}`, new Blob([bytes]), {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
    })

    return { url: blob.url, mimeType, sizeBytes: bytes.byteLength }
  }

  await mkdir(LOGO_DIR, { recursive: true })
  await writeFile(path.join(LOGO_DIR, fileName), bytes)

  return {
    url: `${PUBLIC_PREFIX}/${fileName}`,
    mimeType,
    sizeBytes: bytes.byteLength,
  }
}

/**
 * Removes an already-stored logo, e.g. when the database insert fails.
 *
 * Dispatch is on the URL rather than on `blobStoreEnabled()` so that a logo
 * uploaded before the store was attached is still cleaned up afterwards.
 */
export async function deleteTeamLogo(url: string): Promise<void> {
  try {
    if (url.startsWith("http")) {
      await del(url)
      return
    }

    if (!url.startsWith(`${PUBLIC_PREFIX}/`)) return
    await unlink(path.join(LOGO_DIR, path.basename(url)))
  } catch {
    // Best-effort cleanup; a stray file must never fail the request.
  }
}

export class InvalidLogoError extends Error {}
