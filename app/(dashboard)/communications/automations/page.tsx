"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
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
} from "lucide-react"

const TRIGGER_TYPES = [
  { value: "NO_VISIT", label: "No visit in X days", paramLabel: "Days since last visit", defaultParam: 180 },
  { value: "BIRTHDAY_UPCOMING", label: "Birthday in X days", paramLabel: "Days before birthday", defaultParam: 3 },
  { value: "TREATMENT_PLAN_PENDING", label: "Treatment plan pending X days", paramLabel: "Days pending", defaultParam: 14 },
  { value: "MEMBERSHIP_EXPIRING", label: "Membership expiring in X days", paramLabel: "Days before expiry", defaultParam: 7 },
  { value: "POST_APPOINTMENT", label: "After appointment completion", paramLabel: null, defaultParam: 0 },
  { value: "PAYMENT_OVERDUE", label: "Payment overdue by X days", paramLabel: "Days overdue", defaultParam: 30 },
]

const ACTION_TYPES = [
  { value: "SEND_SMS", label: "Send SMS", needsTemplate: true },
  { value: "SEND_EMAIL", label: "Send Email", needsTemplate: true },
  { value: "CREATE_NOTIFICATION", label: "Create Notification", needsTemplate: false },
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [automations, setAutomations] = useState<Automation[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState("")
  const [formTriggerType, setFormTriggerType] = useState("")
  const [formTriggerDays, setFormTriggerDays] = useState("180")
  const [formActionType, setFormActionType] = useState("")
  const [formTemplateId, setFormTemplateId] = useState("")
  const [formNotifTitle, setFormNotifTitle] = useState("")
  const [formNotifMessage, setFormNotifMessage] = useState("")

  const fetchAutomations = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/communications/automations")
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      setAutomations(json.automations)
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/communications/templates")
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
    setFormName("")
    setFormTriggerType("")
    setFormTriggerDays("180")
    setFormActionType("")
    setFormTemplateId("")
    setFormNotifTitle("")
    setFormNotifMessage("")
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
    setFormTriggerDays(String(auto.trigger.params.days || "0"))
    setFormActionType(auto.action.type)
    setFormTemplateId(auto.action.params.templateId || "")
    setFormNotifTitle(auto.action.params.title || "")
    setFormNotifMessage(auto.action.params.message || "")
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formName || !formTriggerType || !formActionType) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" })
      return
    }

    const triggerConfig = TRIGGER_TYPES.find((t) => t.value === formTriggerType)
    const actionConfig = ACTION_TYPES.find((a) => a.value === formActionType)

    const triggerParams: Record<string, number | string> = {}
    if (triggerConfig?.paramLabel) {
      triggerParams.days = Number(formTriggerDays)
    }

    const actionParams: Record<string, string> = {}
    if (actionConfig?.needsTemplate) {
      if (!formTemplateId) {
        toast({ title: "Error", description: "Please select a template", variant: "destructive" })
        return
      }
      actionParams.templateId = formTemplateId
    } else if (formActionType === "CREATE_NOTIFICATION") {
      actionParams.title = formNotifTitle || formName
      actionParams.message = formNotifMessage || `Automation "${formName}" triggered`
    }

    setSaving(true)
    try {
      const payload = {
        id: editingId || undefined,
        name: formName,
        trigger: { type: formTriggerType, params: triggerParams },
        action: { type: formActionType, params: actionParams },
      }

      const res = await fetch("/api/communications/automations", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to save")
      }

      toast({ title: "Success", description: editingId ? "Automation updated" : "Automation created" })
      setShowDialog(false)
      resetForm()
      fetchAutomations()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (auto: Automation) => {
    try {
      const res = await fetch("/api/communications/automations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auto.id, isActive: !auto.isActive }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setAutomations((prev) =>
        prev.map((a) => (a.id === auto.id ? { ...a, isActive: !a.isActive } : a))
      )
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this automation?")) return

    try {
      const res = await fetch("/api/communications/automations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Failed to delete")
      setAutomations((prev) => prev.filter((a) => a.id !== id))
      toast({ title: "Success", description: "Automation deleted" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const getTriggerLabel = (trigger: Automation["trigger"]) => {
    const config = TRIGGER_TYPES.find((t) => t.value === trigger.type)
    if (!config) return trigger.type
    if (trigger.params.days) {
      return config.label.replace("X", String(trigger.params.days))
    }
    return config.label
  }

  const getActionLabel = (action: Automation["action"]) => {
    const config = ACTION_TYPES.find((a) => a.value === action.type)
    return config?.label || action.type
  }

  // Filter templates based on selected action type
  const filteredTemplates = templates.filter((t) => {
    if (formActionType === "SEND_SMS") return t.channel === "SMS"
    if (formActionType === "SEND_EMAIL") return t.channel === "EMAIL"
    return true
  })

  const selectedTrigger = TRIGGER_TYPES.find((t) => t.value === formTriggerType)
  const selectedAction = ACTION_TYPES.find((a) => a.value === formActionType)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Marketing Automations</h2>
          <p className="text-muted-foreground">
            Create rules to automatically send messages based on patient events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchAutomations}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Automation
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
            <h3 className="text-lg font-semibold">No automations yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              Create your first automation rule to start engaging patients automatically
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Automation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Rules ({automations.filter((a) => a.isActive).length}/{automations.length})</CardTitle>
            <CardDescription>Automation rules are evaluated daily by the cron scheduler</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      <Switch
                        checked={auto.isActive}
                        onCheckedChange={() => handleToggle(auto)}
                      />
                    </TableCell>
                    <TableCell className="text-right">{auto.runCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {auto.lastRunAt
                        ? new Date(auto.lastRunAt).toLocaleDateString()
                        : "Never"}
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
            <DialogTitle>{editingId ? "Edit Automation" : "New Automation"}</DialogTitle>
            <DialogDescription>
              Define the trigger condition and action for this automation rule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Automation Name</Label>
              <Input
                placeholder="e.g., Re-engage inactive patients"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Trigger */}
            <div className="space-y-2">
              <Label>Trigger (IF)</Label>
              <Select value={formTriggerType} onValueChange={(v) => {
                setFormTriggerType(v)
                const config = TRIGGER_TYPES.find((t) => t.value === v)
                if (config) setFormTriggerDays(String(config.defaultParam))
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger..." />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trigger days param */}
            {selectedTrigger?.paramLabel && (
              <div className="space-y-2">
                <Label>{selectedTrigger.paramLabel}</Label>
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
              <Label>Action (THEN)</Label>
              <Select value={formActionType} onValueChange={(v) => {
                setFormActionType(v)
                setFormTemplateId("")
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template selection */}
            {selectedAction?.needsTemplate && (
              <div className="space-y-2">
                <Label>Message Template</Label>
                <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTemplates.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No templates found — create one first
                      </SelectItem>
                    ) : (
                      filteredTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.category})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notification params */}
            {formActionType === "CREATE_NOTIFICATION" && (
              <>
                <div className="space-y-2">
                  <Label>Notification Title</Label>
                  <Input
                    placeholder="e.g., Patient Follow-up Required"
                    value={formNotifTitle}
                    onChange={(e) => setFormNotifTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notification Message</Label>
                  <Input
                    placeholder="e.g., Patient has not visited in 6 months"
                    value={formNotifMessage}
                    onChange={(e) => setFormNotifMessage(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
