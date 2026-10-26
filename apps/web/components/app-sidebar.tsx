"use client"

import {
  BuildingIcon,
  UserCogIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react"
import { can, type Permission } from "@workspace/shared"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

import { OrgSwitcher } from "@/features/org/components/org-switcher"
import type { roleLabels } from "@/features/org/roles"
import { NavUser } from "@/features/session/components/nav-user"

type Org = { id: string; name: string; role: keyof typeof roleLabels }

// Modules arrive phase by phase (docs/SPEC.md §11); unbuilt ones show as soon.
// Items with a permission are hidden from roles that can't use them; the
// page and API enforce it regardless.
const nav: {
  title: string
  href?: string
  icon: typeof LayoutDashboardIcon
  permission?: Permission
}[] = [
  { title: "ภาพรวม", href: "/", icon: LayoutDashboardIcon },
  { title: "โครงการและห้อง", icon: BuildingIcon },
  { title: "ผู้เช่า", icon: UsersIcon },
  { title: "บิลและการชำระ", icon: ReceiptIcon },
  { title: "แจ้งซ่อม", icon: WrenchIcon },
  {
    title: "ทีมงาน",
    href: "/team",
    icon: UserCogIcon,
    permission: "members.manage",
  },
]

export function AppSidebar({
  user,
  orgs,
  activeOrg,
}: {
  user: { name: string; email: string }
  orgs: Org[]
  activeOrg: Org
}) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <OrgSwitcher orgs={orgs} active={activeOrg} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>เมนู</SidebarGroupLabel>
          <SidebarMenu>
            {nav
              .filter(
                (item) =>
                  !item.permission || can(activeOrg.role, item.permission)
              )
              .map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.href ? (
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={pathname === item.href}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <>
                      <SidebarMenuButton tooltip={item.title} disabled>
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>เร็วๆ นี้</SidebarMenuBadge>
                    </>
                  )}
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
