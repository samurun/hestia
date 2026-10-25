import { and, desc, eq, gte, lt, schema } from "@workspace/db"
import { Elysia, status, t } from "elysia"

import { rbacPlugin } from "./plugins/rbac"

const { auditLogs, users } = schema

const Message = t.Object({ message: t.String() })
const Uuid = t.String({ format: "uuid" })

const AuditLogItem = t.Object({
  id: Uuid,
  action: t.String(),
  entity: t.String(),
  entityId: t.Nullable(Uuid),
  actor: t.Nullable(
    t.Object({ id: Uuid, name: t.String(), email: t.String() })
  ),
  before: t.Unknown(),
  after: t.Unknown(),
  ip: t.Nullable(t.String()),
  createdAt: t.String({ format: "date-time" }),
})

export const auditRoutes = new Elysia({ prefix: "/audit-logs" })
  .use(rbacPlugin)
  .get(
    "/",
    async ({ query, orgTx }) => {
      const limit = query.limit ?? 50
      const from = query.from === undefined ? undefined : new Date(query.from)
      const to = query.to === undefined ? undefined : new Date(query.to)
      if (from && to && from >= to) {
        throw status(422, { message: "from must be earlier than to" })
      }

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
      query: t.Object({
        action: t.Optional(t.String({ minLength: 1 })),
        entity: t.Optional(t.String({ minLength: 1 })),
        entityId: t.Optional(Uuid),
        actorId: t.Optional(Uuid),
        from: t.Optional(t.String({ format: "date-time" })),
        to: t.Optional(t.String({ format: "date-time" })),
        cursor: t.Optional(Uuid),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      }),
      response: {
        200: t.Object({
          items: t.Array(AuditLogItem),
          nextCursor: t.Nullable(Uuid),
        }),
        401: Message,
        403: Message,
        422: Message,
      },
      detail: {
        tags: ["Audit"],
        summary: "Audit log of the active organization",
        description:
          "Newest first. Pass nextCursor as cursor for the next page. Owners only.",
      },
    }
  )
