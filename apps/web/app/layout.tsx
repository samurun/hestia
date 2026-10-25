import type { Metadata } from "next"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { Geist_Mono, IBM_Plex_Sans_Thai } from "next/font/google"

import "@workspace/ui/globals.css"
import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { ThemeProvider } from "@/components/theme-provider"

// Plex Sans Thai covers both Thai and Latin, so one face serves the whole UI.
const fontSans = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: { default: "Hestia", template: "%s · Hestia" },
  description: "ระบบบริหารบ้านเช่าและอพาร์ทเม้นท์",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        fontSans.variable,
        "font-sans"
      )}
    >
      <body>
        <NuqsAdapter>
          <ThemeProvider>
            <TooltipProvider>
              {children}
              <Toaster position="top-center" />
            </TooltipProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
