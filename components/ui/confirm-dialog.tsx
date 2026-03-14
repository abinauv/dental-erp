"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "destructive" | "default"
  onConfirm: () => void | Promise<void>
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
    } finally {
      setIsLoading(false)
      onOpenChange(false)
    }
  }

  const busy = loading || isLoading

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={busy}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Hook for easy usage: const { confirm, ConfirmDialogComponent } = useConfirmDialog() */
export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean
    title: string
    description: string
    confirmLabel: string
    variant: "destructive" | "default"
    resolve: ((value: boolean) => void) | null
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "destructive",
    resolve: null,
  })

  const confirm = (opts: {
    title: string
    description: string
    confirmLabel?: string
    variant?: "destructive" | "default"
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: opts.title,
        description: opts.description,
        confirmLabel: opts.confirmLabel || "Confirm",
        variant: opts.variant || "destructive",
        resolve,
      })
    })
  }

  const ConfirmDialogComponent = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open && state.resolve) {
          state.resolve(false)
        }
        setState((prev) => ({ ...prev, open, resolve: null }))
      }}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      variant={state.variant}
      onConfirm={() => {
        state.resolve?.(true)
        setState((prev) => ({ ...prev, open: false, resolve: null }))
      }}
    />
  )

  return { confirm, ConfirmDialogComponent }
}
