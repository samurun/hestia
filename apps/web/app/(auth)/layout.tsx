import { HouseIcon } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <HouseIcon className="size-4" />
        </span>
        Hestia
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}
