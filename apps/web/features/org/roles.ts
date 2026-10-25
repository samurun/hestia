export const roleLabels = {
  owner: "เจ้าของ",
  manager: "ผู้จัดการ",
  staff: "พนักงาน",
} as const satisfies Record<"owner" | "manager" | "staff", string>
