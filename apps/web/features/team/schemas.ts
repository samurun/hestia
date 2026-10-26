import { createInvitationBody } from "@workspace/shared/schemas"

// Property picking arrives with the properties UI (#8); the API already
// accepts propertyIds.
export const inviteSchema = createInvitationBody.pick({
  email: true,
  role: true,
})
