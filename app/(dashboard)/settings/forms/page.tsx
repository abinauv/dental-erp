'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  FileText,
  ClipboardCheck,
  MessageSquareText,
  FilePlus2,
} from 'lucide-react'
import { toast } from 'sonner'

interface FormTemplate {
  id: string
  name: string
  type: string
  description: string | null
  isActive: boolean
  isDefault: boolean
  createdAt: string
  _count: { submissions: number }
}

const typeIcons: Record<string, React.ReactNode> = {
  MEDICAL_HISTORY: <FileText className="h-4 w-4" />,
  CONSENT: <ClipboardCheck className="h-4 w-4" />,
  INTAKE: <FilePlus2 className="h-4 w-4" />,
  FEEDBACK: <MessageSquareText className="h-4 w-4" />,
  CUSTOM: <FileText className="h-4 w-4" />,
}

export default function FormsSettingsPage() {
  const t = useTranslations('settings.formsList')
  const fmt = useClinicFormatters()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [loading, setLoading] = useState(true)

  // Type labels prefer the catalogue, falling back to the raw enum value.
  const typeLabel = (type: string) => (t.has(`type.${type}`) ? t(`type.${type}`) : type)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/settings/forms')
      const data = await res.json()
      if (data.templates) setTemplates(data.templates)
    } catch {
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSeedDefaults = async () => {
    try {
      const res = await fetch('/api/settings/forms/seed', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchTemplates()
      } else {
        toast.error(data.error || t('loadDefaultsFailed'))
      }
    } catch {
      toast.error(t('loadDefaultsFailed'))
    }
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: t('deleteTitle'),
      description: t('deleteDesc', { name }),
      confirmLabel: t('deleteConfirm'),
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/settings/forms/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(t('templateRemoved'))
        fetchTemplates()
      } else {
        const data = await res.json()
        toast.error(data.error || t('deleteFailed'))
      }
    } catch {
      toast.error(t('deleteFailedCatch'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/settings/forms/new">
            <Plus className="h-4 w-4 mr-2" />
            {t('newTemplate')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('allTemplates')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">{t('emptyTitle')}</h3>
              <p className="text-muted-foreground mb-4">{t('emptyBody')}</p>
              <div className="flex items-center gap-3 justify-center">
                <Button asChild>
                  <Link href="/settings/forms/new">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('createTemplate')}
                  </Link>
                </Button>
                <Button variant="outline" onClick={handleSeedDefaults}>
                  {t('loadDefaults')}
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colName')}</TableHead>
                  <TableHead>{t('colType')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead className="text-right">{t('colSubmissions')}</TableHead>
                  <TableHead>{t('colCreated')}</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl) => (
                  <TableRow key={tpl.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {typeIcons[tpl.type]}
                        <div>
                          <div className="font-medium">{tpl.name}</div>
                          {tpl.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {tpl.description}
                            </div>
                          )}
                        </div>
                        {tpl.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            {t('default')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabel(tpl.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tpl.isActive ? 'default' : 'secondary'}>
                        {tpl.isActive ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{tpl._count.submissions}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {fmt.formatDate(tpl.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/settings/forms/${tpl.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              {t('viewEdit')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(tpl.id, tpl.name)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {ConfirmDialogComponent}
    </div>
  )
}
