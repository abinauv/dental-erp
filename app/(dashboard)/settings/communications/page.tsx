'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

export default function CommunicationSettingsPage() {
  const t = useTranslations('settings.communications')
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)

  // SMS Settings
  const [smsGateway, setSmsGateway] = useState('MSG91')
  const [smsApiKey, setSmsApiKey] = useState('')
  const [smsSenderId, setSmsSenderId] = useState('')
  const [smsRoute, setSmsRoute] = useState('4')
  const [smsEnabled, setSmsEnabled] = useState(true)

  // Email Settings
  const [emailHost, setEmailHost] = useState('')
  const [emailPort, setEmailPort] = useState('587')
  const [emailSecure, setEmailSecure] = useState(false)
  const [emailUser, setEmailUser] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailFromName, setEmailFromName] = useState('Your Dental Clinic')
  const [emailFromEmail, setEmailFromEmail] = useState('')
  const [emailReplyTo, setEmailReplyTo] = useState('')
  const [emailEnabled, setEmailEnabled] = useState(true)

  // Google Review Settings
  const [googleReviewUrl, setGoogleReviewUrl] = useState('')
  const [autoReviewRequests, setAutoReviewRequests] = useState(false)
  const [reviewRequestDelay, setReviewRequestDelay] = useState('2')

  // Test fields
  const [testPhone, setTestPhone] = useState('')
  const [testEmail, setTestEmail] = useState('')

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoadingSettings(true)
      const response = await fetch('/api/settings/communications')

      if (!response.ok) {
        throw new Error(t('loadFailed'))
      }

      const data = await response.json()

      // Load SMS settings
      if (data.sms) {
        setSmsGateway(data.sms.gateway || 'MSG91')
        setSmsApiKey(data.sms.apiKey || '')
        setSmsSenderId(data.sms.senderId || '')
        setSmsRoute(data.sms.route || '4')
        setSmsEnabled(data.sms.enabled !== 'false' && data.sms.enabled !== false)
      }

      // Load Google Review settings
      if (data.reviews) {
        setGoogleReviewUrl(data.reviews.google_review_url || '')
        setAutoReviewRequests(
          data.reviews.auto_review_requests === 'true' || data.reviews.auto_review_requests === true
        )
        setReviewRequestDelay(data.reviews.review_request_delay_hours || '2')
      }

      // Load Email settings
      if (data.email) {
        setEmailHost(data.email.smtp_host || '')
        setEmailPort(data.email.smtp_port || '587')
        setEmailSecure(data.email.smtp_secure === 'true' || data.email.smtp_secure === true)
        setEmailUser(data.email.smtp_user || '')
        setEmailPassword(data.email.smtp_password || '')
        setEmailFromName(data.email.from_name || 'Your Dental Clinic')
        setEmailFromEmail(data.email.from_email || '')
        setEmailReplyTo(data.email.replyTo || '')
        setEmailEnabled(data.email.enabled !== 'false' && data.email.enabled !== false)
      }
    } catch (error: any) {
      console.error('Error loading settings:', error)
      toast({
        title: t('error'),
        description: t('loadFailed'),
        variant: 'destructive',
      })
    } finally {
      setLoadingSettings(false)
    }
  }

  const handleSaveSMSSettings = async () => {
    setLoading(true)
    try {
      const settings = {
        gateway: smsGateway,
        apiKey: smsApiKey,
        senderId: smsSenderId,
        route: smsRoute,
        enabled: smsEnabled,
      }

      const response = await fetch('/api/settings/communications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'sms',
          settings,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('saveFailed'))
      }

      toast({
        title: t('success'),
        description: t('smsSaved'),
      })
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEmailSettings = async () => {
    setLoading(true)
    try {
      const settings = {
        smtp_host: emailHost,
        smtp_port: emailPort,
        smtp_secure: emailSecure,
        smtp_user: emailUser,
        smtp_password: emailPassword,
        from_name: emailFromName,
        from_email: emailFromEmail,
        replyTo: emailReplyTo,
        enabled: emailEnabled,
      }

      const response = await fetch('/api/settings/communications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'email',
          settings,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('saveFailed'))
      }

      toast({
        title: t('success'),
        description: t('emailSaved'),
      })
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestSMS = async () => {
    if (!testPhone) {
      toast({
        title: t('error'),
        description: t('enterPhone'),
        variant: 'destructive',
      })
      return
    }

    setTesting(true)
    try {
      const response = await fetch('/api/settings/communications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'sms',
          testData: {
            phone: testPhone,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.details || data.error || t('smsTestFailed'))
      }

      toast({
        title: t('success'),
        description: data.message || t('smsTestSuccess'),
      })
    } catch (error: any) {
      toast({
        title: t('testFailed'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: t('error'),
        description: t('enterEmail'),
        variant: 'destructive',
      })
      return
    }

    setTesting(true)
    try {
      const response = await fetch('/api/settings/communications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'email',
          testData: {
            email: testEmail,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.details || data.error || t('emailTestFailed'))
      }

      toast({
        title: t('success'),
        description: data.message || t('emailTestSuccess'),
      })
    } catch (error: any) {
      toast({
        title: t('testFailed'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveReviewSettings = async () => {
    setLoading(true)
    try {
      const settings = {
        google_review_url: googleReviewUrl,
        auto_review_requests: autoReviewRequests,
        review_request_delay_hours: reviewRequestDelay,
      }

      const response = await fetch('/api/settings/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reviews', settings }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t('saveFailed'))

      toast({ title: t('success'), description: t('reviewsSaved') })
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (loadingSettings) {
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
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="sms" className="w-full">
        <TabsList>
          <TabsTrigger value="sms">{t('tabSms')}</TabsTrigger>
          <TabsTrigger value="email">{t('tabEmail')}</TabsTrigger>
          <TabsTrigger value="reviews">{t('tabReviews')}</TabsTrigger>
        </TabsList>

        {/* SMS Configuration */}
        <TabsContent value="sms">
          <Card>
            <CardHeader>
              <CardTitle>{t('smsCardTitle')}</CardTitle>
              <CardDescription>{t('smsCardDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('enableSms')}</Label>
                  <p className="text-sm text-muted-foreground">{t('enableSmsHint')}</p>
                </div>
                <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sms-gateway">{t('smsGateway')}</Label>
                  <Select value={smsGateway} onValueChange={setSmsGateway}>
                    <SelectTrigger id="sms-gateway">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MSG91">MSG91</SelectItem>
                      <SelectItem value="TEXTLOCAL">TextLocal</SelectItem>
                      <SelectItem value="FAST2SMS">Fast2SMS</SelectItem>
                      <SelectItem value="TWILIO">Twilio India</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sms-sender-id">{t('senderId')}</Label>
                  <Input
                    id="sms-sender-id"
                    placeholder="DENTAL"
                    value={smsSenderId}
                    onChange={(e) => setSmsSenderId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('senderIdHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sms-api-key">{t('apiKey')}</Label>
                  <Input
                    id="sms-api-key"
                    type="password"
                    placeholder={t('apiKeyPlaceholder')}
                    value={smsApiKey}
                    onChange={(e) => setSmsApiKey(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sms-route">{t('route')}</Label>
                  <Input
                    id="sms-route"
                    placeholder="4"
                    value={smsRoute}
                    onChange={(e) => setSmsRoute(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('routeHint')}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">{t('testSmsHeading')}</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="test-phone">{t('testPhone')}</Label>
                    <Input
                      id="test-phone"
                      placeholder="9876543210"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">{t('testPhoneHint')}</p>
                  </div>
                  <Button onClick={handleTestSMS} disabled={testing} variant="outline">
                    {testing ? t('sending') : t('sendTestSms')}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">{t('traiTitle')}</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• {t('trai1')}</li>
                  <li>• {t('trai2')}</li>
                  <li>• {t('trai3')}</li>
                </ul>
              </div>

              <Button onClick={handleSaveSMSSettings} disabled={loading}>
                {loading ? t('saving') : t('saveSms')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Configuration */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>{t('emailCardTitle')}</CardTitle>
              <CardDescription>{t('emailCardDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('enableEmail')}</Label>
                  <p className="text-sm text-muted-foreground">{t('enableEmailHint')}</p>
                </div>
                <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">{t('smtpHeading')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-host">{t('smtpHost')}</Label>
                    <Input
                      id="email-host"
                      placeholder="smtp.hostinger.com"
                      value={emailHost}
                      onChange={(e) => setEmailHost(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-port">{t('smtpPort')}</Label>
                    <Input
                      id="email-port"
                      placeholder="587"
                      value={emailPort}
                      onChange={(e) => setEmailPort(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-user">{t('smtpUser')}</Label>
                    <Input
                      id="email-user"
                      placeholder="info@yourclinic.com"
                      value={emailUser}
                      onChange={(e) => setEmailUser(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-password">{t('smtpPassword')}</Label>
                    <Input
                      id="email-password"
                      type="password"
                      placeholder={t('smtpPasswordPlaceholder')}
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 mt-4">
                  <Switch checked={emailSecure} onCheckedChange={setEmailSecure} />
                  <Label>{t('useSsl')}</Label>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">{t('senderHeading')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-from-name">{t('fromName')}</Label>
                    <Input
                      id="email-from-name"
                      placeholder={t('fromNamePlaceholder')}
                      value={emailFromName}
                      onChange={(e) => setEmailFromName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-from-email">{t('fromEmail')}</Label>
                    <Input
                      id="email-from-email"
                      type="email"
                      placeholder="info@yourclinic.com"
                      value={emailFromEmail}
                      onChange={(e) => setEmailFromEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-reply-to">{t('replyTo')}</Label>
                    <Input
                      id="email-reply-to"
                      type="email"
                      placeholder="contact@yourclinic.com"
                      value={emailReplyTo}
                      onChange={(e) => setEmailReplyTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">{t('testEmailHeading')}</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="test-email">{t('testEmailLabel')}</Label>
                    <Input
                      id="test-email"
                      type="email"
                      placeholder="test@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">{t('testEmailHint')}</p>
                  </div>
                  <Button onClick={handleTestEmail} disabled={testing} variant="outline">
                    {testing ? t('sending') : t('sendTestEmail')}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">{t('hostingerTitle')}</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• {t('hostinger1')}</li>
                  <li>• {t('hostinger2')}</li>
                  <li>• {t('hostinger3')}</li>
                </ul>
              </div>

              <Button onClick={handleSaveEmailSettings} disabled={loading}>
                {loading ? t('saving') : t('saveEmail')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Google Reviews Configuration */}
        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>{t('reviewsCardTitle')}</CardTitle>
              <CardDescription>{t('reviewsCardDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="google-review-url">{t('reviewUrl')}</Label>
                <Input
                  id="google-review-url"
                  placeholder="https://g.page/r/YOUR_PLACE_ID/review"
                  value={googleReviewUrl}
                  onChange={(e) => setGoogleReviewUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t('reviewUrlHint')}</p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('autoRequest')}</Label>
                  <p className="text-sm text-muted-foreground">{t('autoRequestHint')}</p>
                </div>
                <Switch checked={autoReviewRequests} onCheckedChange={setAutoReviewRequests} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-delay">{t('reviewDelay')}</Label>
                <Input
                  id="review-delay"
                  type="number"
                  min="1"
                  max="48"
                  placeholder="2"
                  value={reviewRequestDelay}
                  onChange={(e) => setReviewRequestDelay(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t('reviewDelayHint')}</p>
              </div>

              <Separator />

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">{t('gatingTitle')}</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• {t('gating1')}</li>
                  <li>• {t('gating2')}</li>
                  <li>• {t('gating3')}</li>
                  <li>• {t('gating4')}</li>
                </ul>
              </div>

              <Button onClick={handleSaveReviewSettings} disabled={loading}>
                {loading ? t('saving') : t('saveReviews')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
