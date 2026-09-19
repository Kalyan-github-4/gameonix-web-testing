import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"

import { db } from "@/lib/db"
import { teamLogos } from "@/lib/db/schema"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Serves a team logo stored in Postgres. Each upload gets a fresh id and is
 * never modified, so the response can be cached forever.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Anything that is not a UUID would only make Postgres throw.
  if (!UUID_PATTERN.test(id)) {
    return new Response("Not found", { status: 404 })
  }

  const [logo] = await db
    .select({ data: teamLogos.data, mimeType: teamLogos.mimeType })
    .from(teamLogos)
    .where(eq(teamLogos.id, id))
    .limit(1)

  if (!logo) {
    return new Response("Not found", { status: 404 })
  }

  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.mimeType,
      "Content-Length": String(logo.data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      // The type was sniffed at upload; never let the browser guess another.
      "X-Content-Type-Options": "nosniff",
    },
  })
}
