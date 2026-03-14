"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell, Check, CheckCheck, Info, AlertTriangle, AlertCircle, Calendar, CreditCard, Package, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  readAt: string | null
  entityType: string | null
  entityId: string | null
  createdAt: string
}

const TYPE_CONFIG: Record<string, { icon: typeof Info; color: string }> = {
  INFO: { icon: Info, color: "text-blue-500" },
  SUCCESS: { icon: Check, color: "text-green-500" },
  WARNING: { icon: AlertTriangle, color: "text-yellow-500" },
  ERROR: { icon: AlertCircle, color: "text-red-500" },
  APPOINTMENT: { icon: Calendar, color: "text-purple-500" },
  PAYMENT: { icon: CreditCard, color: "text-emerald-500" },
  INVENTORY: { icon: Package, color: "text-orange-500" },
  SYSTEM: { icon: Settings, color: "text-muted-foreground" },
}

function timeAgo(dateStr: string) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function NotificationTray() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/notifications?limit=20")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount and poll every 60s
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Refetch when dropdown opens
  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  const markAsRead = async (ids: string[]) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) return
      const data = await res.json()
      setUnreadCount(data.unreadCount)
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      )
    } catch {
      // silent fail
    }
  }

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      if (!res.ok) return
      const data = await res.json()
      setUnreadCount(data.unreadCount)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })))
    } catch {
      // silent fail
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(320px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-base">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs text-muted-foreground" onClick={markAllRead}>
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="h-[340px]">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-30" />
              No notifications yet
            </div>
          ) : (
            <div>
              {notifications.map((n) => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.INFO
                const Icon = config.icon
                return (
                  <button
                    key={n.id}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      !n.isRead && "bg-muted/30"
                    )}
                    onClick={() => {
                      if (!n.isRead) markAsRead([n.id])
                    }}
                  >
                    <div className={cn("mt-0.5 shrink-0", config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm leading-tight", !n.isRead && "font-medium")}>{n.title}</p>
                        {!n.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
