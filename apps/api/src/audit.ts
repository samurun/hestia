import { schema, type Tx } from "@workspace/db"

import { clientIp } from "./client-ip"
import { env } from "./env"

export type AuditEntry = {
  /** "<entity>.<verb>", e.g. "organization.create". */
  action: `${string}.${string}`
  entity: string
  entityId?: string | null
  before?: unknown
  after?: unknown
}

type IpServer = {
  requestIP(request: Request): { address: string } | null
} | null

/**
 * The one place that turns a request into audit rows. Returns
 * `audit(tx, entry)`; pass the transaction that makes the change, so the log
 * and the change commit or roll back together. The IP is only worked out
 * when something is actually logged.
 */
export function createAuditor({
  orgId,
  actorId,
  request,
  server,
}: {
  orgId: string
  actorId: string | null
  request: Request
  server: IpServer
}) {
  let ip: string | null | undefined
  return async (tx: Tx, entry: AuditEntry) => {
    ip ??= clientIp({
      forwardedFor: request.headers.get("x-forwarded-for"),
      socketIp: server?.requestIP(request)?.address ?? null,
      trustedHops: env.TRUST_PROXY_HOPS,
    })
    await tx.insert(schema.auditLogs).values({
      orgId,
      actorId,
      ip,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
    })
  }
}

export type Auditor = ReturnType<typeof createAuditor>
