"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  ArrowLeft,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Edit,
  FileText,
  Upload,
  Download,
  Trash2,
  MoreHorizontal,
  User,
  Stethoscope,
  CreditCard,
  FolderOpen,
  Heart,
  AlertCircle,
  FileImage,
  FileScan,
  FileCheck,
  Loader2,
  Eye,
  History,
  Pill,
  TestTube,
  Smile,
  Shield,
  Pen,
} from "lucide-react"
import { DentalChart } from "@/components/dental-chart"
import { Patient360 } from "@/components/ai/patient-360"
import { PatientFormSubmissions } from "@/components/forms/patient-form-submissions"
import { PatientInsurance } from "@/components/insurance/patient-insurance"
import { ImageViewer } from "@/components/imaging/image-viewer"
import { ImageAnnotator, type Annotation } from "@/components/imaging/image-annotator"
import { ImageCompare } from "@/components/imaging/image-compare"

interface Patient {
  id: string
  patientId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  alternatePhone?: string
  dateOfBirth: string
  gender: string
  bloodGroup?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  occupation?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
  medicalHistory?: {
    allergies?: string[]
    chronicConditions?: string[]
    currentMedications?: string[]
    familyHistory?: string
  }
  appointments: any[]
  treatments: any[]
  invoices: any[]
  documents: Document[]
  _count: {
    appointments: number
    treatments: number
    invoices: number
    documents: number
  }
}

interface Document {
  id: string
  fileName: string
  originalName: string
  fileType: string
  fileSize: number
  filePath: string
  documentType: string
  description?: string
  annotations?: Annotation[]
  annotatedBy?: string
  annotatedAt?: string
  createdAt: string
  treatment?: {
    procedure: {
      name: string
    }
  }
}

interface TimelineEvent {
  id: string
  type: 'appointment' | 'treatment' | 'payment' | 'document' | 'prescription' | 'lab_order'
  date: string
  title: string
  description?: string
  status?: string
  metadata?: Record<string, any>
}

