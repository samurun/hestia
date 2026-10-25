import { z } from "zod"

import { email, newPassword, personName } from "./fields"

/** Body of Better Auth's POST /api/auth/sign-up/email, as the API enforces it. */
export const signUpBody = z.object({
  name: personName,
  email,
  password: newPassword,
})
