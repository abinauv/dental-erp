"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Edit,
  Trash2,
  Stethoscope,
  AlertCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  procedureCategoryConfig,
  formatCurrency,
} from "@/lib/treatment-utils"

interface Procedure {
  id: string
  code: string
  name: string
  category: string
  description: string | null
  defaultDuration: number
  basePrice: string | number
  materials: string | null
  preInstructions: string | null
  postInstructions: string | null
  isActive: boolean
  _count?: {
    treatments: number
    treatmentPlanItems: number
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const categories = [
  "PREVENTIVE",
  "RESTORATIVE",
  "ENDODONTIC",
  "PERIODONTIC",
  "PROSTHODONTIC",
  "ORTHODONTIC",
  "ORAL_SURGERY",
  "COSMETIC",
  "DIAGNOSTIC",
  "EMERGENCY",
]

export default function ProceduresSettingsPage() {
  const { toast } = useToast()
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [activeFilter, setActiveFilter] = useState("all")

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "",
    description: "",
    defaultDuration: "30",
    basePrice: "",
    materials: "",
    preInstructions: "",
    postInstructions: "",
    isActive: true,
  })

  const fetchProcedures = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (search) params.append("search", search)
      if (categoryFilter && categoryFilter !== "all") params.append("category", categoryFilter)
      if (activeFilter && activeFilter !== "all") params.append("isActive", activeFilter)

      const response = await fetch(`/api/settings/procedures?${params}`)
      if (!response.ok) throw new Error("Failed to fetch procedures")

      const data = await response.json()
      setProcedures(data.data || [])
      setPagination(data.pagination)
    } catch (error) {
      console.error("Error fetching procedures:", error)
      toast({
        title: "Error",
        description: "Failed to fetch procedures",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProcedures()
  }, [pagination.page, search, categoryFilter, activeFilter])

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      category: "",
      description: "",
      defaultDuration: "30",
      basePrice: "",
      materials: "",
      preInstructions: "",
      postInstructions: "",
      isActive: true,
    })
    setError("")
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogMode("create")
    setDialogOpen(true)
  }

  const openEditDialog = (procedure: Procedure) => {
    setSelectedProcedure(procedure)
    setFormData({
      code: procedure.code,
      name: procedure.name,
      category: procedure.category,
      description: procedure.description || "",
      defaultDuration: procedure.defaultDuration.toString(),
      basePrice: procedure.basePrice.toString(),
      materials: procedure.materials || "",
      preInstructions: procedure.preInstructions || "",
      postInstructions: procedure.postInstructions || "",
      isActive: procedure.isActive,
    })
    setDialogMode("edit")
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    setError("")

    // Validation
    if (dialogMode === "create" && !formData.code) {
      setError("Code is required")
      return
    }

    if (!formData.name || !formData.category || !formData.basePrice) {
      setError("Name, category, and base price are required")
      return
    }

    setActionLoading(true)

    try {
      const url = dialogMode === "create"
        ? "/api/settings/procedures"
        : `/api/settings/procedures/${selectedProcedure?.id}`

      const response = await fetch(url, {
        method: dialogMode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          code: formData.code.toUpperCase(),
          defaultDuration: parseInt(formData.defaultDuration),
          basePrice: parseFloat(formData.basePrice),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save procedure")
      }

      toast({
        title: "Success",
        description: dialogMode === "create"
          ? "Procedure created successfully"
          : "Procedure updated successfully",
      })

      setDialogOpen(false)
      fetchProcedures()
    } catch (error: any) {
      setError(error.message)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedProcedure) return

    setActionLoading(true)

    try {
      const response = await fetch(`/api/settings/procedures/${selectedProcedure.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete procedure")
      }

      toast({
        title: "Success",
        description: data.deactivated
          ? "Procedure has been deactivated as it is used in existing treatments"
          : "Procedure deleted successfully",
      })

      setDeleteDialogOpen(false)
      setSelectedProcedure(null)
      fetchProcedures()
    } catch (error: any) {
      setError(error.message)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleActive = async (procedure: Procedure) => {
    try {
      const response = await fetch(`/api/settings/procedures/${procedure.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !procedure.isActive }),
      })

      if (!response.ok) throw new Error("Failed to update procedure")

      toast({
        title: "Success",
        description: `Procedure ${!procedure.isActive ? "activated" : "deactivated"} successfully`,
      })

      fetchProcedures()
    } catch (error: any) {
      console.error("Error updating procedure:", error)
      toast({
        title: "Error",
        description: "Failed to update procedure status",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Procedures</h1>
          <p className="text-muted-foreground">
            Manage dental procedures catalog
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Procedure
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search procedures..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {procedureCategoryConfig[cat]?.label || cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Procedures Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : procedures.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Stethoscope className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No procedures found</p>
                      <Button variant="outline" size="sm" onClick={openCreateDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Procedure
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                procedures.map((procedure) => (
                  <TableRow key={procedure.id} className={!procedure.isActive ? "opacity-50" : ""}>
                    <TableCell className="font-mono font-medium">
                      {procedure.code}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{procedure.name}</div>
                      {procedure.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {procedure.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${procedureCategoryConfig[procedure.category]?.bgColor} ${procedureCategoryConfig[procedure.category]?.color} border-0`}
                      >
                        {procedureCategoryConfig[procedure.category]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{procedure.defaultDuration} min</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(procedure.basePrice)}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={procedure.isActive}
                        onCheckedChange={() => handleToggleActive(procedure)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(procedure)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedProcedure(procedure)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} procedures
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Add New Procedure" : "Edit Procedure"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "Add a new procedure to your catalog"
                : "Update procedure details"}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., PRV001"
                  maxLength={10}
                  disabled={dialogMode === "edit"}
                  className="uppercase"
                />
                {dialogMode === "edit" && (
                  <p className="text-xs text-muted-foreground">Code cannot be changed</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {procedureCategoryConfig[cat]?.label || cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Procedure name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the procedure"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultDuration">Duration (minutes)</Label>
                <Input
                  id="defaultDuration"
                  type="number"
                  value={formData.defaultDuration}
                  onChange={(e) => setFormData({ ...formData, defaultDuration: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="basePrice">Base Price *</Label>
                <Input
                  id="basePrice"
                  type="number"
                  step="0.01"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="materials">Materials</Label>
              <Textarea
                id="materials"
                value={formData.materials}
                onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                placeholder="List of materials used"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preInstructions">Pre-procedure Instructions</Label>
              <Textarea
                id="preInstructions"
                value={formData.preInstructions}
                onChange={(e) => setFormData({ ...formData, preInstructions: e.target.value })}
                placeholder="Instructions for patients before the procedure"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postInstructions">Post-procedure Instructions</Label>
              <Textarea
                id="postInstructions"
                value={formData.postInstructions}
                onChange={(e) => setFormData({ ...formData, postInstructions: e.target.value })}
                placeholder="Instructions for patients after the procedure"
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={actionLoading}>
              {actionLoading ? "Saving..." : dialogMode === "create" ? "Add Procedure" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Procedure</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProcedure?.name}"? If this
              procedure is used in treatments, it will be deactivated instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading}
            >
              {actionLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
