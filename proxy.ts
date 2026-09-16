import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { BASIC_AUTH_CHALLENGE, hasAdminCredentials } from "@/lib/admin/auth"

/**
 * Gates `/admin` behind HTTP Basic auth.
 *
 * This is the layer that produces the browser's credential prompt, but it is
 * not the only check: `next.config.ts` aside, a proxy can be bypassed by a
 * request that reaches the route directly, so the page re-verifies the same
 * header before it reads anything from the database.
 */
export async function proxy(request: NextRequest) {
  if (await hasAdminCredentials(request.headers.get("authorization"))) {
    return NextResponse.next()
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": BASIC_AUTH_CHALLENGE,
      // Never let a proxy or the browser reuse this response for someone else.
      "Cache-Control": "no-store",
    },
  })
}

export const config = {
  matcher: "/admin/:path*",
}
