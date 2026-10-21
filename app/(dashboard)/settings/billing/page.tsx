'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Receipt, Save } from 'lucide-react'
import { GatewaySettings } from '@/components/billing/gateway-settings'

export default function BillingSettingsPage() {
  const t = useTranslations('settings.billing')
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState({
    cgstRate: '9',
    sgstRate: '9',
    defaultPaymentTerms: '30',
    invoicePrefix: 'INV',
    receiptPrefix: 'REC',
    invoiceStartingNumber: '1001',
    invoiceNotes: 'Thank you for choosing our services.',
    termsAndConditions:
      'Payment is due within 30 days from the invoice date.\nLate payments may incur additional charges.',
    currencySymbol: '₹',
    currencyCode: 'INR',
    enableAutoInvoice: 'true',
    lateFeePercentage: '2',
    minimumDueAmount: '100',
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings?category=billing')
      const result = await response.json()

      if (result.success && result.data) {
        const settingsMap: any = {}
        result.data.forEach((s: any) => {
          const key = s.key.replace('billing.', '')
          settingsMap[key] = s.value
        })

        setSettings((prev) => ({ ...prev, ...settingsMap }))
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const settingsArray = Object.entries(settings).map(([key, value]) => ({
        key: `billing.${key}`,
        value: value.toString(),
        category: 'billing',
      }))

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsArray }),
      })

      if (response.ok) {
        toast({
          title: t('success'),
          description: t('savedSuccess'),
        })
      } else {
        throw new Error('Failed to save settings')
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

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Receipt className="w-8 h-8" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="space-y-6">
        {/* Payment Gateway */}
        <GatewaySettings />

        {/* Tax Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>{t('taxConfig')}</CardTitle>
            <CardDescription>{t('taxConfigDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cgstRate">{t('cgstRate')}</Label>
                <Input
                  id="cgstRate"
                  type="number"
                  step="0.01"
                  value={settings.cgstRate}
                  onChange={(e) => setSettings({ ...settings, cgstRate: e.target.value })}
                />
                <p className="text-sm text-muted-foreground mt-1">{t('cgstHint')}</p>
              </div>

              <div>
                <Label htmlFor="sgstRate">{t('sgstRate')}</Label>
                <Input
                  id="sgstRate"
                  type="number"
                  step="0.01"
                  value={settings.sgstRate}
                  onChange={(e) => setSettings({ ...settings, sgstRate: e.target.value })}
                />
                <p className="text-sm text-muted-foreground mt-1">{t('sgstHint')}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>{t('totalGstLabel')}</strong>{' '}
                {t('totalGstValue', {
                  total: parseFloat(settings.cgstRate) + parseFloat(settings.sgstRate),
                  cgst: settings.cgstRate,
                  sgst: settings.sgstRate,
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Format */}
        <Card>
          <CardHeader>
            <CardTitle>{t('invoiceFormat')}</CardTitle>
            <CardDescription>{t('invoiceFormatDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="invoicePrefix">{t('invoicePrefix')}</Label>
                <Input
                  id="invoicePrefix"
                  value={settings.invoicePrefix}
                  onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
                  placeholder="INV"
                />
              </div>

              <div>
                <Label htmlFor="receiptPrefix">{t('receiptPrefix')}</Label>
                <Input
                  id="receiptPrefix"
                  value={settings.receiptPrefix}
                  onChange={(e) => setSettings({ ...settings, receiptPrefix: e.target.value })}
                  placeholder="REC"
                />
              </div>

              <div>
                <Label htmlFor="invoiceStartingNumber">{t('startingNumber')}</Label>
                <Input
                  id="invoiceStartingNumber"
                  type="number"
                  value={settings.invoiceStartingNumber}
                  onChange={(e) =>
                    setSettings({ ...settings, invoiceStartingNumber: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="bg-muted/50 border rounded-lg p-3">
              <p className="text-sm text-muted-foreground">
                <strong>{t('previewLabel')}</strong> {settings.invoicePrefix}
                {settings.invoiceStartingNumber}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payment Terms */}
        <Card>
          <CardHeader>
            <CardTitle>{t('paymentTerms')}</CardTitle>
            <CardDescription>{t('paymentTermsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="defaultPaymentTerms">{t('paymentDue')}</Label>
                <Input
                  id="defaultPaymentTerms"
                  type="number"
                  value={settings.defaultPaymentTerms}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultPaymentTerms: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">{t('paymentDueHint')}</p>
              </div>

              <div>
                <Label htmlFor="lateFeePercentage">{t('lateFee')}</Label>
                <Input
                  id="lateFeePercentage"
                  type="number"
                  step="0.01"
                  value={settings.lateFeePercentage}
                  onChange={(e) => setSettings({ ...settings, lateFeePercentage: e.target.value })}
                />
                <p className="text-sm text-muted-foreground mt-1">{t('lateFeeHint')}</p>
              </div>

              <div>
                <Label htmlFor="minimumDueAmount">{t('minimumDue')}</Label>
                <Input
                  id="minimumDueAmount"
                  type="number"
                  value={settings.minimumDueAmount}
                  onChange={(e) => setSettings({ ...settings, minimumDueAmount: e.target.value })}
                />
                <p className="text-sm text-muted-foreground mt-1">{t('minimumDueHint')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Currency */}
        <Card>
          <CardHeader>
            <CardTitle>{t('currencySettings')}</CardTitle>
            <CardDescription>{t('currencySettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="currencyCode">{t('currencyCode')}</Label>
                <Input
                  id="currencyCode"
                  value={settings.currencyCode}
                  onChange={(e) => setSettings({ ...settings, currencyCode: e.target.value })}
                  placeholder="INR"
                />
              </div>

              <div>
                <Label htmlFor="currencySymbol">{t('currencySymbol')}</Label>
                <Input
                  id="currencySymbol"
                  value={settings.currencySymbol}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  placeholder="₹"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Notes */}
        <Card>
          <CardHeader>
            <CardTitle>{t('invoiceFooter')}</CardTitle>
            <CardDescription>{t('invoiceFooterDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="invoiceNotes">{t('invoiceNotes')}</Label>
              <Textarea
                id="invoiceNotes"
                value={settings.invoiceNotes}
                onChange={(e) => setSettings({ ...settings, invoiceNotes: e.target.value })}
                rows={2}
                placeholder={t('invoiceNotesPlaceholder')}
              />
              <p className="text-sm text-muted-foreground mt-1">{t('invoiceNotesHint')}</p>
            </div>

            <div>
              <Label htmlFor="termsAndConditions">{t('termsAndConditions')}</Label>
              <Textarea
                id="termsAndConditions"
                value={settings.termsAndConditions}
                onChange={(e) => setSettings({ ...settings, termsAndConditions: e.target.value })}
                rows={4}
                placeholder={t('termsPlaceholder')}
              />
              <p className="text-sm text-muted-foreground mt-1">{t('termsHint')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {saving ? t('saving') : t('saveBillingSettings')}
          </Button>
        </div>
      </div>
    </div>
  )
}
