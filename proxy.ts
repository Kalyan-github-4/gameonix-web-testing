import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { BASIC_AUTH_CHALLENGE, hasAdminCredentials } from "@/lib/admin/auth"

/**
 * Browsers pop their credential dialog whenever a 401 carries a
 * `WWW-Authenticate` header — including for a background request the visitor
 * never made, such as Next prefetching an `/admin` link that happens to sit on
 * a public page. That looks like the whole site is password-protected.
 *
 * `Sec-Fetch-Dest: document` marks a real top-level navigation, which is the
 * only case where a prompt makes sense. Anything the browser positively tells
 * us is a subresource is refused without the challenge header. The header is
 * absent on non-browser clients like curl, so the challenge is still the
 * default when we cannot tell.
 *
 * The prefetch itself cannot be detected here: Next strips
 * `next-router-prefetch` from the request before Proxy sees it.
 */
function shouldChallenge(request: NextRequest): boolean {
  const destination = request.headers.get("sec-fetch-dest")
  return destination === null || destination === "document"
}

/**
 * Gates `/admin` behind HTTP Basic auth.
 *
 * This is the layer that produces the credential prompt, but it is not the
 * only check: a request that reaches the route directly would skip it, so the
 * page re-verifies the same header before it reads anything from the database.
 */
export async function proxy(request: NextRequest) {
  if (await hasAdminCredentials(request.headers.get("authorization"))) {
    return NextResponse.next()
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      ...(shouldChallenge(request)
        ? { "WWW-Authenticate": BASIC_AUTH_CHALLENGE }
        : {}),
      // Never let a proxy or the browser reuse this response for someone else.
      "Cache-Control": "no-store",
    },
  })
}

export const config = {
  matcher: "/admin/:path*",
}
