import { expect, test, type Browser, type Page } from "@playwright/test"

const password = "correct-horse-battery"
let n = 0
const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${++n}@example.com`

async function signUpOwner(page: Page, orgName: string) {
  await page.goto("/signup")
  await page.getByLabel("ชื่อของคุณ").fill("เจ้าของ")
  await page.getByLabel("อีเมล").fill(uniqueEmail("owner"))
  await page.getByLabel("รหัสผ่าน").fill(password)
  await page.getByLabel("ชื่อกิจการ").fill(orgName)
  await page.getByRole("button", { name: "สมัครใช้งาน" }).click()
  await expect(
    page.getByRole("heading", { name: "สวัสดี เจ้าของ" })
  ).toBeVisible()
}

async function inviteFromTeamPage(page: Page, email: string, role: string) {
  await page.getByRole("link", { name: "ทีมงาน" }).click()
  await expect(page.getByRole("heading", { name: "ทีมงาน" })).toBeVisible()
  await page.getByLabel("อีเมล").fill(email)
  await page.getByLabel("บทบาท").click()
  await page.getByRole("option", { name: role }).click()
  await page.getByRole("button", { name: "ส่งคำเชิญ" }).click()
  const link = page.getByLabel("ลิงก์คำเชิญ")
  await expect(link).toBeVisible()
  return new URL(await link.inputValue()).pathname
}

async function freshPage(browser: Browser) {
  return (await browser.newContext({ locale: "th-TH" })).newPage()
}

test("an invitee signs up from the link and joins with the invited role", async ({
  page,
  browser,
}) => {
  await signUpOwner(page, "หอพักเชิญ")
  const inviteeEmail = uniqueEmail("invitee")
  const invitePath = await inviteFromTeamPage(page, inviteeEmail, "ผู้จัดการ")

  const invitee = await freshPage(browser)
  await invitee.goto(invitePath)
  await expect(invitee.getByText("เข้าร่วม หอพักเชิญ")).toBeVisible()
  await invitee.getByRole("link", { name: `สมัครด้วย ${inviteeEmail}` }).click()

  await expect(invitee.getByLabel("อีเมล")).toHaveValue(inviteeEmail)
  await invitee.getByLabel("ชื่อของคุณ").fill("ผู้จัดการใหม่")
  await invitee.getByLabel("รหัสผ่าน").fill(password)
  await invitee.getByRole("button", { name: "สมัครและเข้าร่วม" }).click()
  await expect(invitee.getByText("หอพักเชิญ · ผู้จัดการ")).toBeVisible()

  // Managers don't manage the team.
  await expect(invitee.getByRole("link", { name: "ทีมงาน" })).toHaveCount(0)
  const teamPage = await invitee.goto("/team")
  expect(teamPage?.status()).toBe(404)

  // The owner sees them as a member and the invite as accepted.
  await page.reload()
  await expect(page.getByRole("cell", { name: /ผู้จัดการใหม่/ })).toBeVisible()
  await expect(page.getByText("เข้าร่วมแล้ว")).toBeVisible()
})

test("an invite opened while signed in as someone else asks to switch", async ({
  page,
  browser,
}) => {
  await signUpOwner(page, "หอพักผิดบัญชี")
  const invitePath = await inviteFromTeamPage(
    page,
    uniqueEmail("intended"),
    "พนักงาน"
  )

  const other = await freshPage(browser)
  await signUpOwner(other, "กิจการอื่น")
  await other.goto(invitePath)
  await expect(other.getByText(/แต่คำเชิญนี้ส่งถึง/)).toBeVisible()
  await other
    .getByRole("button", { name: "ออกจากระบบแล้วใช้บัญชีอื่น" })
    .click()
  await expect(other).toHaveURL(/\/login\?next=%2Finvite%2F/)
})

test("a revoked invite can't be used", async ({ page, browser }) => {
  await signUpOwner(page, "หอพักยกเลิก")
  const invitePath = await inviteFromTeamPage(
    page,
    uniqueEmail("revoked"),
    "พนักงาน"
  )
  await page.getByRole("button", { name: "ยกเลิก" }).click()
  await expect(page.getByText("ยกเลิกแล้ว", { exact: true })).toBeVisible()

  const invitee = await freshPage(browser)
  await invitee.goto(invitePath)
  await expect(invitee.getByText("คำเชิญนี้ถูกยกเลิกแล้ว")).toBeVisible()
})
