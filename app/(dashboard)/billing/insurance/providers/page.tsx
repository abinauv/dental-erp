"use client"

import { useState, useEffect } from "react"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Building2,
  Phone,
  Mail,
  Globe,
  Users,
} from "lucide-react"

interface Provider {
  id: string
  name: string
  code: string | null
  contactPhone: string | null
  contactEmail: string | null
  website: string | null
  claimSubmissionUrl: string | null
  portalUsername: string | null
  isActive: boolean
  _count: { policies: number }
}

const emptyForm = {
  name: "",
  code: "",
  contactPhone: "",
  contactEmail: "",
  website: "",
  claimSubmissionUrl: "",
  portalUsername: "",
  portalPassword: "",
}

export default function InsuranceProvidersPage() {
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchProviders = async () => {
    try {
      const res = await fetch(`/api/insurance-providers?search=${encodeURIComponent(search)}`)
      if (res.ok) setProviders(await res.json())
    } catch {
      toast({ title: "Failed to load providers", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviders()
  }, [search])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (p: Provider) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      code: p.code || "",
      contactPhone: p.contactPhone || "",
      contactEmail: p.contactEmail || "",
      website: p.website || "",
      claimSubmissionUrl: p.claimSubmissionUrl || "",
      portalUsername: p.portalUsername || "",
      portalPassword: "",
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Provider name is required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/insurance-providers/${editingId}` : "/api/insurance-providers"
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }
      toast({ title: editingId ? "Provider updated" : "Provider created" })
      setDialogOpen(false)
      fetchProviders()
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "Delete Provider", description: "Are you sure you want to delete this provider?", confirmLabel: "Delete" })
    if (!ok) return
    try {
      const res = await fetch(`/api/insurance-providers/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Provider removed" })
        fetchProviders()
      }
    } catch {
      toast({ title: "Failed to delete provider", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Insurance Providers</h1>
          <p className="text-muted-foreground">Manage insurance companies your hospital works with</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search providers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No insurance providers found</p>
              <p className="text-sm">Add your first insurance provider to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Policies</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.website && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {p.website}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.code || "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-sm">
                        {p.contactPhone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" /> {p.contactPhone}
                          </div>
                        )}
                        {p.contactEmail && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" /> {p.contactEmail}
                          </div>
                        )}
                        {!p.contactPhone && !p.contactEmail && <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {p._count.policies}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "default" : "secondary"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(p.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Provider" : "Add Insurance Provider"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Provider Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Star Health Insurance"
                />
              </div>
              <div>
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g., STARHI"
                />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="col-span-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="claims@provider.com"
                />
              </div>
              <div className="col-span-2">
                <Label>Website</Label>
                <Input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://provider.com"
                />
              </div>
              <div className="col-span-2">
                <Label>Claim Submission URL</Label>
                <Input
                  value={form.claimSubmissionUrl}
                  onChange={(e) => setForm({ ...form, claimSubmissionUrl: e.target.value })}
                  placeholder="https://provider.com/claims/submit"
                />
              </div>
              <div>
                <Label>Portal Username</Label>
                <Input
                  value={form.portalUsername}
                  onChange={(e) => setForm({ ...form, portalUsername: e.target.value })}
                  placeholder="Username"
                />
              </div>
              <div>
                <Label>Portal Password</Label>
                <Input
                  type="password"
                  value={form.portalPassword}
                  onChange={(e) => setForm({ ...form, portalPassword: e.target.value })}
                  placeholder={editingId ? "Leave blank to keep" : "Password"}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {ConfirmDialogComponent}
    </div>
  )
}