const DOCUMENT_TYPES = [
  { value: 'XRAY', label: 'X-Ray', icon: FileScan },
  { value: 'CT_SCAN', label: 'CT Scan', icon: FileScan },
  { value: 'PHOTO', label: 'Photo', icon: FileImage },
  { value: 'CONSENT_FORM', label: 'Consent Form', icon: FileCheck },
  { value: 'PRESCRIPTION', label: 'Prescription', icon: FileText },
  { value: 'LAB_REPORT', label: 'Lab Report', icon: FileText },
  { value: 'INSURANCE', label: 'Insurance', icon: FileText },
  { value: 'ID_PROOF', label: 'ID Proof', icon: FileText },
  { value: 'OTHER', label: 'Other', icon: FolderOpen },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getDocumentTypeIcon(type: string) {
  const docType = DOCUMENT_TYPES.find(d => d.value === type)
  return docType?.icon || FileText
}

function getDocumentTypeLabel(type: string) {
  const docType = DOCUMENT_TYPES.find(d => d.value === type)
  return docType?.label || type
}

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  // Document upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')

  // Document view state
  const [viewDocument, setViewDocument] = useState<Document | null>(null)
  const [viewerIndex, setViewerIndex] = useState(0)

  // Annotation state
  const [annotateDocument, setAnnotateDocument] = useState<Document | null>(null)

  // Compare state
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelection, setCompareSelection] = useState<Document[]>([])
  const [compareOpen, setCompareOpen] = useState(false)

  // Timeline state
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineFilter, setTimelineFilter] = useState<string>('all')

  const fetchPatient = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/patients/${resolvedParams.id}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Failed to fetch patient (${response.status})`)
      }

      const data = await response.json()
      setPatient(data.patient)
    } catch (error: any) {
      console.error("Error fetching patient:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load patient details",
      })
    } finally {
      setLoading(false)
    }
  }, [resolvedParams.id, toast])

  useEffect(() => {
    fetchPatient()
  }, [fetchPatient])

  const fetchTimeline = useCallback(async () => {
    try {
      setTimelineLoading(true)
      const typeParam = timelineFilter !== 'all' ? `?type=${timelineFilter}` : ''
      const response = await fetch(`/api/patients/${resolvedParams.id}/timeline${typeParam}`)
      if (!response.ok) throw new Error("Failed to fetch timeline")

      const data = await response.json()
      setTimelineEvents(data.events)
    } catch (error) {
      console.error("Error fetching timeline:", error)
    } finally {
      setTimelineLoading(false)
    }
  }, [resolvedParams.id, timelineFilter])

  useEffect(() => {
    if (activeTab === 'timeline') {
      fetchTimeline()
    }
  }, [activeTab, fetchTimeline])

  const handleUploadDocument = async () => {
    if (!uploadFile || !uploadType) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a file and document type",
      })
      return
    }

    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('documentType', uploadType)
      if (uploadDescription) {
        formData.append('description', uploadDescription)
      }

      const response = await fetch(`/api/patients/${resolvedParams.id}/documents`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to upload document")
      }

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      })

      setUploadDialogOpen(false)
      setUploadFile(null)
      setUploadType('')
      setUploadDescription('')
      fetchPatient()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to upload document",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadDocument = async (doc: Document) => {
    try {
      const response = await fetch(`/api/patients/${resolvedParams.id}/documents/${doc.id}?download=true`)
      if (!response.ok) throw new Error("Failed to download document")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.originalName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download document",
      })
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    const ok = await confirm({ title: "Delete document?", description: "Are you sure you want to delete this document?", confirmLabel: "Delete" }); if (!ok) return

    try {
      const response = await fetch(`/api/patients/${resolvedParams.id}/documents/${docId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error("Failed to delete document")

      toast({
        title: "Success",
        description: "Document deleted successfully",
      })
      fetchPatient()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete document",
      })
    }
  }

  // Save annotations for a document
  const handleSaveAnnotations = async (docId: string, annotations: Annotation[]) => {
    const response = await fetch(
      `/api/patients/${resolvedParams.id}/documents/${docId}/annotations`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations }),
      }
    )
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || "Failed to save annotations")
    }
    toast({ title: "Annotations saved" })
    fetchPatient()
  }

  // Get image documents only
  const imageDocuments = patient?.documents.filter((d) => d.fileType.startsWith("image/")) || []

  // Get image list for viewer navigation
  const viewerImages = imageDocuments.map((d) => ({
    src: `/api${d.filePath}`,
    title: d.originalName,
    subtitle: getDocumentTypeLabel(d.documentType),
  }))

  // Handle compare selection
  const handleToggleCompare = (doc: Document) => {
    setCompareSelection((prev) => {
      const exists = prev.find((d) => d.id === doc.id)
      if (exists) return prev.filter((d) => d.id !== doc.id)
      if (prev.length >= 2) return [prev[1], doc]
      return [...prev, doc]
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Patient not found</p>
        <Button onClick={() => router.push('/patients')}>Back to Patients</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/patients')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">
              {patient.firstName[0]}{patient.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="text-muted-foreground">Patient ID: {patient.patientId}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">{patient.gender}</Badge>
              {patient.bloodGroup && <Badge variant="secondary">{patient.bloodGroup}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/patients/${patient.id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Link href={`/appointments/new?patientId=${patient.id}`}>
            <Button>
              <Calendar className="h-4 w-4 mr-2" />
              Book Appointment
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="overview" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="dental-chart" className="gap-2">
            <Smile className="h-4 w-4" />
            <span className="hidden sm:inline">Dental Chart</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Timeline</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
            <Badge variant="secondary" className="ml-1">{patient._count.documents}</Badge>
          </TabsTrigger>
          <TabsTrigger value="appointments" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Appointments</span>
          </TabsTrigger>
          <TabsTrigger value="treatments" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            <span className="hidden sm:inline">Treatments</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Billing</span>
          </TabsTrigger>
          <TabsTrigger value="forms" className="gap-2">
            <FileCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Forms</span>
          </TabsTrigger>
          <TabsTrigger value="insurance" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Insurance</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Patient360 patientId={patient.id} />
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p>{patient.phone}</p>
                    {patient.alternatePhone && (
                      <p className="text-sm text-muted-foreground">{patient.alternatePhone}</p>
                    )}
                  </div>
                </div>
                {patient.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p>{patient.email}</p>
                    </div>
                  </div>
                )}
                {patient.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p>{patient.address}</p>
                      <p className="text-sm text-muted-foreground">
                        {[patient.city, patient.state, patient.pincode].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Personal Details */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Date of Birth</p>
                    <p>{format(new Date(patient.dateOfBirth), 'PPP')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gender</p>
                    <p>{patient.gender}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Blood Group</p>
                    <p>{patient.bloodGroup || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Occupation</p>
                    <p>{patient.occupation || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent>
                {patient.emergencyContactName ? (
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p>{patient.emergencyContactName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p>{patient.emergencyContactPhone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Relation</p>
                      <p>{patient.emergencyContactRelation}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No emergency contact on file</p>
                )}
              </CardContent>
            </Card>

            {/* Medical History Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Medical History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {patient.medicalHistory ? (
                  <div className="space-y-3">
                    {patient.medicalHistory.allergies && patient.medicalHistory.allergies.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Allergies</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patient.medicalHistory.allergies.map((allergy, i) => (
                            <Badge key={i} variant="destructive">{allergy}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {patient.medicalHistory.chronicConditions && patient.medicalHistory.chronicConditions.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Chronic Conditions</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patient.medicalHistory.chronicConditions.map((condition, i) => (
                            <Badge key={i} variant="secondary">{condition}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {patient.medicalHistory.currentMedications && patient.medicalHistory.currentMedications.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Current Medications</p>
                        <p className="text-sm">{patient.medicalHistory.currentMedications.join(', ')}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No medical history recorded</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Dental Chart Tab */}
        <TabsContent value="dental-chart" className="space-y-6">
          <DentalChart patientId={patient.id} />
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Patient Timeline</CardTitle>
                <CardDescription>
                  Complete history of appointments, treatments, payments, and documents
                </CardDescription>
              </div>
              <Select value={timelineFilter} onValueChange={setTimelineFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="appointment">Appointments</SelectItem>
                  <SelectItem value="treatment">Treatments</SelectItem>
                  <SelectItem value="payment">Payments</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                  <SelectItem value="prescription">Prescriptions</SelectItem>
                  <SelectItem value="lab_order">Lab Orders</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {timelineLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px]">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No events found</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

                  <div className="space-y-6">
                    {timelineEvents.map((event, index) => {
                      const getEventIcon = () => {
                        switch (event.type) {
                          case 'appointment':
                            return <Calendar className="h-4 w-4" />
                          case 'treatment':
                            return <Stethoscope className="h-4 w-4" />
                          case 'payment':
                            return <CreditCard className="h-4 w-4" />
                          case 'document':
                            return <FileText className="h-4 w-4" />
                          case 'prescription':
                            return <Pill className="h-4 w-4" />
                          case 'lab_order':
                            return <TestTube className="h-4 w-4" />
                          default:
                            return <User className="h-4 w-4" />
                        }
                      }

                      const getEventColor = () => {
                        switch (event.type) {
                          case 'appointment':
                            return 'bg-blue-100 text-blue-600 border-blue-200'
                          case 'treatment':
                            return 'bg-green-100 text-green-600 border-green-200'
                          case 'payment':
                            return 'bg-yellow-100 text-yellow-600 border-yellow-200'
                          case 'document':
                            return 'bg-purple-100 text-purple-600 border-purple-200'
                          case 'prescription':
                            return 'bg-orange-100 text-orange-600 border-orange-200'
                          case 'lab_order':
                            return 'bg-pink-100 text-pink-600 border-pink-200'
                          default:
                            return 'bg-muted text-muted-foreground border-border'
                        }
                      }

                      return (
                        <div key={event.id} className="relative flex gap-4 pl-1">
                          {/* Timeline dot */}
                          <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 ${getEventColor()}`}>
                            {getEventIcon()}
                          </div>

                          {/* Event content */}
                          <div className="flex-1 pb-6">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{event.title}</p>
                                {event.description && (
                                  <p className="text-sm text-muted-foreground">{event.description}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(event.date), 'PPP')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(event.date), 'p')}
                                </p>
                              </div>
                            </div>

                            {event.status && (
                              <Badge
                                variant={
                                  event.status === 'COMPLETED' || event.status === 'PAID' ? 'default' :
                                  event.status === 'CANCELLED' ? 'destructive' :
                                  'secondary'
                                }
                                className="mt-2"
                              >
                                {event.status}
                              </Badge>
                            )}

                            {/* Additional metadata display */}
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {event.metadata.toothNumbers && (
                                  <span className="text-xs bg-muted px-2 py-1 rounded">
                                    Teeth: {event.metadata.toothNumbers}
                                  </span>
                                )}
                                {event.metadata.cost && (
                                  <span className="text-xs bg-muted px-2 py-1 rounded">
                                    ₹{Number(event.metadata.cost).toLocaleString()}
                                  </span>
                                )}
                                {event.metadata.amount && (
                                  <span className="text-xs bg-muted px-2 py-1 rounded">
                                    ₹{Number(event.metadata.amount).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Documents</CardTitle>
                <CardDescription>
                  X-rays, photos, consent forms, and other patient documents
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {imageDocuments.length >= 2 && (
                  <Button
                    variant={compareMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCompareMode((m) => !m)
                      setCompareSelection([])
                    }}
                  >
                    {compareMode ? "Cancel Compare" : "Compare"}
                  </Button>
                )}
                {compareMode && compareSelection.length === 2 && (
                  <Button size="sm" onClick={() => setCompareOpen(true)}>
                    Compare Selected
                  </Button>
                )}
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                    <DialogDescription>
                      Upload a new document for this patient
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="file">File</Label>
                      <Input
                        id="file"
                        type="file"
                        accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Supported: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX (max 10MB)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Document Type</Label>
                      <Select value={uploadType} onValueChange={setUploadType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description (optional)</Label>
                      <Textarea
                        id="description"
                        placeholder="Enter a description..."
                        value={uploadDescription}
                        onChange={(e) => setUploadDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUploadDocument} disabled={uploading}>
                      {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Upload
                    </Button>
                  </DialogFooter>
                </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {patient.documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No documents uploaded yet</p>
                  <p className="text-sm text-muted-foreground">
                    Upload X-rays, photos, or other documents
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {compareMode && <TableHead className="w-10" />}
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patient.documents.map((doc) => {
                      const IconComponent = getDocumentTypeIcon(doc.documentType)
                      const isImage = doc.fileType.startsWith("image/")
                      const isSelected = compareSelection.some((d) => d.id === doc.id)
                      return (
                        <TableRow key={doc.id} className={isSelected ? "bg-blue-50" : ""}>
                          {compareMode && (
                            <TableCell>
                              {isImage && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleCompare(doc)}
                                  className="h-4 w-4"
                                />
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {isImage ? (
                                <div
                                  className="flex h-10 w-10 items-center justify-center rounded bg-muted overflow-hidden cursor-pointer"
                                  onClick={() => {
                                    const idx = imageDocuments.findIndex((d) => d.id === doc.id)
                                    setViewerIndex(idx >= 0 ? idx : 0)
                                    setViewDocument(doc)
                                  }}
                                >
                                  <img
                                    src={`/api${doc.filePath}`}
                                    alt=""
                                    className="h-10 w-10 object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                                  <IconComponent className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium">{doc.originalName}</p>
                                {doc.description && (
                                  <p className="text-sm text-muted-foreground">{doc.description}</p>
                                )}
                                {doc.annotations && (doc.annotations as Annotation[]).length > 0 && (
                                  <Badge variant="secondary" className="text-xs mt-0.5">
                                    {(doc.annotations as Annotation[]).length} annotation{(doc.annotations as Annotation[]).length !== 1 ? "s" : ""}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getDocumentTypeLabel(doc.documentType)}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                          <TableCell>{format(new Date(doc.createdAt), 'PP')}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {isImage && (
                                  <>
                                    <DropdownMenuItem onClick={() => {
                                      const idx = imageDocuments.findIndex((d) => d.id === doc.id)
                                      setViewerIndex(idx >= 0 ? idx : 0)
                                      setViewDocument(doc)
                                    }}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setAnnotateDocument(doc)}>
                                      <Pen className="h-4 w-4 mr-2" />
                                      Annotate
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuItem onClick={() => handleDownloadDocument(doc)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Image Viewer */}
          {viewDocument && (
            <ImageViewer
              open={!!viewDocument}
              onOpenChange={(open) => { if (!open) setViewDocument(null) }}
              src={`/api${viewDocument.filePath}`}
              title={viewDocument.originalName}
              subtitle={viewDocument.description || getDocumentTypeLabel(viewDocument.documentType)}
              images={viewerImages}
              currentIndex={viewerIndex}
              onIndexChange={(idx) => {
                setViewerIndex(idx)
                setViewDocument(imageDocuments[idx])
              }}
              onDownload={() => handleDownloadDocument(viewDocument)}
              onAnnotate={() => {
                setViewDocument(null)
                setAnnotateDocument(viewDocument)
              }}
              onCompare={imageDocuments.length >= 2 ? () => {
                setViewDocument(null)
                setCompareMode(true)
              } : undefined}
            />
          )}

          {/* Image Annotator */}
          {annotateDocument && (
            <ImageAnnotator
              open={!!annotateDocument}
              onOpenChange={(open) => { if (!open) setAnnotateDocument(null) }}
              src={`/api${annotateDocument.filePath}`}
              title={annotateDocument.originalName}
              annotations={(annotateDocument.annotations as Annotation[]) || []}
              onSave={(anns) => handleSaveAnnotations(annotateDocument.id, anns)}
            />
          )}

          {/* Image Compare */}
          {compareSelection.length === 2 && (
            <ImageCompare
              open={compareOpen}
              onOpenChange={setCompareOpen}
              before={{
                src: `/api${compareSelection[0].filePath}`,
                title: compareSelection[0].originalName,
                date: format(new Date(compareSelection[0].createdAt), "PP"),
              }}
              after={{
                src: `/api${compareSelection[1].filePath}`,
                title: compareSelection[1].originalName,
                date: format(new Date(compareSelection[1].createdAt), "PP"),
              }}
            />
          )}
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Appointments</CardTitle>
                <CardDescription>
                  Recent and upcoming appointments
                </CardDescription>
              </div>
              <Link href={`/appointments/new?patientId=${patient.id}`}>
                <Button>
                  <Calendar className="h-4 w-4 mr-2" />
                  New Appointment
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {patient.appointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px]">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No appointments found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patient.appointments.map((apt) => (
                      <TableRow key={apt.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {format(new Date(apt.scheduledDate), 'PPP')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(apt.scheduledDate), 'p')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{apt.appointmentType}</TableCell>
                        <TableCell>
                          {apt.doctor
                            ? `Dr. ${apt.doctor.firstName} ${apt.doctor.lastName}`
                            : 'Not assigned'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              apt.status === 'COMPLETED' ? 'default' :
                              apt.status === 'CANCELLED' ? 'destructive' :
                              'secondary'
                            }
                          >
                            {apt.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Treatments Tab */}
        <TabsContent value="treatments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Treatment History</CardTitle>
              <CardDescription>
                Past procedures and treatments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {patient.treatments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px]">
                  <Stethoscope className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No treatments recorded</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Procedure</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patient.treatments.map((treatment) => (
                      <TableRow key={treatment.id}>
                        <TableCell>
                          {format(new Date(treatment.createdAt), 'PP')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {treatment.procedure.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{treatment.procedure.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {treatment.doctor
                            ? `Dr. ${treatment.doctor.firstName} ${treatment.doctor.lastName}`
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              treatment.status === 'COMPLETED' ? 'default' :
                              treatment.status === 'CANCELLED' ? 'destructive' :
                              'secondary'
                            }
                          >
                            {treatment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>
                Invoices and payment records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {patient.invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px]">
                  <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No invoices found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patient.invoices.map((invoice) => {
                      const totalPaid = invoice.payments.reduce(
                        (sum: number, p: any) => sum + Number(p.amount),
                        0
                      )
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.invoiceNumber}
                          </TableCell>
                          <TableCell>
                            {format(new Date(invoice.createdAt), 'PP')}
                          </TableCell>
                          <TableCell>₹{Number(invoice.totalAmount).toLocaleString()}</TableCell>
                          <TableCell>₹{totalPaid.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                invoice.status === 'PAID' ? 'default' :
                                invoice.status === 'CANCELLED' ? 'destructive' :
                                'secondary'
                              }
                            >
                              {invoice.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forms Tab */}
        <TabsContent value="forms" className="space-y-6">
          <PatientFormSubmissions patientId={patient.id} />
        </TabsContent>

        {/* Insurance Tab */}
        <TabsContent value="insurance" className="space-y-6">
          <PatientInsurance patientId={patient.id} />
        </TabsContent>
      </Tabs>
      {ConfirmDialogComponent}
    </div>
  )
}
