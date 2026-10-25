import { orgName } from "@workspace/shared/schemas"
import { z } from "zod"

// Form shape only; the rules come from @workspace/shared, same as the API.
export const createOrgSchema = z.object({ orgName })
