'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Separator } from '@/components/ui/separator'
import { Building2, Save, Upload, Trash2, Loader2, Copy, Globe } from 'lucide-react'
import { RegionField } from '@/components/geo/region-field'
import { locales, localeDefaults, getLocaleLabel, type Locale } from '@/lib/i18n/config'

// Small curated option sets for the regional selectors. The clinic's current
// stored value is always merged in, so a hand-set value outside these lists is
// never silently dropped.
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']
const COUNTRIES = ['IN', 'US', 'GB', 'AE', 'SG', 'AU', 'CA', 'DE', 'JP']
const TIME_ZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
      'timeZone'
    )
  } catch {
    return [
      'Asia/Kolkata',
      'America/New_York',
      'Europe/London',
      'Europe/Berlin',
      'Asia/Dubai',
      'UTC',
    ]
  }
})()

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

type DaySchedule = { open: string; close: string; closed: boolean }
type WeekSchedule = Record<string, DaySchedule>

const DEFAULT_SCHEDULE: WeekSchedule = {
  monday: { open: '09:00', close: '20:00', closed: false },
  tuesday: { open: '09:00', close: '20:00', closed: false },
  wednesday: { open: '09:00', close: '20:00', closed: false },
  thursday: { open: '09:00', close: '20:00', closed: false },
  friday: { open: '09:00', close: '20:00', closed: false },
  saturday: { open: '09:00', close: '14:00', closed: false },
  sunday: { open: '', close: '', closed: true },
}

function parseSchedule(raw: string | null | undefined): WeekSchedule {
  if (!raw) return { ...DEFAULT_SCHEDULE }
  try {
    const parsed = JSON.parse(raw)
    const schedule: WeekSchedule = {}
    for (const day of DAYS) {
      const d = parsed[day]
      if (d && d.open && d.close) {
        schedule[day] = { open: d.open, close: d.close, closed: false }
      } else {
        schedule[day] = { open: '', close: '', closed: true }
      }
    }
    return schedule
  } catch {
    return { ...DEFAULT_SCHEDULE }
  }
}

function serializeSchedule(schedule: WeekSchedule): string {
  const obj: Record<string, { open: string | null; close: string | null }> = {}
  for (const day of DAYS) {
    const d = schedule[day]
    obj[day] = d.closed ? { open: null, close: null } : { open: d.open, close: d.close }
  }
  return JSON.stringify(obj)
}

