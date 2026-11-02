'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  ClipboardCheck,
  FilePlus2,
  MessageSquareText,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface FormSubmission {
  id: string
  status: string
  createdAt: string
  template: {
    id: string
    name: string
    type: string
    description: string | null
  }
}

interface AvailableTemplate {
  id: string
  name: string
  type: string
  description: string | null
}

const typeIcons: Record<string, React.ReactNode> = {
  MEDICAL_HISTORY: <FileText className="h-5 w-5" />,
  CONSENT: <ClipboardCheck className="h-5 w-5" />,
  INTAKE: <FilePlus2 className="h-5 w-5" />,
  FEEDBACK: <MessageSquareText className="h-5 w-5" />,
  CUSTOM: <FileText className="h-5 w-5" />,
}

// Status icon + badge variant; the label comes from the catalogue
// (portal.forms.status.*), keyed by the status value.
const statusConfig: Record<
  string,
  {
    icon: React.ReactNode
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
> = {
  SUBMITTED: { icon: <Clock className="h-3 w-3" />, variant: 'secondary' },
  REVIEWED: { icon: <CheckCircle2 className="h-3 w-3" />, variant: 'outline' },
  APPROVED: { icon: <CheckCircle2 className="h-3 w-3" />, variant: 'default' },
  REJECTED: { icon: <XCircle className="h-3 w-3" />, variant: 'destructive' },
}

export default function PatientFormsPage() {
  const t = useTranslations('portal.forms')
  const { formatDate } = useClinicFormatters()
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [templates, setTemplates] = useState<AvailableTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchForms()
  }, [])

  const fetchForms = async () => {
    try {
      const res = await fetch('/api/patient-portal/forms')
      const data = await res.json()
      if (data.submissions) setSubmissions(data.submissions)
      if (data.availableTemplates) setTemplates(data.availableTemplates)
    } catch {
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Filter out templates that have already been submitted
  const submittedTemplateIds = new Set(submissions.map((s) => s.template.id))
  const pendingTemplates = templates.filter((tpl) => !submittedTemplateIds.has(tpl.id))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Pending Forms (not yet submitted) */}
      {pendingTemplates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('toComplete')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingTemplates.map((tpl) => (
              <Link
                key={tpl.id}
                href={`/portal/forms/${tpl.id}`}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="text-primary">
                  {typeIcons[tpl.type] || <FileText className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{tpl.name}</div>
                  {tpl.description && (
                    <div className="text-sm text-muted-foreground line-clamp-1">
                      {tpl.description}
                    </div>
                  )}
                </div>
                <Button size="sm">{t('fillOut')}</Button>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Submitted Forms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('submittedForms')}</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>{t('noSubmitted')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((s) => {
                const sc = statusConfig[s.status] || statusConfig.SUBMITTED
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="text-muted-foreground">
                      {typeIcons[s.template.type] || <FileText className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{s.template.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t('submittedOn', { date: formatDate(s.createdAt) })}
                      </div>
                    </div>
                    <Badge variant={sc.variant} className="flex items-center gap-1">
                      {sc.icon}
                      {t(`status.${s.status}`)}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {pendingTemplates.length === 0 && submissions.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">{t('allComplete')}</p>
      )}
    </div>
  )
}
