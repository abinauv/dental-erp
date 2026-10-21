'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Shield, Lock, Clock, UserX, AlertTriangle } from 'lucide-react'
import { AuditMonitor } from '@/components/ai/audit-monitor'
import { useToast } from '@/hooks/use-toast'
import { Textarea } from '@/components/ui/textarea'

export default function SecuritySettingsPage() {
  const t = useTranslations('settings.security')
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Password Policy
  const [passwordMinLength, setPasswordMinLength] = useState(8)
  const [passwordRequireUppercase, setPasswordRequireUppercase] = useState(true)
  const [passwordRequireLowercase, setPasswordRequireLowercase] = useState(true)
  const [passwordRequireNumbers, setPasswordRequireNumbers] = useState(true)
  const [passwordRequireSpecialChars, setPasswordRequireSpecialChars] = useState(true)
  const [passwordExpiryDays, setPasswordExpiryDays] = useState(90)

  // Session Management
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(60)

  // Login Security
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(5)
  const [lockoutDurationMinutes, setLockoutDurationMinutes] = useState(30)

  // Two-Factor Authentication
  const [requireTwoFactor, setRequireTwoFactor] = useState(false)

  // IP Management
  const [allowedIPs, setAllowedIPs] = useState('')
  const [blockedIPs, setBlockedIPs] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/security')

      if (!response.ok) throw new Error(t('loadFailed'))

      const data = await response.json()
      const settings = data.data || {}

      // Load password policy settings
      if (settings.passwordMinLength !== undefined) setPasswordMinLength(settings.passwordMinLength)
      if (settings.passwordRequireUppercase !== undefined)
        setPasswordRequireUppercase(settings.passwordRequireUppercase)
      if (settings.passwordRequireLowercase !== undefined)
        setPasswordRequireLowercase(settings.passwordRequireLowercase)
      if (settings.passwordRequireNumbers !== undefined)
        setPasswordRequireNumbers(settings.passwordRequireNumbers)
      if (settings.passwordRequireSpecialChars !== undefined)
        setPasswordRequireSpecialChars(settings.passwordRequireSpecialChars)
      if (settings.passwordExpiryDays !== undefined)
        setPasswordExpiryDays(settings.passwordExpiryDays)

      // Load session settings
      if (settings.sessionTimeoutMinutes !== undefined)
        setSessionTimeoutMinutes(settings.sessionTimeoutMinutes)

      // Load login security settings
      if (settings.maxLoginAttempts !== undefined) setMaxLoginAttempts(settings.maxLoginAttempts)
      if (settings.lockoutDurationMinutes !== undefined)
        setLockoutDurationMinutes(settings.lockoutDurationMinutes)

      // Load 2FA settings
      if (settings.requireTwoFactor !== undefined) setRequireTwoFactor(settings.requireTwoFactor)

      // Load IP management settings
      if (settings.allowedIPs !== undefined) setAllowedIPs(settings.allowedIPs)
      if (settings.blockedIPs !== undefined) setBlockedIPs(settings.blockedIPs)
    } catch (error) {
      console.error('Error loading settings:', error)
      toast({
        title: t('error'),
        description: t('loadFailed'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passwordMinLength,
          passwordRequireUppercase,
          passwordRequireLowercase,
          passwordRequireNumbers,
          passwordRequireSpecialChars,
          passwordExpiryDays,
          sessionTimeoutMinutes,
          maxLoginAttempts,
          lockoutDurationMinutes,
          requireTwoFactor,
          allowedIPs,
          blockedIPs,
        }),
      })

      if (!response.ok) throw new Error(t('saveFailed'))

      toast({
        title: t('success'),
        description: t('savedSuccess'),
      })
    } catch (error) {
      toast({
        title: t('error'),
        description: t('saveFailed'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="w-8 h-8" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="space-y-6">
        {/* Password Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              {t('passwordPolicy')}
            </CardTitle>
            <CardDescription>{t('passwordPolicyDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>{t('minLength')}</Label>
              <Input
                type="number"
                value={passwordMinLength}
                onChange={(e) => setPasswordMinLength(parseInt(e.target.value) || 8)}
                min="6"
                max="32"
              />
              <p className="text-sm text-muted-foreground">{t('minLengthHint')}</p>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('requireUppercase')}</Label>
                  <p className="text-sm text-muted-foreground">{t('requireUppercaseHint')}</p>
                </div>
                <Switch
                  checked={passwordRequireUppercase}
                  onCheckedChange={setPasswordRequireUppercase}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('requireLowercase')}</Label>
                  <p className="text-sm text-muted-foreground">{t('requireLowercaseHint')}</p>
                </div>
                <Switch
                  checked={passwordRequireLowercase}
                  onCheckedChange={setPasswordRequireLowercase}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('requireNumbers')}</Label>
                  <p className="text-sm text-muted-foreground">{t('requireNumbersHint')}</p>
                </div>
                <Switch
                  checked={passwordRequireNumbers}
                  onCheckedChange={setPasswordRequireNumbers}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('requireSpecial')}</Label>
                  <p className="text-sm text-muted-foreground">{t('requireSpecialHint')}</p>
                </div>
                <Switch
                  checked={passwordRequireSpecialChars}
                  onCheckedChange={setPasswordRequireSpecialChars}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{t('passwordExpiry')}</Label>
              <Input
                type="number"
                value={passwordExpiryDays}
                onChange={(e) => setPasswordExpiryDays(parseInt(e.target.value) || 90)}
                min="0"
                max="365"
              />
              <p className="text-sm text-muted-foreground">{t('passwordExpiryHint')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Session Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t('sessionManagement')}
            </CardTitle>
            <CardDescription>{t('sessionManagementDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('sessionTimeout')}</Label>
              <Input
                type="number"
                value={sessionTimeoutMinutes}
                onChange={(e) => setSessionTimeoutMinutes(parseInt(e.target.value) || 60)}
                min="5"
                max="1440"
              />
              <p className="text-sm text-muted-foreground">{t('sessionTimeoutHint')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Login Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5" />
              {t('loginSecurity')}
            </CardTitle>
            <CardDescription>{t('loginSecurityDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('maxAttempts')}</Label>
                <Input
                  type="number"
                  value={maxLoginAttempts}
                  onChange={(e) => setMaxLoginAttempts(parseInt(e.target.value) || 5)}
                  min="1"
                  max="10"
                />
                <p className="text-sm text-muted-foreground">{t('maxAttemptsHint')}</p>
              </div>

              <div className="space-y-2">
                <Label>{t('lockoutDuration')}</Label>
                <Input
                  type="number"
                  value={lockoutDurationMinutes}
                  onChange={(e) => setLockoutDurationMinutes(parseInt(e.target.value) || 30)}
                  min="1"
                  max="1440"
                />
                <p className="text-sm text-muted-foreground">{t('lockoutDurationHint')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {t('twoFactor')}
            </CardTitle>
            <CardDescription>{t('twoFactorDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('requireTwoFactor')}</Label>
                <p className="text-sm text-muted-foreground">{t('requireTwoFactorHint')}</p>
              </div>
              <Switch checked={requireTwoFactor} onCheckedChange={setRequireTwoFactor} />
            </div>
          </CardContent>
        </Card>

        {/* IP Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('ipManagement')}
            </CardTitle>
            <CardDescription>{t('ipManagementDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>{t('allowedIps')}</Label>
              <Textarea
                value={allowedIPs}
                onChange={(e) => setAllowedIPs(e.target.value)}
                placeholder="192.168.1.100&#10;10.0.0.0/24"
                rows={4}
              />
              <p className="text-sm text-muted-foreground">{t('allowedIpsHint')}</p>
            </div>

            <div className="space-y-2">
              <Label>{t('blockedIps')}</Label>
              <Textarea
                value={blockedIPs}
                onChange={(e) => setBlockedIPs(e.target.value)}
                placeholder="192.168.1.200&#10;203.0.113.0/24"
                rows={4}
              />
              <p className="text-sm text-muted-foreground">{t('blockedIpsHint')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log Intelligence */}
        <Card>
          <CardContent className="pt-6">
            <AuditMonitor />
          </CardContent>
        </Card>

        {/* Security Warning */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="w-5 h-5" />
              {t('noticeTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-yellow-700 space-y-2">
            <p>• {t('notice1')}</p>
            <p>• {t('notice2')}</p>
            <p>• {t('notice3')}</p>
            <p>• {t('notice4')}</p>
            <p>• {t('notice5')}</p>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving} size="lg">
            {saving ? t('saving') : t('saveSecuritySettings')}
          </Button>
        </div>
      </div>
    </div>
  )
}
