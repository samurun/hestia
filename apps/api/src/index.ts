import { app } from "./app"
import { env } from "./env"

app.listen(env.API_PORT)

export type { App } from "./app"

console.log(`API listening on http://localhost:${env.API_PORT}`)
