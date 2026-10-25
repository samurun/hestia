import { and, desc, eq, gte, lt, schema } from "@workspace/db"
import {
  auditLogQuery,
  messageError,
  uuid,
  validationError,
} from "@workspace/shared/schemas"
import { Elysia } from "elysia"
import { z } from "zod"

import { rbacPlugin } from "./plugins/rbac"

const { auditLogs, users } = schema

const AuditLogItem = z.object({
  id: uuid,
  action: z.string(),
  entity: z.string(),
  entityId: uuid.nullable(),
  actor: z.object({ id: uuid, name: z.string(), email: z.string() }).nullable(),
  before: z.unknown(),
  after: z.unknown(),
  ip: z.string().nullable(),
  createdAt: z.iso.datetime(),
})

export const auditRoutes = new Elysia({ prefix: "/audit-logs" })
  .use(rbacPlugin)
  .get(
    "/",
    async ({ query, orgTx }) => {
      const limit = query.limit ?? 50
      // auditLogQuery already rejects an inverted range.
      const from = query.from === undefined ? undefined : new Date(query.from)
      const to = query.to === undefined ? undefined : new Date(query.to)

      const defined = <T>(value: T | undefined) => value !== undefined
      const filters = [
        defined(query.action) && eq(auditLogs.action, query.action!),
        defined(query.entity) && eq(auditLogs.entity, query.entity!),
        defined(query.entityId) && eq(auditLogs.entityId, query.entityId!),
        defined(query.actorId) && eq(auditLogs.actorId, query.actorId!),
        from && gte(auditLogs.createdAt, from),
        to && lt(auditLogs.createdAt, to),
        // A trigger keeps uuidv7 ids in commit order per org, so "older than
        // the cursor" is a plain comparison that can't skip late commits.
        defined(query.cursor) && lt(auditLogs.id, query.cursor!),
      ].filter((filter) => filter !== false && filter !== undefined)

      // RLS limits rows to the active org.
      const rows = await orgTx((tx) =>
        tx
          .select({
            id: auditLogs.id,
            action: auditLogs.action,
            entity: auditLogs.entity,
            entityId: auditLogs.entityId,
            before: auditLogs.before,
            after: auditLogs.after,
            ip: auditLogs.ip,
            createdAt: auditLogs.createdAt,
            actorId: users.id,
            actorName: users.name,
            actorEmail: users.email,
          })
          .from(auditLogs)
          .leftJoin(users, eq(users.id, auditLogs.actorId))
          .where(and(...filters))
          .orderBy(desc(auditLogs.id))
          .limit(limit + 1)
      )

      const items = rows.slice(0, limit)
      return {
        items: items.map(({ actorId, actorName, actorEmail, ...row }) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          // users.name/email are NOT NULL, so a joined actor is complete.
          actor: actorId
            ? { id: actorId, name: actorName!, email: actorEmail! }
            : null,
        })),
        nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
      }
    },
    {
      org: true,
      permission: "audit.read",
      query: auditLogQuery,
      response: {
        200: z.object({
          items: z.array(AuditLogItem),
          nextCursor: uuid.nullable(),
        }),
        401: messageError,
        403: messageError,
        422: validationError,
      },
      detail: {
        tags: ["Audit"],
        summary: "Audit log of the active organization",
        description:
          "Newest first. Pass nextCursor as cursor for the next page. Owners only.",
      },
    }
  )
