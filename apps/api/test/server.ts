import { afterAll, beforeAll } from "bun:test"

/**
 * Spawns the real API process for the current test file. Each e2e file
 * passes its own port so files never fight over one.
 */
export function useServer(port: number) {
  const baseUrl = `http://localhost:${port}`
  let server: ReturnType<typeof Bun.spawn> | undefined

  beforeAll(async () => {
    server = Bun.spawn(["bun", "src/index.ts"], {
      cwd: `${import.meta.dir}/..`,
      env: { ...process.env, API_PORT: String(port) },
      stdout: "ignore",
      stderr: "inherit",
    })
    for (let i = 0; i < 50; i++) {
      const ok = await fetch(`${baseUrl}/health`)
        .then((r) => r.ok)
        .catch(() => false)
      if (ok) return
      await Bun.sleep(100)
    }
    throw new Error("API did not start")
  })

  afterAll(() => {
    server?.kill()
  })

  return baseUrl
}
