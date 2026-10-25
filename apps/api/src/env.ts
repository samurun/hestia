import { z } from "zod"

export const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    API_PORT: z.coerce.number().default(3001),
    WEB_ORIGIN: z.url().default("http://localhost:3000"),
  })
  .parse(process.env)
