import { z } from "zod"

import { uuid } from "./fields"

export const membershipParams = z.object({ membershipId: uuid })

export const setMembershipPropertiesBody = z.object({
  propertyIds: z
    .array(uuid)
    .max(500, "มอบหมายได้ไม่เกิน 500 โครงการในครั้งเดียว"),
})
