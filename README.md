# Hestia

ระบบบริหารบ้านเช่าและอพาร์ทเม้นท์แบบ SaaS ดูสเปกได้ที่ [docs/SPEC.md](docs/SPEC.md)

## โครงสร้าง

| Path | หน้าที่ |
|---|---|
| `apps/web` | Next.js 16 + shadcn (พอร์ต 3000) |
| `apps/api` | Elysia API (พอร์ต 3001, Swagger UI ที่ `/swagger`) |
| `packages/db` | Drizzle schema, migration, seed |
| `packages/shared` | zod schema และค่าคงที่ที่ API กับ web ใช้ร่วมกัน |
| `packages/ui` | shadcn components |

## เริ่มรันบนเครื่อง

```bash
bun install
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env   # แล้วใส่ BETTER_AUTH_SECRET (openssl rand -base64 32)
cp apps/web/.env.example apps/web/.env.local

bun db:up        # Postgres 18 ใน Docker (พอร์ต 5433)
bun db:migrate
bun db:seed      # org ตัวอย่าง 1 อัน
bun dev          # web + api
```

## Web

- **เรียก API:** browser เรียกแค่ `/api/*` ของ web เอง แล้ว rewrite ใน `next.config.ts` ส่งต่อไปที่ API (`API_URL`) cookie ของ session จึงเป็น first-party ไม่ต้องตั้ง CORS หรือ cookie domain
- **เช็คสิทธิ์:** `proxy.ts` ดูแค่ว่ามี cookie ไหม การตรวจจริงอยู่ใน `lib/dal.ts` (`requireMe()`, `requireActiveOrg()`) ให้เรียกจากทุกหน้า ไม่ใช่แค่จาก layout
- **API client:** ฝั่ง server ใช้ `serverApi()` ฝั่ง client ใช้ `browserApi()` ทั้งคู่เป็น Eden ที่ type ตรงกับ API
- **แยก UI กับ logic ตาม feature** (`features/<feature>/`)
  - `components/` เป็น JSX ล้วน เรียก hook ของตัวเองตัวเดียว ห้ามเรียก API, router หรือ `useState` ของ logic ใน component
  - `hooks/` เก็บ state, เรียก API และ redirect
  - `schemas.ts` เป็น zod ข้อความภาษาไทย
  - ของที่ใช้ร่วมกันทั้งแอปอยู่ใน `lib/` และ `hooks/`
- **ฟอร์ม:** ใช้ `useFormSubmit(schema, submit)` จาก `hooks/use-form-submit.ts` hook ตัวนี้ validate, จัดการ pending และ error ให้ ฟังก์ชัน `submit` คืนข้อความ error หรือไม่คืนอะไรถ้าสำเร็จ แล้วแสดง error ด้วย `<FieldError errors={…} />`
- **Query string:** ใช้ nuqs ประกาศ parser ไว้ใน `lib/search-params.ts` ให้ server ใช้ `createLoader` และ client ใช้ `useQueryState` อ่าน key เดียวกัน

## Test

```bash
bun run test               # รันครบ 3 ระดับตามลำดับ
bun test:unit              # *.unit.test.ts — ไม่แตะฐานข้อมูล
bun test:integration       # *.integration.test.ts — เรียก app.handle() กับฐานข้อมูลจริง
bun test:e2e               # api: *.e2e.test.ts ยิง HTTP · web: Playwright (e2e/*.e2e.ts)
```

e2e ของ web ต้องติดตั้ง browser ครั้งแรกด้วย `bunx playwright install chromium` ตัวเทสต์จะ build Next ไปไว้ใน `.next-e2e` แล้วรันที่พอร์ต 3100 คู่กับ API พอร์ต 3101 จึงรันพร้อม `bun dev` ได้

integration และ e2e ใช้ฐานข้อมูล `hestia_test` ที่ถูกสร้าง migrate และล้างข้อมูลใหม่ทุกครั้งที่รัน (ต้อง `bun db:up` ไว้ก่อน) และไม่แตะฐานข้อมูล dev

## Validation

กฎ validation อยู่ใน `packages/shared` ที่เดียว (zod ข้อความภาษาไทย)
- **API:** ใช้ schema ของ request เป็น `body` / `query` / `params` ของ Elysia ได้ตรงๆ ถ้าไม่ผ่านจะได้ 422 พร้อมข้อความจาก schema และ Scalar แสดง schema ผ่าน `z.toJSONSchema`
- **web:** ใน `features/*/schemas.ts` ประกอบฟอร์มจาก field schema ชุดเดียวกัน
- **สมัครสมาชิก:** endpoint ของ Better Auth ใช้ `signUpBody` ผ่าน hook ใน `auth.ts` (ไม่ผ่านได้ 400 `VALIDATION_ERROR`) ฟอร์มสมัครของ web ก็ต่อยอดจาก schema ตัวเดียวกัน
- **รหัสผ่าน:** ความยาวอ่านจาก `PASSWORD_MIN_LENGTH` / `PASSWORD_MAX_LENGTH` ทั้งใน Better Auth และในฟอร์ม
- **response:** ใช้ zod เหมือน request ส่วน error ใช้ `messageError` (error ที่ API ตอบเอง) และ `validationError` (422 จาก Elysia)
- **DB:** CHECK constraint ยังอยู่ เป็นด่านสุดท้าย

## Auth

ใช้ Better Auth ที่ `/api/auth/*` (สมัคร/ล็อกอินด้วยอีเมล + รหัสผ่าน, session แบบ cookie) route ที่ต้องล็อกอินให้ใส่ `auth: true` แล้วจะได้ `user` และ `session` ใน handler

