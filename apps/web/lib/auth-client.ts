import { createAuthClient } from "better-auth/react"

// No baseURL: Better Auth uses the current origin + /api/auth, which the
// rewrite in next.config.ts forwards to the API.
export const authClient = createAuthClient()
