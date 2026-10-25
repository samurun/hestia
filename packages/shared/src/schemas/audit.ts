import { z } from "zod"

import { uuid } from "./fields"

const filter = z.string().min(1, "ค่าตัวกรองต้องไม่ว่าง")
// RFC 3339 also allows a space or lowercase t/z, which the API accepted
// before moving to zod; normalize those so existing callers keep working.
const dateTime = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value.replace(/^(\d{4}-\d{2}-\d{2})[ t]/, "$1T").replace(/z$/, "Z")
      : value,
  z.iso.datetime({ offset: true, error: "รูปแบบวันเวลาไม่ถูกต้อง" })
)

export const auditLogQuery = z
  .object({
    action: filter.optional(),
    entity: filter.optional(),
    entityId: uuid.optional(),
    actorId: uuid.optional(),
    from: dateTime.optional(),
    to: dateTime.optional(),
    cursor: uuid.optional(),
    limit: z.coerce
      .number()
      .int("limit ต้องเป็นจำนวนเต็ม")
      .min(1, "limit ต้องอยู่ระหว่าง 1–100")
      .max(100, "limit ต้องอยู่ระหว่าง 1–100")
      .optional(),
  })
  .refine(({ from, to }) => !from || !to || new Date(from) < new Date(to), {
    message: "from ต้องมาก่อน to",
    path: ["to"],
  })
