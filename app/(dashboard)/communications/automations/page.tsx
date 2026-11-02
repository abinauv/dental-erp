'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import {
  Zap,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Calendar,
  Clock,
  Play,
  Pause,
  RefreshCw,
} from 'lucide-react'

// Values only — labels and param labels live in the
// `communications.automations.trigger` / `.triggerParam` / `.action`
// catalogues, resolved at render. `hasParam` drives the days-param input.
const TRIGGER_TYPES = [
  { value: 'NO_VISIT', hasParam: true, defaultParam: 180 },
  { value: 'BIRTHDAY_UPCOMING', hasParam: true, defaultParam: 3 },
  { value: 'TREATMENT_PLAN_PENDING', hasParam: true, defaultParam: 14 },
  { value: 'MEMBERSHIP_EXPIRING', hasParam: true, defaultParam: 7 },
  { value: 'POST_APPOINTMENT', hasParam: false, defaultParam: 0 },
  { value: 'PAYMENT_OVERDUE', hasParam: true, defaultParam: 30 },
]

const ACTION_TYPES = [
  { value: 'SEND_SMS', needsTemplate: true },
  { value: 'SEND_EMAIL', needsTemplate: true },
  { value: 'CREATE_NOTIFICATION', needsTemplate: false },
]

interface Automation {
  id: string
  name: string
  trigger: { type: string; params: Record<string, number | string> }
  action: { type: string; params: Record<string, string> }
  isActive: boolean
  lastRunAt: string | null
  runCount: number
  createdAt: string
}

interface Template {
  id: string
  name: string
  category: string
  channel: string
}

