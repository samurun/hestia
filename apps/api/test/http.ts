export const WEB_ORIGIN = "http://localhost:3000"

type Fetcher = (request: Request) => Response | Promise<Response>

/** Minimal cookie-keeping client, so tests read like a browser session. */
export function createClient(baseUrl: string, fetcher: Fetcher = fetch) {
  const jar = new Map<string, string>()

  return async function request(
    path: string,
    init: { method?: string; json?: unknown } = {}
  ) {
    const headers = new Headers({ origin: WEB_ORIGIN })
    if (init.json !== undefined) headers.set("content-type", "application/json")
    if (jar.size > 0) {
      headers.set(
        "cookie",
        [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
      )
    }
    const res = await fetcher(
      new Request(baseUrl + path, {
        method: init.method ?? (init.json === undefined ? "GET" : "POST"),
        headers,
        body: init.json === undefined ? undefined : JSON.stringify(init.json),
      })
    )
    for (const cookie of res.headers.getSetCookie()) {
      const [pair = ""] = cookie.split(";")
      const index = pair.indexOf("=")
      const name = pair.slice(0, index)
      const value = pair.slice(index + 1)
      if (value) jar.set(name, value)
      else jar.delete(name)
    }
    return res
  }
}
