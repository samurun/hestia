import { expect, test, type Page } from "@playwright/test"

const password = "correct-horse-battery"
let n = 0
const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${++n}@example.com`

async function signUp(page: Page, name: string, orgName: string) {
  const email = uniqueEmail("web")
  await page.goto("/signup")
  await page.getByLabel("ชื่อของคุณ").fill(name)
  await page.getByLabel("อีเมล").fill(email)
  await page.getByLabel("รหัสผ่าน").fill(password)
  await page.getByLabel("ชื่อกิจการ").fill(orgName)
  await page.getByRole("button", { name: "สมัครใช้งาน" }).click()
  await expect(
    page.getByRole("heading", { name: `สวัสดี ${name}` })
  ).toBeVisible()
  return email
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "เมนูผู้ใช้" }).click()
  await page.getByRole("menuitem", { name: "ออกจากระบบ" }).click()
  await expect(page).toHaveURL(/\/login$/)
}

test("private pages redirect to login and come back after signing in", async ({
  page,
}) => {
  const email = await signUp(page, "สมชาย", "บ้านเช่าสมชาย")
  await signOut(page)

  await page.goto("/onboarding")
  await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/)

  await page.getByLabel("อีเมล").fill(email)
  await page.getByLabel("รหัสผ่าน").fill(password)
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click()
  await expect(page).toHaveURL(/\/onboarding$/)
})

test("sign-up creates the org and lands in the app shell", async ({ page }) => {
  await signUp(page, "สมหญิง", "อพาร์ทเม้นท์สมหญิง")
  await expect(page.getByText("อพาร์ทเม้นท์สมหญิง · เจ้าของ")).toBeVisible()
  await expect(page.getByRole("button", { name: "เลือกองค์กร" })).toContainText(
    "อพาร์ทเม้นท์สมหญิง"
  )
})

test("forms show Thai validation errors before calling the API", async ({
  page,
}) => {
  await page.goto("/signup")
  await page.getByLabel("อีเมล").fill("not-an-email")
  await page.getByLabel("รหัสผ่าน").fill("short")
  await page.getByRole("button", { name: "สมัครใช้งาน" }).click()

  await expect(page.getByText("กรุณากรอกชื่อ", { exact: true })).toBeVisible()
  await expect(page.getByText("รูปแบบอีเมลไม่ถูกต้อง")).toBeVisible()
  await expect(
    page.getByText("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร")
  ).toBeVisible()
  await expect(page.getByText("กรุณากรอกชื่อกิจการ")).toBeVisible()
  await expect(page).toHaveURL(/\/signup$/)
})

test("a wrong password shows an error and keeps the user on login", async ({
  page,
}) => {
  const email = await signUp(page, "สมศักดิ์", "หอพักสมศักดิ์")
  await signOut(page)

  await page.getByLabel("อีเมล").fill(email)
  await page.getByLabel("รหัสผ่าน").fill("not-the-password")
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click()
  await expect(page.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test("a second org can be created and switched to", async ({ page }) => {
  await signUp(page, "สมพร", "แห่งแรก")
  const switcher = page.getByRole("button", { name: "เลือกองค์กร" })

  await switcher.click()
  await page.getByRole("menuitem", { name: "สร้างองค์กรใหม่" }).click()
  await page.getByLabel("ชื่อกิจการ").fill("แห่งที่สอง")
  await page.getByRole("button", { name: "สร้างองค์กร" }).click()
  await expect(switcher).toContainText("แห่งที่สอง")

  await switcher.click()
  await page.getByRole("menuitem", { name: "แห่งแรก" }).click()
  await expect(switcher).toContainText("แห่งแรก")
  await expect(page.getByText("แห่งแรก · เจ้าของ")).toBeVisible()
})

test("the shell works at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signUp(page, "สมใจ", "ห้องแถวสมใจ")

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBe(0)

  await page.getByRole("button", { name: /toggle sidebar/i }).click()
  await expect(page.getByRole("link", { name: "ภาพรวม" })).toBeVisible()
  await expect(page.getByRole("button", { name: "เลือกองค์กร" })).toContainText(
    "ห้องแถวสมใจ"
  )
})
