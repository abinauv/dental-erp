"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  Users,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface StaffMember {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  todayStatus: string | null
  clockIn: string | null
  clockOut: string | null
  attendanceNotes: string | null
  user: {
    role: string
  }
}

interface AttendanceSummary {
  total: number
  present: number
  absent: number
  late: number
  halfDay: number
  onLeave: number
  notMarked: number
}

interface TodayAttendance {
  date: string
  summary: AttendanceSummary
  staff: StaffMember[]
}

const statusColors: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700",
  ABSENT: "bg-red-100 text-red-700",
  LATE: "bg-yellow-100 text-yellow-700",
  HALF_DAY: "bg-orange-100 text-orange-700",
  ON_LEAVE: "bg-blue-100 text-blue-700",
}

const statusLabels: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  HALF_DAY: "Half Day",
  ON_LEAVE: "On Leave",
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  DOCTOR: "bg-blue-100 text-blue-700",
  RECEPTIONIST: "bg-green-100 text-green-700",
  LAB_TECH: "bg-orange-100 text-orange-700",
  ACCOUNTANT: "bg-yellow-100 text-yellow-700",
}

export default function AttendancePage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [todayData, setTodayData] = useState<TodayAttendance | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])

  // Mark attendance dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [marking, setMarking] = useState(false)
  const [attendanceForm, setAttendanceForm] = useState({
    status: "",
    clockIn: "",
    clockOut: "",
    notes: "",
  })

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/staff/attendance/today")
      if (!response.ok) throw new Error("Failed to fetch attendance")

      const data = await response.json()
      setTodayData(data)
    } catch (error) {
      console.error("Error fetching attendance:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch attendance data",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTodayAttendance()
  }, [])

  const openMarkDialog = (staff: StaffMember) => {
    setSelectedStaff(staff)
    setAttendanceForm({
      status: staff.todayStatus || "",
      clockIn: staff.clockIn ? new Date(staff.clockIn).toTimeString().slice(0, 5) : "",
      clockOut: staff.clockOut ? new Date(staff.clockOut).toTimeString().slice(0, 5) : "",
      notes: staff.attendanceNotes || "",
    })
    setDialogOpen(true)
  }

  const handleMarkAttendance = async () => {
    if (!selectedStaff || !attendanceForm.status) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a status",
      })
      return
    }

    try {
      setMarking(true)

      const today = new Date().toISOString().split("T")[0]

      const payload: any = {
        staffId: selectedStaff.id,
        date: today,
        status: attendanceForm.status,
        notes: attendanceForm.notes || null,
      }

      if (attendanceForm.clockIn) {
        payload.clockIn = `${today}T${attendanceForm.clockIn}:00`
      }
      if (attendanceForm.clockOut) {
        payload.clockOut = `${today}T${attendanceForm.clockOut}:00`
      }

      const response = await fetch("/api/staff/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error("Failed to mark attendance")

      toast({
        title: "Success",
        description: "Attendance marked successfully",
      })

      setDialogOpen(false)
      fetchTodayAttendance()
    } catch (error) {
      console.error("Error marking attendance:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to mark attendance",
      })
    } finally {
      setMarking(false)
    }
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/staff">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
            <p className="text-muted-foreground">
              Track and manage staff attendance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg font-medium">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      {todayData && (
        <div className="grid gap-4 md:grid-cols-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Staff</span>
              </div>
              <p className="text-2xl font-bold mt-1">{todayData.summary.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Present</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-green-600">
                {todayData.summary.present}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-600" />
                <span className="text-sm text-muted-foreground">Absent</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-red-600">
                {todayData.summary.absent}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-muted-foreground">Late</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-yellow-600">
                {todayData.summary.late}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">On Leave</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-blue-600">
                {todayData.summary.onLeave}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Not Marked</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-muted-foreground">
                {todayData.summary.notMarked}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Attendance</CardTitle>
          <CardDescription>
            Click on a staff member to mark or update their attendance
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : !todayData || todayData.staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No staff members found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                todayData.staff.map((member) => (
                  <TableRow
                    key={member.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openMarkDialog(member)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.employeeId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${roleColors[member.user.role]} border-0`}>
                        {member.user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.todayStatus ? (
                        <Badge className={`${statusColors[member.todayStatus]} border-0`}>
                          {statusLabels[member.todayStatus]}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not Marked
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatTime(member.clockIn)}</TableCell>
                    <TableCell>{formatTime(member.clockOut)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          openMarkDialog(member)
                        }}
                      >
                        {member.todayStatus ? "Update" : "Mark"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mark Attendance Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedStaff?.todayStatus ? "Update" : "Mark"} Attendance
            </DialogTitle>
            <DialogDescription>
              {selectedStaff?.firstName} {selectedStaff?.lastName} ({selectedStaff?.employeeId})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select
                value={attendanceForm.status}
                onValueChange={(value) =>
                  setAttendanceForm((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="ABSENT">Absent</SelectItem>
                  <SelectItem value="LATE">Late</SelectItem>
                  <SelectItem value="HALF_DAY">Half Day</SelectItem>
                  <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Clock In</Label>
                <Input
                  type="time"
                  value={attendanceForm.clockIn}
                  onChange={(e) =>
                    setAttendanceForm((prev) => ({ ...prev, clockIn: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Clock Out</Label>
                <Input
                  type="time"
                  value={attendanceForm.clockOut}
                  onChange={(e) =>
                    setAttendanceForm((prev) => ({ ...prev, clockOut: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={attendanceForm.notes}
                onChange={(e) =>
                  setAttendanceForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Optional notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkAttendance} disabled={marking}>
              {marking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
