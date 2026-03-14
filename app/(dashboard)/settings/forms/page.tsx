"use client"

import { useState, useEffect } from "react"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, FileText, ClipboardCheck, MessageSquareText, FilePlus2 } from "lucide-react"
import { toast } from "sonner"

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

const typeLabels: Record<string, string> = {
  MEDICAL_HISTORY: "Medical History",
  CONSENT: "Consent",
  INTAKE: "Intake",
  FEEDBACK: "Feedback",
  CUSTOM: "Custom",
}

export default function FormsSettingsPage() {
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/settings/forms")
      const data = await res.json()
      if (data.templates) setTemplates(data.templates)
    } catch {
      toast.error("Failed to load form templates")
    } finally {
      setLoading(false)
    }
  }

  const handleSeedDefaults = async () => {
    try {
      const res = await fetch("/api/settings/forms/seed", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchTemplates()
      } else {
        toast.error(data.error || "Failed to load defaults")
      }
    } catch {
      toast.error("Failed to load defaults")
    }
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({ title: "Delete Template", description: `Delete "${name}"? Templates with submissions will be deactivated instead.`, confirmLabel: "Delete" })
    if (!ok) return

    try {
      const res = await fetch(`/api/settings/forms/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Template removed")
        fetchTemplates()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete")
      }
    } catch {
      toast.error("Failed to delete template")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Form Templates</h1>
          <p className="text-muted-foreground">
            Create and manage intake forms, consent forms, and custom forms
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/forms/new">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">No form templates yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first form template to start collecting patient information
              </p>
              <div className="flex items-center gap-3 justify-center">
                <Button asChild>
                  <Link href="/settings/forms/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Link>
                </Button>
                <Button variant="outline" onClick={handleSeedDefaults}>
                  Load Default Templates
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Submissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {typeIcons[t.type]}
                        <div>
                          <div className="font-medium">{t.name}</div>
                          {t.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {t.description}
                            </div>
                          )}
                        </div>
                        {t.isDefault && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabels[t.type] || t.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? "default" : "secondary"}>
                        {t.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{t._count.submissions}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(t.createdAt).toLocaleDateString("en-IN")}
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
                            <Link href={`/settings/forms/${t.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View / Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(t.id, t.name)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
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
