# Hestia

ระบบบริหารบ้านเช่าและอพาร์ทเม้นท์แบบ SaaS ดูสเปกได้ที่ [docs/SPEC.md](docs/SPEC.md)

## โครงสร้าง

| Path | หน้าที่ |
|---|---|
| `apps/web` | Next.js + shadcn (พอร์ต 3000) |
| `apps/api` | Elysia API (พอร์ต 3001, Swagger UI ที่ `/swagger`) |
| `packages/db` | Drizzle schema, migration, seed |
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

## Test

```bash
bun run test               # รันครบ 3 ระดับตามลำดับ
bun test:unit              # *.unit.test.ts — ไม่แตะฐานข้อมูล
bun test:integration       # *.integration.test.ts — เรียก app.handle() กับฐานข้อมูลจริง
bun test:e2e               # *.e2e.test.ts — เปิด server จริงแล้วยิงผ่าน HTTP
```

integration และ e2e ใช้ฐานข้อมูล `hestia_test` ที่ถูกสร้าง migrate และล้างข้อมูลใหม่ทุกครั้งที่รัน (ต้อง `bun db:up` ไว้ก่อน) และไม่แตะฐานข้อมูล dev

## Auth

ใช้ Better Auth ที่ `/api/auth/*` (สมัคร/ล็อกอินด้วยอีเมล + รหัสผ่าน, session แบบ cookie) route ที่ต้องล็อกอินให้ใส่ `auth: true` แล้วจะได้ `user` และ `session` ใน handler

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
