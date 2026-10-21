'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
  description,
}: LanguagePreferenceCardProps) {
  const router = useRouter()
  const t = useTranslations('settings.languageCard')
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
        throw new Error(body.error || t('saveFailed'))
      }

      toast({
        title: t('languageUpdated'),
        description:
          selected === INHERIT
            ? t('followingDefault')
            : t('formattingNow', { label: getLocaleLabel(selected) }),
      })

      // The locale is resolved server-side on every request, so the rest of
      // the app only picks up the change once the server components re-render.
      router.refresh()
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('saveFailed'),
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
          {t('title')}
        </CardTitle>
        <CardDescription>{description ?? t('defaultDescription')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="locale">{t('language')}</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger id="locale" className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT}>
                {hospitalLocale
                  ? t('useClinicDefaultWith', { label: getLocaleLabel(hospitalLocale) })
                  : t('useClinicDefault')}
              </SelectItem>
              {supportedLocales.map((value) => (
                <SelectItem key={value} value={value}>
                  {getLocaleLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t('inheritHint')}</p>
        </div>

        <div className="rounded-md border p-4">
          <p className="text-sm font-medium">{t('preview')}</p>
          <dl className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="flex gap-2">
              <dt>{t('amount')}</dt>
              <dd className="font-medium text-foreground">
                {formatCurrency(125000.5, { locale: effective, currency })}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>{t('date')}</dt>
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
          {t('save')}
        </Button>
      </CardFooter>
    </Card>
  )
}
