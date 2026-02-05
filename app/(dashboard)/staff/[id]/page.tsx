"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  Shield,
  User,
  Briefcase,
  Clock,
  FileText,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface StaffDetail {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  gender: string | null
  phone: string
  alternatePhone: string | null
  email: string
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  aadharNumber: string | null
  panNumber: string | null
  qualification: string | null
  specialization: string | null
  licenseNumber: string | null
  joiningDate: string
  salary: number | null
  bankAccountNo: string | null
  bankIfsc: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  isActive: boolean
  createdAt: string
  user: {
    id: string
    email: string
    role: string
    isActive: boolean
    createdAt: string
  }
  shifts: Array<{
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
    isActive: boolean
  }>
  _count: {
    appointments: number
    treatments: number
    prescriptions: number
  }
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  DOCTOR: "bg-blue-100 text-blue-700",
  RECEPTIONIST: "bg-green-100 text-green-700",
  LAB_TECH: "bg-orange-100 text-orange-700",
  ACCOUNTANT: "bg-yellow-100 text-yellow-700",
}

const roleLabels: Record<string, string> = {
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  RECEPTIONIST: "Receptionist",
  LAB_TECH: "Lab Technician",
  ACCOUNTANT: "Accountant",
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export default function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const [staff, setStaff] = useState<StaffDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStaff()
  }, [resolvedParams.id])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/staff/${resolvedParams.id}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            variant: "destructive",
            title: "Not Found",
            description: "Staff member not found",
          })
          router.push("/staff")
          return
        }
        throw new Error("Failed to fetch staff")
      }

      const data = await response.json()
      setStaff(data)
    } catch (error) {
      console.error("Error fetching staff:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch staff details",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "-"
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!staff) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Staff member not found</p>
        <Link href="/staff">
          <Button>Back to Staff List</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/staff">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  {staff.firstName} {staff.lastName}
                </h1>
                <Badge variant={staff.isActive ? "default" : "secondary"}>
                  {staff.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                <span>{staff.employeeId}</span>
                <Badge className={`${roleColors[staff.user.role]} border-0`}>
                  {roleLabels[staff.user.role]}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/staff/${staff.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="schedule">Work Schedule</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Primary Phone</p>
                    <p className="font-medium">{staff.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Alternate Phone</p>
                    <p className="font-medium">{staff.alternatePhone || "-"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{staff.email}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Address
                  </p>
                  <p className="font-medium">
                    {staff.address ? (
                      <>
                        {staff.address}
                        {staff.city && `, ${staff.city}`}
                        {staff.state && `, ${staff.state}`}
                        {staff.pincode && ` - ${staff.pincode}`}
                      </>
                    ) : (
                      "-"
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Personal Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">{formatDate(staff.dateOfBirth)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gender</p>
                    <p className="font-medium">{staff.gender || "-"}</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Aadhar Number</p>
                    <p className="font-medium">{staff.aadharNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">PAN Number</p>
                    <p className="font-medium">{staff.panNumber || "-"}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Emergency Contact</p>
                  <p className="font-medium">
                    {staff.emergencyContact
                      ? `${staff.emergencyContact} (${staff.emergencyPhone || "No phone"})`
                      : "-"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Professional Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Professional Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Qualification</p>
                    <p className="font-medium">{staff.qualification || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Specialization</p>
                    <p className="font-medium">{staff.specialization || "-"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">License Number</p>
                    <p className="font-medium">{staff.licenseNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Joining Date</p>
                    <p className="font-medium">{formatDate(staff.joiningDate)}</p>
                  </div>
                </div>
                {staff.user.role === "DOCTOR" && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-700">
                          {staff._count.appointments}
                        </p>
                        <p className="text-sm text-blue-600">Appointments</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-700">
                          {staff._count.treatments}
                        </p>
                        <p className="text-sm text-green-600">Treatments</p>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-700">
                          {staff._count.prescriptions}
                        </p>
                        <p className="text-sm text-purple-600">Prescriptions</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Financial Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Financial Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Salary</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(staff.salary ? Number(staff.salary) : null)}
                  </p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Bank Account No.</p>
                    <p className="font-medium">{staff.bankAccountNo || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">IFSC Code</p>
                    <p className="font-medium">{staff.bankIfsc || "-"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Work Schedule
              </CardTitle>
              <CardDescription>
                Weekly work schedule for {staff.firstName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {staff.shifts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No work schedule configured</p>
                  <Link href={`/staff/${staff.id}/edit`}>
                    <Button variant="outline" className="mt-4">
                      Configure Schedule
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-2">
                  {dayNames.map((day, index) => {
                    const shift = staff.shifts.find((s) => s.dayOfWeek === index)
                    return (
                      <div
                        key={day}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          shift && shift.isActive
                            ? "bg-green-50"
                            : "bg-gray-50"
                        }`}
                      >
                        <span className="font-medium">{day}</span>
                        <span
                          className={
                            shift && shift.isActive
                              ? "text-green-700"
                              : "text-muted-foreground"
                          }
                        >
                          {shift && shift.isActive
                            ? `${shift.startTime} - ${shift.endTime}`
                            : "Off"}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </CardTitle>
              <CardDescription>
                Staff documents and certifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Document management coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
