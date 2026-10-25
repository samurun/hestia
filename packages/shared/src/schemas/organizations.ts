import { z } from "zod"

import { orgName, uuid } from "./fields"

export const createOrganizationBody = z.object({ name: orgName })

export const setActiveOrganizationBody = z.object({ orgId: uuid })
