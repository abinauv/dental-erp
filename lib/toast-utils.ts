/**
 * Standardized toast patterns for mutations.
 * Import and use with the useToast hook for consistent user feedback.
 *
 * Usage:
 *   const { toast } = useToast()
 *   toast(toastSuccess("Patient created"))
 *   toast(toastError("Failed to save"))
 */

export function toastSuccess(message: string, description?: string) {
  return {
    title: message,
    description,
  } as const
}

export function toastError(message: string, description?: string) {
  return {
    title: message,
    description: description || "Please try again or contact support if the issue persists.",
    variant: "destructive" as const,
  }
}

export function toastInfo(message: string, description?: string) {
  return {
    title: message,
    description,
  } as const
}

/**
 * Wrap an async mutation with automatic success/error toasts.
 *
 * Usage:
 *   await withToast(toast, () => fetch(...), {
 *     loading: "Saving...",
 *     success: "Saved!",
 *     error: "Failed to save"
 *   })
 */
export async function withToast<T>(
  toast: (opts: { title: string; description?: string; variant?: "destructive" }) => void,
  fn: () => Promise<T>,
  messages: {
    success: string
    error: string
    successDescription?: string
    errorDescription?: string
  }
): Promise<T | null> {
  try {
    const result = await fn()
    toast(toastSuccess(messages.success, messages.successDescription))
    return result
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : messages.errorDescription
    toast(toastError(messages.error, errMsg))
    return null
  }
}
