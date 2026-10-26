import { createLoader, parseAsString } from "nuqs/server"

// URL query state, shared by Server Components (loaders) and Client
// Components (useQueryState) so both read the same keys the same way.

export const loginSearchParams = {
  /** Where to go after signing in; always pass through safeNext(). */
  next: parseAsString.withDefault("/"),
}

export const loadLoginSearchParams = createLoader(loginSearchParams)

export const signupSearchParams = {
  /** Token from an invite link: sign up to join that org instead. */
  invite: parseAsString,
}

export const loadSignupSearchParams = createLoader(signupSearchParams)
