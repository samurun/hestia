import { email, orgName, password, signUpBody } from "@workspace/shared/schemas"
import { z } from "zod"

// Form shapes only; the rules come from @workspace/shared. signUpBody is the
// same schema the API enforces on Better Auth's sign-up endpoint.

export const loginSchema = z.object({ email, password })

export const signupSchema = signUpBody.extend({ orgName })

/** Joining through an invite: no org of their own to create. */
export const inviteSignupSchema = signUpBody
