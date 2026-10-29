'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
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
  Upload,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { uploadUrl } from '@/lib/storage/keys'

interface StaffDoc {
  id: string
  originalName: string
  fileType: string
  fileSize: number
  filePath: string
  documentType: string | null
  description: string | null
  createdAt: string
}

const DOC_TYPES = ['contract', 'idProof', 'certificate', 'licence', 'other']

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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
  ADMIN: 'bg-purple-100 text-purple-700',
  DOCTOR: 'bg-blue-100 text-blue-700',
  RECEPTIONIST: 'bg-green-100 text-green-700',
  LAB_TECH: 'bg-orange-100 text-orange-700',
  ACCOUNTANT: 'bg-yellow-100 text-yellow-700',
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrator',
  DOCTOR: 'Doctor',
  RECEPTIONIST: 'Receptionist',
  LAB_TECH: 'Lab Technician',
  ACCOUNTANT: 'Accountant',
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const t = useTranslations('staff.detail')
  const fmt = useClinicFormatters()
  const { toast } = useToast()
  const roleLabel = (role: string) =>
    t.has(`roles.${role}`) ? t(`roles.${role}`) : roleLabels[role]
  const genderLabel = (g: string | null) =>
    g && t.has(`gender.${g}`) ? t(`gender.${g}`) : g || '-'
  const [staff, setStaff] = useState<StaffDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [documents, setDocuments] = useState<StaffDoc[]>([])
  const [docLoading, setDocLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState('contract')
  const [uploadDesc, setUploadDesc] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchStaff()
    fetchDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id])

  const fetchDocuments = async () => {
    setDocLoading(true)
    try {
      const res = await fetch(`/api/staff/${resolvedParams.id}/documents`)
      const data = await res.json()
      if (data.success) setDocuments(data.documents)
    } catch {
      // non-fatal; the tab just shows empty
    } finally {
      setDocLoading(false)
    }
  }

  const handleUploadDocument = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('documentType', uploadType)
      if (uploadDesc.trim()) form.append('description', uploadDesc.trim())
      const res = await fetch(`/api/staff/${resolvedParams.id}/documents`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('uploadError'))
      toast({ title: t('uploadSuccess') })
      setUploadDesc('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchDocuments()
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t('uploadError'),
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!window.confirm(t('deleteConfirm'))) return
    try {
      const res = await fetch(`/api/staff/${resolvedParams.id}/documents/${documentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      toast({ title: t('deleteSuccess') })
      setDocuments((prev) => prev.filter((d) => d.id !== documentId))
    } catch {
      toast({ title: t('deleteError'), variant: 'destructive' })
    }
  }

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/staff/${resolvedParams.id}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            variant: 'destructive',
            title: t('notFoundToast'),
            description: t('staffNotFound'),
          })
          router.push('/staff')
          return
        }
        throw new Error('Failed to fetch staff')
      }

      const data = await response.json()
      setStaff(data)
    } catch (error) {
      console.error('Error fetching staff:', error)
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('fetchFailed'),
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) =>
    fmt.formatDate(dateString, { day: 'numeric', month: 'long', year: 'numeric' })

  const formatCurrency = (amount: number | null) =>
    amount === null ? '-' : fmt.formatCurrency(amount, { maximumFractionDigits: 0 })

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
        <p className="text-muted-foreground">{t('staffNotFound')}</p>
        <Link href="/staff">
          <Button>{t('backToStaff')}</Button>
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
                <Badge variant={staff.isActive ? 'default' : 'secondary'}>
                  {staff.isActive ? t('active') : t('inactive')}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                <span>{staff.employeeId}</span>
                <Badge className={`${roleColors[staff.user.role]} border-0`}>
                  {roleLabel(staff.user.role)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/staff/${staff.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              {t('editProfile')}
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">{t('tabProfile')}</TabsTrigger>
          <TabsTrigger value="schedule">{t('tabSchedule')}</TabsTrigger>
          <TabsTrigger value="documents">{t('tabDocuments')}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {t('contactInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('primaryPhone')}</p>
                    <p className="font-medium">{staff.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('alternatePhone')}</p>
                    <p className="font-medium">{staff.alternatePhone || '-'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('email')}</p>
                  <p className="font-medium">{staff.email}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {t('address')}
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
                      '-'
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
                  {t('personalDetails')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('dateOfBirth')}</p>
                    <p className="font-medium">{formatDate(staff.dateOfBirth)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('genderLabel')}</p>
                    <p className="font-medium">{genderLabel(staff.gender)}</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('aadharNumber')}</p>
                    <p className="font-medium">{staff.aadharNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('panNumber')}</p>
                    <p className="font-medium">{staff.panNumber || '-'}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">{t('emergencyContact')}</p>
                  <p className="font-medium">
                    {staff.emergencyContact
                      ? t('emergencyValue', {
                          name: staff.emergencyContact,
                          phone: staff.emergencyPhone || t('noPhone'),
                        })
                      : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Professional Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  {t('professionalDetails')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('qualification')}</p>
                    <p className="font-medium">{staff.qualification || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('specialization')}</p>
                    <p className="font-medium">{staff.specialization || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('licenseNumber')}</p>
                    <p className="font-medium">{staff.licenseNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('joiningDate')}</p>
                    <p className="font-medium">{formatDate(staff.joiningDate)}</p>
                  </div>
                </div>
                {staff.user.role === 'DOCTOR' && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-700">
                          {staff._count.appointments}
                        </p>
                        <p className="text-sm text-blue-600">{t('appointments')}</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-700">
                          {staff._count.treatments}
                        </p>
                        <p className="text-sm text-green-600">{t('treatments')}</p>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-700">
                          {staff._count.prescriptions}
                        </p>
                        <p className="text-sm text-purple-600">{t('prescriptions')}</p>
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
                  {t('financialDetails')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('monthlySalary')}</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(staff.salary ? Number(staff.salary) : null)}
                  </p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('bankAccountNo')}</p>
                    <p className="font-medium">{staff.bankAccountNo || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('ifscCode')}</p>
                    <p className="font-medium">{staff.bankIfsc || '-'}</p>
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
                {t('workSchedule')}
              </CardTitle>
              <CardDescription>{t('scheduleDesc', { name: staff.firstName })}</CardDescription>
            </CardHeader>
            <CardContent>
              {staff.shifts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('noSchedule')}</p>
                  <Link href={`/staff/${staff.id}/edit`}>
                    <Button variant="outline" className="mt-4">
                      {t('configureSchedule')}
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
                          shift && shift.isActive ? 'bg-green-50' : 'bg-muted/50'
                        }`}
                      >
                        <span className="font-medium">{t(`days.${index}`)}</span>
                        <span
                          className={
                            shift && shift.isActive ? 'text-green-700' : 'text-muted-foreground'
                          }
                        >
                          {shift && shift.isActive
                            ? t('scheduleRange', { start: shift.startTime, end: shift.endTime })
                            : t('off')}
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
                {t('documents')}
              </CardTitle>
              <CardDescription>{t('documentsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload row */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end border-b pb-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('docTypeLabel')}
                  </label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="block w-full sm:w-40 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {DOC_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {t(`docTypes.${v}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUploadDocument(file)
                  }}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? t('uploading') : t('upload')}
                </Button>
              </div>

              {/* Document list */}
              {docLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('docEmpty')}</p>
                </div>
              ) : (
                <div className="rounded-md border divide-y">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <a
                          href={uploadUrl(doc.filePath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline truncate block"
                        >
                          {doc.originalName}
                        </a>
                        <div className="text-xs text-muted-foreground">
                          {doc.documentType && t.has(`docTypes.${doc.documentType}`)
                            ? t(`docTypes.${doc.documentType}`)
                            : doc.documentType || '—'}
                          {' · '}
                          {formatBytes(doc.fileSize)}
                          {' · '}
                          {fmt.formatDate(doc.createdAt)}
                          {doc.description ? ` · ${doc.description}` : ''}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        {t('deleteDoc')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