export default function ClinicSettingsPage() {
  const t = useTranslations('settings.clinic')
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logo, setLogo] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [schedule, setSchedule] = useState<WeekSchedule>({ ...DEFAULT_SCHEDULE })
  const [patientPortalEnabled, setPatientPortalEnabled] = useState(false)
  const [hospitalSlug, setHospitalSlug] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    phone: '',
    alternatePhone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    registrationNo: '',
    gstNumber: '',
    panNumber: '',
    workingHours: '',
    bankName: '',
    bankAccountNo: '',
    bankIfsc: '',
    upiId: '',
    locale: 'en-IN',
    country: 'IN',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  })

  useEffect(() => {
    fetchClinicInfo()
  }, [])

  const fetchClinicInfo = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/clinic')
      const result = await response.json()

      if (result.success && result.data) {
        setLogo(result.data.logo || null)
        setSchedule(parseSchedule(result.data.workingHours))
        setPatientPortalEnabled(result.data.patientPortalEnabled || false)
        setHospitalSlug(result.data.slug || '')
        setFormData({
          name: result.data.name || '',
          tagline: result.data.tagline || '',
          phone: result.data.phone || '',
          alternatePhone: result.data.alternatePhone || '',
          email: result.data.email || '',
          website: result.data.website || '',
          address: result.data.address || '',
          city: result.data.city || '',
          state: result.data.state || '',
          pincode: result.data.pincode || '',
          registrationNo: result.data.registrationNo || '',
          gstNumber: result.data.gstNumber || '',
          panNumber: result.data.panNumber || '',
          workingHours: result.data.workingHours || '',
          bankName: result.data.bankName || '',
          bankAccountNo: result.data.bankAccountNo || '',
          bankIfsc: result.data.bankIfsc || '',
          upiId: result.data.upiId || '',
          locale: result.data.locale || 'en-IN',
          country: result.data.country || 'IN',
          currency: result.data.currency || 'INR',
          timezone: result.data.timezone || 'Asia/Kolkata',
        })
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('loadFailed'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/settings/clinic/logo', { method: 'POST', body: fd })
      const result = await res.json()

      if (!res.ok) throw new Error(result.error || t('uploadFailed'))

      setLogo(result.logo)
      toast({ title: t('logoUploaded'), description: t('logoUploadedDesc') })
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('uploadFailed'), description: err.message })
    } finally {
      setUploadingLogo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleLogoRemove = async () => {
    setUploadingLogo(true)
    try {
      const res = await fetch('/api/settings/clinic/logo', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove logo')

      setLogo(null)
      toast({ title: t('logoRemoved') })
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('error'), description: err.message })
    } finally {
      setUploadingLogo(false)
    }
  }

  const updateDay = useCallback(
    (day: string, field: keyof DaySchedule, value: string | boolean) => {
      setSchedule((prev) => ({
        ...prev,
        [day]: { ...prev[day], [field]: value },
      }))
    },
    []
  )

  const copyToAll = useCallback((sourceDay: string) => {
    setSchedule((prev) => {
      const source = prev[sourceDay]
      const next: WeekSchedule = {}
      for (const day of DAYS) {
        next[day] = { ...source }
      }
      return next
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...formData,
        workingHours: serializeSchedule(schedule),
        patientPortalEnabled,
      }
      const response = await fetch('/api/settings/clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: t('success'),
          description: t('savedSuccess'),
        })
      } else {
        throw new Error(result.error || 'Failed to save')
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Picking a language pulls the region's usual currency, country and time zone
  // along with it; each can still be adjusted individually below.
  const handleLocaleChange = (value: string) => {
    const defaults = localeDefaults[value as Locale]
    setFormData((prev) => ({
      ...prev,
      locale: value,
      ...(defaults
        ? { currency: defaults.currency, country: defaults.country, timezone: defaults.timezone }
        : {}),
    }))
  }

  if (loading) {
    return <div className="p-6">{t('loading')}</div>
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="w-8 h-8" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="space-y-6">
        {/* Clinic Logo */}
        <Card>
          <CardHeader>
            <CardTitle>{t('logoTitle')}</CardTitle>
            <CardDescription>{t('logoDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Preview */}
              {logo ? (
                <img
                  src={logo}
                  alt={t('logoAlt')}
                  className="h-20 w-20 rounded-lg object-cover border"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-primary text-primary-foreground text-2xl font-bold border">
                  {formData.name?.charAt(0) || 'D'}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {logo ? t('changeLogo') : t('uploadLogo')}
                </Button>
                {logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploadingLogo}
                    onClick={handleLogoRemove}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('remove')}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">{t('logoFormats')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('basicInfo')}</CardTitle>
            <CardDescription>{t('basicInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="name">{t('clinicName')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder={t('clinicNamePlaceholder')}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="tagline">{t('tagline')}</Label>
                <Input
                  id="tagline"
                  value={formData.tagline}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  placeholder={t('taglinePlaceholder')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('contactInfo')}</CardTitle>
            <CardDescription>{t('contactInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">{t('primaryPhone')}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder={t('primaryPhonePlaceholder')}
                  required
                />
              </div>

              <div>
                <Label htmlFor="alternatePhone">{t('alternatePhone')}</Label>
                <Input
                  id="alternatePhone"
                  value={formData.alternatePhone}
                  onChange={(e) => handleChange('alternatePhone', e.target.value)}
                  placeholder={t('alternatePhonePlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder={t('emailPlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="website">{t('website')}</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder={t('websitePlaceholder')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle>{t('addressTitle')}</CardTitle>
            <CardDescription>{t('addressDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="address">{t('streetAddress')}</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder={t('streetAddressPlaceholder')}
                rows={2}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">{t('city')}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder={t('cityPlaceholder')}
                  required
                />
              </div>

              <div>
                <Label htmlFor="state">{t('state')}</Label>
                <RegionField
                  id="state"
                  country={formData.country}
                  value={formData.state}
                  onChange={(v) => handleChange('state', v)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="pincode">{t('pincode')}</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => handleChange('pincode', e.target.value)}
                  placeholder={t('pincodePlaceholder')}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regional Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('regionalSettings')}
            </CardTitle>
            <CardDescription>{t('regionalSettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="locale">{t('languageLocale')}</Label>
                <Select value={formData.locale} onValueChange={handleLocaleChange}>
                  <SelectTrigger id="locale">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locales.map((l) => (
                      <SelectItem key={l} value={l}>
                        {t('localeOption', { label: getLocaleLabel(l), code: l })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="currency">{t('currency')}</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => handleChange('currency', v)}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set([formData.currency, ...CURRENCIES].filter(Boolean))).map(
                      (c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="country">{t('country')}</Label>
                <Select value={formData.country} onValueChange={(v) => handleChange('country', v)}>
                  <SelectTrigger id="country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set([formData.country, ...COUNTRIES].filter(Boolean))).map(
                      (c) => (
                        <SelectItem key={c} value={c}>
                          {t('countryOption', { name: regionName(c), code: c })}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="timezone">{t('timeZone')}</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(v) => handleChange('timezone', v)}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Array.from(new Set([formData.timezone, ...TIME_ZONES].filter(Boolean))).map(
                      (tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('regionalHint')}</p>
          </CardContent>
        </Card>

        {/* Registration & Tax */}
        <Card>
          <CardHeader>
            <CardTitle>{t('registrationTax')}</CardTitle>
            <CardDescription>{t('registrationTaxDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="registrationNo">{t('registrationNumber')}</Label>
                <Input
                  id="registrationNo"
                  value={formData.registrationNo}
                  onChange={(e) => handleChange('registrationNo', e.target.value)}
                  placeholder={t('registrationPlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="gstNumber">{t('gstNumber')}</Label>
                <Input
                  id="gstNumber"
                  value={formData.gstNumber}
                  onChange={(e) => handleChange('gstNumber', e.target.value)}
                  placeholder={t('gstPlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="panNumber">{t('panNumber')}</Label>
                <Input
                  id="panNumber"
                  value={formData.panNumber}
                  onChange={(e) => handleChange('panNumber', e.target.value)}
                  placeholder={t('panPlaceholder')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card>
          <CardHeader>
            <CardTitle>{t('workingHours')}</CardTitle>
            <CardDescription>{t('workingHoursDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Header row */}
            <div className="hidden md:grid md:grid-cols-[140px_1fr_1fr_80px_40px] gap-3 items-center text-xs font-medium text-muted-foreground px-1">
              <span>{t('colDay')}</span>
              <span>{t('colOpensAt')}</span>
              <span>{t('colClosesAt')}</span>
              <span className="text-center">{t('colOpen')}</span>
              <span />
            </div>
            <Separator />
            {DAYS.map((day) => {
              const d = schedule[day]
              return (
                <div
                  key={day}
                  className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_80px_40px] gap-3 items-center"
                >
                  <span className="text-sm font-medium">{t(`days.${day}`)}</span>
                  <Input
                    type="time"
                    value={d.closed ? '' : d.open}
                    disabled={d.closed}
                    onChange={(e) => updateDay(day, 'open', e.target.value)}
                    className={d.closed ? 'opacity-40' : ''}
                  />
                  <Input
                    type="time"
                    value={d.closed ? '' : d.close}
                    disabled={d.closed}
                    onChange={(e) => updateDay(day, 'close', e.target.value)}
                    className={d.closed ? 'opacity-40' : ''}
                  />
                  <div className="flex justify-center">
                    <Switch
                      checked={!d.closed}
                      onCheckedChange={(checked) => updateDay(day, 'closed', !checked)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={t('copyToAll')}
                    onClick={() => copyToAll(day)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t('bankTitle')}</CardTitle>
            <CardDescription>{t('bankDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bankName">{t('bankName')}</Label>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                  placeholder={t('bankNamePlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="bankAccountNo">{t('accountNumber')}</Label>
                <Input
                  id="bankAccountNo"
                  value={formData.bankAccountNo}
                  onChange={(e) => handleChange('bankAccountNo', e.target.value)}
                  placeholder={t('accountNumberPlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="bankIfsc">{t('ifscCode')}</Label>
                <Input
                  id="bankIfsc"
                  value={formData.bankIfsc}
                  onChange={(e) => handleChange('bankIfsc', e.target.value)}
                  placeholder={t('ifscPlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="upiId">{t('upiId')}</Label>
                <Input
                  id="upiId"
                  value={formData.upiId}
                  onChange={(e) => handleChange('upiId', e.target.value)}
                  placeholder={t('upiPlaceholder')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Portal */}
        <Card>
          <CardHeader>
            <CardTitle>{t('portalTitle')}</CardTitle>
            <CardDescription>{t('portalDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('enablePortal')}</p>
                <p className="text-xs text-muted-foreground">{t('enablePortalHint')}</p>
              </div>
              <Switch checked={patientPortalEnabled} onCheckedChange={setPatientPortalEnabled} />
            </div>
            {patientPortalEnabled && hospitalSlug && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-sm font-medium">{t('portalLoginUrl')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background p-2 rounded border break-all">
                    {typeof window !== 'undefined' ? window.location.origin : ''}
                    /portal/login?clinic={hospitalSlug}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/portal/login?clinic=${hospitalSlug}`
                      )
                      toast({ title: t('copied'), description: t('copiedDesc') })
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('portalUrlHint')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {saving ? t('saving') : t('saveClinicInfo')}
          </Button>
        </div>
      </div>
    </div>
  )
}
