"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getNavigationForRole } from "@/config/nav"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSidebar } from "./sidebar-context"

interface MobileSidebarProps {
  role: string
  hospitalName?: string
  hospitalLogo?: string | null
  plan?: string
}

export function MobileSidebar({ role, hospitalName, hospitalLogo }: MobileSidebarProps) {
  const pathname = usePathname()
  const navigation = getNavigationForRole(role)
  const { mobileOpen, setMobileOpen } = useSidebar()

  // Close on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, setMobileOpen])

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false)
    }
    if (mobileOpen) window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [mobileOpen, setMobileOpen])

  if (!mobileOpen) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar panel */}
      <div className="fixed inset-y-0 left-0 w-[min(288px,80vw)] bg-card border-r shadow-xl animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            {hospitalLogo ? (
              <img src={hospitalLogo} alt={hospitalName || "Logo"} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                {hospitalName?.charAt(0) || "D"}
              </div>
            )}
            <span className="text-sm font-semibold truncate">{hospitalName || "Dental Clinic"}</span>
          </Link>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 h-[calc(100vh-3.5rem)]">
          <nav className="flex flex-col gap-1 p-3">
            {navigation.map((section, sectionIndex) => (
              <div key={section.title} className={sectionIndex > 0 ? "mt-4" : ""}>
                <h4 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </h4>
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href))
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                          isActive
                            ? "bg-secondary text-secondary-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>
      </div>
    </div>
  )
}
