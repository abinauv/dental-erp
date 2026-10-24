'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { MessageSquare, Mail, FileText, MessageCircle, Send } from 'lucide-react'

export default function CommunicationsPage() {
  const { toast } = useToast()
  const t = useTranslations('communications.center')
  const tc = useTranslations('communications.common')
  const [loading, setLoading] = useState(false)

  // SMS State
  const [smsPhone, setSmsPhone] = useState('')
  const [smsMessage, setSmsMessage] = useState('')

  // Email State
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  const handleSendSMS = async () => {
    if (!smsPhone || !smsMessage) {
      toast({
        title: tc('error'),
        description: t('toast.fillAll'),
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/communications/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: smsPhone,
          message: smsMessage,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: tc('success'),
          description: t('toast.smsSuccess'),
        })
        setSmsPhone('')
        setSmsMessage('')
      } else {
        throw new Error(data.error || t('toast.smsError'))
      }
    } catch (error: any) {
      toast({
        title: tc('error'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!emailTo || !emailSubject || !emailBody) {
      toast({
        title: tc('error'),
        description: t('toast.fillAll'),
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/communications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: tc('success'),
          description: t('toast.emailSuccess'),
        })
        setEmailTo('')
        setEmailSubject('')
        setEmailBody('')
      } else {
        throw new Error(data.error || t('toast.emailError'))
      }
    } catch (error: any) {
      toast({
        title: tc('error'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="sms" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sms">
            <MessageSquare className="w-4 h-4 mr-2" />
            {t('tabs.sms')}
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="w-4 h-4 mr-2" />
            {t('tabs.email')}
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="w-4 h-4 mr-2" />
            {t('tabs.templates')}
          </TabsTrigger>
          <TabsTrigger value="surveys">
            <MessageCircle className="w-4 h-4 mr-2" />
            {t('tabs.surveys')}
          </TabsTrigger>
        </TabsList>

        {/* SMS Tab */}
        <TabsContent value="sms">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('sms.sendTitle')}</CardTitle>
                <CardDescription>{t('sms.sendDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="sms-phone">{t('sms.phoneLabel')}</Label>
                  <Input
                    id="sms-phone"
                    placeholder={t('sms.phonePlaceholder')}
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="sms-message">{t('sms.messageLabel')}</Label>
                  <Textarea
                    id="sms-message"
                    placeholder={t('sms.messagePlaceholder')}
                    rows={5}
                    maxLength={500}
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('sms.charCount', { count: smsMessage.length })}
                  </p>
                </div>

                <Button onClick={handleSendSMS} disabled={loading} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  {t('sms.send')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('sms.historyTitle')}</CardTitle>
                <CardDescription>{t('sms.historyDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t('sms.historyPlaceholder')}</p>
                {/* SMS history table/list will go here */}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('email.sendTitle')}</CardTitle>
                <CardDescription>{t('email.sendDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="email-to">{t('email.toLabel')}</Label>
                  <Input
                    id="email-to"
                    type="email"
                    placeholder={t('email.toPlaceholder')}
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="email-subject">{t('email.subjectLabel')}</Label>
                  <Input
                    id="email-subject"
                    placeholder={t('email.subjectPlaceholder')}
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="email-body">{t('email.messageLabel')}</Label>
                  <Textarea
                    id="email-body"
                    placeholder={t('email.messagePlaceholder')}
                    rows={8}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                </div>

                <Button onClick={handleSendEmail} disabled={loading} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  {t('email.send')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('email.historyTitle')}</CardTitle>
                <CardDescription>{t('email.historyDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t('email.historyPlaceholder')}</p>
                {/* Email history table/list will go here */}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>{t('templates.title')}</CardTitle>
              <CardDescription>{t('templates.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{t('templates.availableTitle')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('templates.availableDescription')}
                    </p>
                  </div>
                  <Button>{t('templates.create')}</Button>
                </div>

                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">{t('templates.listPlaceholder')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Surveys Tab */}
        <TabsContent value="surveys">
          <Card>
            <CardHeader>
              <CardTitle>{t('surveys.title')}</CardTitle>
              <CardDescription>{t('surveys.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{t('surveys.activeTitle')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('surveys.activeDescription')}
                    </p>
                  </div>
                  <Button>{t('surveys.create')}</Button>
                </div>

                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">{t('surveys.listPlaceholder')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
