'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Languages, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { getLocaleLabel, resolveLocaleCascade } from '@/lib/i18n/config'
import { formatCurrency, formatDate } from '@/lib/i18n/format'

/**
 * `<SelectItem value="">` is not allowed, so "inherit" stands in for the empty
 * choice in the widget and is sent to the API as `null`.
 */
const INHERIT = 'inherit'

interface LanguagePreferenceCardProps {
  /** The person's stored override. `null` means inherit from the clinic. */
  locale: string | null
  /** The clinic's locale, shown so "use clinic default" is not a mystery. */
  hospitalLocale: string | null
  /**
   * The clinic's ISO 4217 currency. A personal language choice changes how
   * amounts are *grouped and punctuated*, never which currency the clinic
   * bills in, and the preview has to show that honestly.
   */
  currency: string
  supportedLocales: readonly string[]
  /** Endpoint accepting `PATCH { locale: string | null }`. */
  endpoint: string
  description?: string
}

export function LanguagePreferenceCard({
  locale,
  hospitalLocale,
  currency,
  supportedLocales,
  endpoint,
  description = 'Choose how dates, numbers and amounts are formatted for you. Everyone else at this clinic is unaffected.',
}: LanguagePreferenceCardProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [selected, setSelected] = useState(locale ?? INHERIT)
  const [saving, setSaving] = useState(false)

  const effective = resolveLocaleCascade(selected === INHERIT ? null : selected, hospitalLocale)
  const dirty = selected !== (locale ?? INHERIT)

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: selected === INHERIT ? null : selected }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save language')
      }

      toast({
        title: 'Language updated',
        description:
          selected === INHERIT
            ? 'You are now following the clinic default.'
            : `Formatting now uses ${getLocaleLabel(selected)}.`,
      })

      // The locale is resolved server-side on every request, so the rest of
      // the app only picks up the change once the server components re-render.
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save language',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          Language & Formatting
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="locale">Language</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger id="locale" className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT}>
                Use clinic default
                {hospitalLocale ? ` (${getLocaleLabel(hospitalLocale)})` : ''}
              </SelectItem>
              {supportedLocales.map((value) => (
                <SelectItem key={value} value={value}>
                  {getLocaleLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Leaving this on the clinic default means it follows the clinic if the clinic&apos;s
            language is ever changed.
          </p>
        </div>

        <div className="rounded-md border p-4">
          <p className="text-sm font-medium">Preview</p>
          <dl className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="flex gap-2">
              <dt>Amount</dt>
              <dd className="font-medium text-foreground">
                {formatCurrency(125000.5, { locale: effective, currency })}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Date</dt>
              <dd className="font-medium text-foreground">
                {formatDate(new Date(2026, 0, 31), { locale: effective })}
              </dd>
            </div>
          </dl>
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </CardFooter>
    </Card>
  )
}
