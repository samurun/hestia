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
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

bun db:up        # Postgres 18 ใน Docker (พอร์ต 5433)
bun db:migrate
bun db:seed      # org ตัวอย่าง 1 อัน
bun dev          # web + api
```

## ฐานข้อมูล

- แก้ schema ใน `packages/db/src/schema/` แล้วรัน `bun db:generate` และ `bun db:migrate`
- มี 2 role:
  - `hestia` เป็นเจ้าของ schema ใช้กับ migration และ seed
  - `hestia_app` เป็น role ที่ API ใช้ และถูกบังคับด้วย RLS
- ตารางของ org ต้องมี `org_id` และใส่ `orgIsolation()` ไว้ใน policy
- query ข้อมูลของ org ต้องรันผ่าน `withOrg(db, orgId, (tx) => …)` ถ้าไม่ใช้จะไม่เห็นข้อมูลเลย
- เงินเก็บเป็นสตางค์ (จำนวนเต็ม)

## เพิ่ม shadcn component

```bash
bunx --bun shadcn@latest add button -c apps/web
```

component จะไปอยู่ที่ `packages/ui/src/components` แล้ว import ด้วย `@workspace/ui/components/button`
