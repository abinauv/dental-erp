"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
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
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  UserCog,
  MoreHorizontal,
  Eye,
  Edit,
  Phone,
  Mail,
  Calendar,
  BarChart3,
  UserX,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { ExportMenu } from "@/components/ui/export-menu"

interface Staff {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  phone: string
  email: string
  specialization: string | null
  qualification: string | null
  joiningDate: string
  isActive: boolean
  user: {
    id: string
    role: string
    isActive: boolean
    email: string
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  DOCTOR: "bg-blue-100 text-blue-700",
  RECEPTIONIST: "bg-green-100 text-green-700",
  LAB_TECH: "bg-orange-100 text-orange-700",
  ACCOUNTANT: "bg-yellow-100 text-yellow-700",
}

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  RECEPTIONIST: "Receptionist",
  LAB_TECH: "Lab Tech",
  ACCOUNTANT: "Accountant",
}

export default function StaffPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null)

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (search) params.append("search", search)
      if (roleFilter && roleFilter !== "all") params.append("role", roleFilter)
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter)

      const response = await fetch(`/api/staff?${params}`)
      if (!response.ok) throw new Error("Failed to fetch staff")

      const data = await response.json()
      setStaff(data.staff)
      setPagination(data.pagination)
    } catch (error) {
      console.error("Error fetching staff:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch staff members",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaff()
  }, [pagination.page, search, roleFilter, statusFilter])

  const handleDeactivate = async () => {
    if (!staffToDelete) return

    try {
      const response = await fetch(`/api/staff/${staffToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to deactivate staff")

      toast({
        title: "Success",
        description: "Staff member deactivated successfully",
      })
      fetchStaff()
    } catch (error) {
      console.error("Error deactivating staff:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to deactivate staff member",
      })
    } finally {
      setDeleteDialogOpen(false)
      setStaffToDelete(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground">
            Manage staff members, roles, and permissions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu
            filename="staff"
            getData={() => staff.map(m => ({
              "Employee ID": m.employeeId,
              "First Name": m.firstName,
              "Last Name": m.lastName,
              "Phone": m.phone,
              "Email": m.email || "",
              "Role": roleLabels[m.user.role] || m.user.role,
              "Specialization": m.specialization || "",
              "Qualification": m.qualification || "",
              "Joining Date": formatDate(m.joiningDate),
              "Status": m.isActive ? "Active" : "Inactive",
            }))}
          />
          <Link href="/staff/attendance">
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Attendance
            </Button>
          </Link>
          <Link href="/staff/leaves">
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Leaves
            </Button>
          </Link>
          <Link href="/staff/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Staff
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, employee ID, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="DOCTOR">Doctor</SelectItem>
                  <SelectItem value="RECEPTIONIST">Receptionist</SelectItem>
                  <SelectItem value="LAB_TECH">Lab Tech</SelectItem>
                  <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <UserCog className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No staff members found</p>
                      <Link href="/staff/new">
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Staff
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="font-medium">{member.employeeId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <UserCog className="h-4 w-4 text-primary" />
                        </div>
                        <div className="font-medium">
                          {member.firstName} {member.lastName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {member.phone}
                        </div>
                        {member.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${roleColors[member.user.role]} border-0`}>
                        {roleLabels[member.user.role] || member.user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {member.specialization || member.qualification || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(member.joiningDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/staff/${member.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/staff/${member.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {member.user.role === "DOCTOR" && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/staff/${member.id}/performance`)}
                            >
                              <BarChart3 className="h-4 w-4 mr-2" />
                              Performance
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {member.isActive && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setStaffToDelete(member)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          )}
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
                {pagination.total} staff members
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

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <strong>
                {staffToDelete?.firstName} {staffToDelete?.lastName}
              </strong>
              ? They will no longer be able to log in to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-red-600 hover:bg-red-700"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