export default function AutomationsPage() {
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const t = useTranslations('communications.automations')
  const tc = useTranslations('communications.common')
  const { formatDate } = useClinicFormatters()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [automations, setAutomations] = useState<Automation[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formTriggerType, setFormTriggerType] = useState('')
  const [formTriggerDays, setFormTriggerDays] = useState('180')
  const [formActionType, setFormActionType] = useState('')
  const [formTemplateId, setFormTemplateId] = useState('')
  const [formNotifTitle, setFormNotifTitle] = useState('')
  const [formNotifMessage, setFormNotifMessage] = useState('')

  const fetchAutomations = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/communications/automations')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setAutomations(json.automations)
    } catch (err: any) {
      toast({ title: tc('error'), description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/communications/templates')
      if (!res.ok) return
      const json = await res.json()
      setTemplates(json.templates || [])
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    fetchAutomations()
    fetchTemplates()
  }, [])

  const resetForm = () => {
    setFormName('')
    setFormTriggerType('')
    setFormTriggerDays('180')
    setFormActionType('')
    setFormTemplateId('')
    setFormNotifTitle('')
    setFormNotifMessage('')
    setEditingId(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setShowDialog(true)
  }

  const openEditDialog = (auto: Automation) => {
    setEditingId(auto.id)
    setFormName(auto.name)
    setFormTriggerType(auto.trigger.type)
    setFormTriggerDays(String(auto.trigger.params.days || '0'))
    setFormActionType(auto.action.type)
    setFormTemplateId(auto.action.params.templateId || '')
    setFormNotifTitle(auto.action.params.title || '')
    setFormNotifMessage(auto.action.params.message || '')
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formName || !formTriggerType || !formActionType) {
      toast({
        title: tc('error'),
        description: t('toast.fillRequired'),
        variant: 'destructive',
      })
      return
    }

    const triggerConfig = TRIGGER_TYPES.find((tt) => tt.value === formTriggerType)
    const actionConfig = ACTION_TYPES.find((a) => a.value === formActionType)

    const triggerParams: Record<string, number | string> = {}
    if (triggerConfig?.hasParam) {
      triggerParams.days = Number(formTriggerDays)
    }

    const actionParams: Record<string, string> = {}
    if (actionConfig?.needsTemplate) {
      if (!formTemplateId) {
        toast({
          title: tc('error'),
          description: t('toast.selectTemplate'),
          variant: 'destructive',
        })
        return
      }
      actionParams.templateId = formTemplateId
    } else if (formActionType === 'CREATE_NOTIFICATION') {
      actionParams.title = formNotifTitle || formName
      actionParams.message = formNotifMessage || t('form.defaultNotifMessage', { name: formName })
    }

    setSaving(true)
    try {
      const payload = {
        id: editingId || undefined,
        name: formName,
        trigger: { type: formTriggerType, params: triggerParams },
        action: { type: formActionType, params: actionParams },
      }

      const res = await fetch('/api/communications/automations', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || t('toast.saveError'))
      }

      toast({
        title: tc('success'),
        description: editingId ? t('toast.updated') : t('toast.created'),
      })
      setShowDialog(false)
      resetForm()
      fetchAutomations()
    } catch (err: any) {
      toast({ title: tc('error'), description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (auto: Automation) => {
    try {
      const res = await fetch('/api/communications/automations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: auto.id, isActive: !auto.isActive }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setAutomations((prev) =>
        prev.map((a) => (a.id === auto.id ? { ...a, isActive: !a.isActive } : a))
      )
    } catch (err: any) {
      toast({ title: tc('error'), description: err.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: t('toast.deleteConfirmTitle'),
      description: t('toast.deleteConfirmDescription'),
      confirmLabel: t('toast.deleteConfirmLabel'),
    })
    if (!ok) return

    try {
      const res = await fetch('/api/communications/automations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      setAutomations((prev) => prev.filter((a) => a.id !== id))
      toast({ title: tc('success'), description: t('toast.deleted') })
    } catch (err: any) {
      toast({ title: tc('error'), description: err.message, variant: 'destructive' })
    }
  }

  const getTriggerLabel = (trigger: Automation['trigger']) => {
    const config = TRIGGER_TYPES.find((tt) => tt.value === trigger.type)
    if (!config) return trigger.type
    return t(`trigger.${trigger.type}`, { days: trigger.params.days ?? 'X' })
  }

  const getActionLabel = (action: Automation['action']) => {
    const config = ACTION_TYPES.find((a) => a.value === action.type)
    return config ? t(`action.${action.type}`) : action.type
  }

  // Filter templates based on selected action type
  const filteredTemplates = templates.filter((tpl) => {
    if (formActionType === 'SEND_SMS') return tpl.channel === 'SMS'
    if (formActionType === 'SEND_EMAIL') return tpl.channel === 'EMAIL'
    return true
  })

  const selectedTrigger = TRIGGER_TYPES.find((tt) => tt.value === formTriggerType)
  const selectedAction = ACTION_TYPES.find((a) => a.value === formActionType)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchAutomations}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t('newAutomation')}
          </Button>
        </div>
      </div>

      {/* Automations List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : automations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">{t('emptyTitle')}</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">{t('emptyDescription')}</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t('createAutomation')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {t('activeRules', {
                active: automations.filter((a) => a.isActive).length,
                total: automations.length,
              })}
            </CardTitle>
            <CardDescription>{t('activeRulesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('col.name')}</TableHead>
                  <TableHead>{t('col.trigger')}</TableHead>
                  <TableHead>{t('col.action')}</TableHead>
                  <TableHead className="text-center">{t('col.active')}</TableHead>
                  <TableHead className="text-right">{t('col.runs')}</TableHead>
                  <TableHead>{t('col.lastRun')}</TableHead>
                  <TableHead className="text-right">{t('col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {automations.map((auto) => (
                  <TableRow key={auto.id}>
                    <TableCell className="font-medium">{auto.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getTriggerLabel(auto.trigger)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getActionLabel(auto.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={auto.isActive} onCheckedChange={() => handleToggle(auto)} />
                    </TableCell>
                    <TableCell className="text-right">{auto.runCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {auto.lastRunAt ? formatDate(auto.lastRunAt) : t('never')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(auto)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(auto.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
            <DialogDescription>{t('dialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>{t('dialog.nameLabel')}</Label>
              <Input
                placeholder={t('dialog.namePlaceholder')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Trigger */}
            <div className="space-y-2">
              <Label>{t('dialog.triggerLabel')}</Label>
              <Select
                value={formTriggerType}
                onValueChange={(v) => {
                  setFormTriggerType(v)
                  const config = TRIGGER_TYPES.find((tt) => tt.value === v)
                  if (config) setFormTriggerDays(String(config.defaultParam))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('dialog.triggerPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((tt) => (
                    <SelectItem key={tt.value} value={tt.value}>
                      {t(`trigger.${tt.value}`, { days: 'X' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trigger days param */}
            {selectedTrigger?.hasParam && (
              <div className="space-y-2">
                <Label>{t(`triggerParam.${selectedTrigger.value}`)}</Label>
                <Input
                  type="number"
                  min="1"
                  value={formTriggerDays}
                  onChange={(e) => setFormTriggerDays(e.target.value)}
                />
              </div>
            )}

            {/* Action */}
            <div className="space-y-2">
              <Label>{t('dialog.actionLabel')}</Label>
              <Select
                value={formActionType}
                onValueChange={(v) => {
                  setFormActionType(v)
                  setFormTemplateId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('dialog.actionPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {t(`action.${a.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template selection */}
            {selectedAction?.needsTemplate && (
              <div className="space-y-2">
                <Label>{t('dialog.templateLabel')}</Label>
                <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('dialog.templatePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTemplates.length === 0 ? (
                      <SelectItem value="none" disabled>
                        {t('dialog.noTemplates')}
                      </SelectItem>
                    ) : (
                      filteredTemplates.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {t('dialog.templateOption', { name: tpl.name, category: tpl.category })}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notification params */}
            {formActionType === 'CREATE_NOTIFICATION' && (
              <>
                <div className="space-y-2">
                  <Label>{t('dialog.notifTitleLabel')}</Label>
                  <Input
                    placeholder={t('dialog.notifTitlePlaceholder')}
                    value={formNotifTitle}
                    onChange={(e) => setFormNotifTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('dialog.notifMessageLabel')}</Label>
                  <Input
                    placeholder={t('dialog.notifMessagePlaceholder')}
                    value={formNotifMessage}
                    onChange={(e) => setFormNotifMessage(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {t('dialog.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? t('dialog.update') : t('dialog.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialogComponent}
    </div>
  )
}