route ที่ทำงานกับข้อมูลของ org ให้ `.use(orgPlugin)` แล้วใส่ `org: true` ระบบจะตรวจว่าล็อกอินแล้ว และเป็นสมาชิกของ active org ใน session ถ้าไม่ผ่านจะได้ 401 หรือ 403 handler จะได้ค่าต่อไปนี้
- `org`: `{ id, name, role }`
- `orgTx(fn)`: เปิด transaction ที่ตั้ง RLS ของ org นั้นให้แล้ว เห็นข้อมูลเฉพาะ org ที่ active อยู่ แม้ผู้ใช้จะเป็นสมาชิกหลาย org และล็อก membership ไว้จนจบ transaction ถ้าถูกถอดออกระหว่าง request จะได้ 403 ห้ามเรียก `db` ตรงๆ สำหรับข้อมูลของ org

```ts
new Elysia()
  .use(orgPlugin)
  .get("/units", ({ orgTx }) => orgTx((tx) => tx.select().from(units)), {
    org: true,
  })
```

**สิทธิ์ตาม role:** ใช้ `.use(rbacPlugin)` แล้วใส่ `permission: "<ชื่อ>"` คู่กับ `org: true` ถ้า role ไม่มีสิทธิ์จะได้ 403 รายชื่อ permission ทั้งหมดอยู่ใน [apps/api/src/rbac.ts](apps/api/src/rbac.ts) ที่เดียว ห้ามเขียน `if (role === …)` กระจายไว้ใน handler

```ts
.get("/audit-logs", handler, { org: true, permission: "audit.read" })
```

**ขอบเขตรายโครงการ:** RLS บังคับให้ owner เห็นทุกโครงการ ส่วน manager กับ staff เห็นเฉพาะโครงการที่ถูกมอบหมายใน `membership_properties`
- manager ที่สร้างโครงการจะถูกมอบหมายให้ดูแลโครงการนั้นอัตโนมัติ (trigger แบบ BEFORE INSERT) จึงใช้ `INSERT ... RETURNING` ได้
- ตารางที่ผูกกับโครงการควรใช้ `app_can_read_property()` และ `app_can_manage_property()` แบบเดียวกับ `properties`
- ใน TypeScript ให้ใช้ `can(role, "properties.all")` แทน `role === "owner"`

## Audit log

ทุกการเปลี่ยนแปลงเรื่องเงิน สัญญา สิทธิ์ผู้ใช้ และการตั้งค่า ต้องบันทึก audit log ใน route ที่มี `org: true` ให้เรียก `audit(tx, …)` ด้วย `tx` ตัวเดียวกับที่ทำการเปลี่ยนแปลง log กับข้อมูลจะได้ commit หรือ rollback ไปพร้อมกัน

```ts
orgTx(async (tx) => {
  await tx.update(units).set(changes).where(eq(units.id, id))
  await audit(tx, { action: "unit.update", entity: "unit", entityId: id, before, after: changes })
})
```

- `action` ใช้รูปแบบ `<entity>.<verb>`
- ระบบเติม actor, org และ IP ให้เอง
- ตาราง `audit_logs` เพิ่มได้อย่างเดียว แก้ ลบ หรือ truncate ไม่ได้
- owner ดู log ได้ที่ `GET /audit-logs` (มี filter และ cursor)
- IP ได้มาจาก socket ถ้ารันอยู่หลัง reverse proxy ให้ตั้ง `TRUST_PROXY_HOPS` เป็นจำนวน proxy ระบบจะนับจากท้ายของ `X-Forwarded-For` เพราะค่าทางซ้ายเป็นค่าที่ client ส่งมาเองและปลอมได้
- trigger บังคับ append-only กับทุก role และทำให้ลำดับ id ตรงกับลำดับ commit ของแต่ละ org การแบ่งหน้าด้วย cursor จึงไม่ข้าม log ที่ commit ช้า แลกกับการที่การเขียน audit ใน org เดียวกันต้องรอคิวกัน

## ฐานข้อมูล

- แก้ schema ใน `packages/db/src/schema/` แล้วรัน `bun db:generate` และ `bun db:migrate`
- มี 2 role:
  - `hestia` เป็นเจ้าของ schema ใช้กับ migration และ seed
  - `hestia_app` เป็น role ที่ API ใช้ และถูกบังคับด้วย RLS
- ตารางของ org ต้องมี `org_id` และใส่ `orgIsolation()` ไว้ใน policy
- query ข้อมูลของ org ต้องรันผ่าน `withOrg(db, orgId, (tx) => …)` ถ้าไม่ใช้จะไม่เห็นข้อมูลเลย
- query ที่ต้องรู้ว่าใครล็อกอินอยู่ แต่ยังไม่ได้เลือก org (เช่น ดูรายการ org ของตัวเอง) ให้ใช้ `withContext(db, { userId }, …)`
- `memberships` เพิ่ม แก้ หรือลบได้เฉพาะ owner ของ org นั้น RLS บังคับข้อนี้ผ่าน function ใน `0002_memberships.sql`
- ห้ามเชื่อ `session.activeOrgId` ตรงๆ ต้องตรวจด้วย `findMembership()` ทุกครั้ง
- เงินเก็บเป็นสตางค์ (จำนวนเต็ม)

## เพิ่ม shadcn component

```bash
bunx --bun shadcn@latest add button -c apps/web
```

component จะไปอยู่ที่ `packages/ui/src/components` แล้ว import ด้วย `@workspace/ui/components/button`
