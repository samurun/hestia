import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

const publicPaths = new Set(["/login", "/signup"])

/**
 * Optimistic check only: no session cookie on a private page → /login.
 * Whether the session is valid is decided by the API via lib/dal.ts; a stale
 * cookie reaches the page, which then redirects.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (publicPaths.has(pathname) || getSessionCookie(request)) {
    return NextResponse.next()
  }

  const login = new URL("/login", request.url)
  if (pathname !== "/") login.searchParams.set("next", pathname + search)
  return NextResponse.redirect(login)
}

export const config = {
  // Skip the API rewrite, Next internals and files with an extension.
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
}
