'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Search, User, Stethoscope, Save, AlertCircle } from 'lucide-react'
import { DentalChart } from '@/components/treatments/dental-chart'
import { procedureCategoryConfig } from '@/lib/treatment-utils'
import { TreatmentAssist } from '@/components/ai/treatment-assist'
import { VoiceInput } from '@/components/clinical/voice-input'

interface Patient {
  id: string
  patientId: string
  firstName: string
  lastName: string
  phone: string
  email: string | null
}

interface Doctor {
  id: string
  firstName: string
  lastName: string
  specialization: string | null
}

interface Procedure {
  id: string
  code: string
  name: string
  category: string
  description: string | null
  defaultDuration: number
  basePrice: string | number
}

export default function NewTreatmentPage() {
  const router = useRouter()
  const t = useTranslations('treatments.new')
  const tCategory = useTranslations('treatments.category')
  const fmt = useClinicFormatters()
  const searchParams = useSearchParams()
  const preselectedPatientId = searchParams.get('patientId')
  const preselectedAppointmentId = searchParams.get('appointmentId')

  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [patientSearch, setPatientSearch] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    patientId: preselectedPatientId || '',
    doctorId: '',
    procedureId: '',
    appointmentId: preselectedAppointmentId || '',
    toothNumbers: [] as number[],
    chiefComplaint: '',
    diagnosis: '',
    findings: '',
    procedureNotes: '',
    materialsUsed: '',
    followUpRequired: false,
    followUpDate: '',
    cost: '',
  })

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null)

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [patientsRes, doctorsRes, proceduresRes] = await Promise.all([
          fetch('/api/patients?limit=100'),
          fetch('/api/staff/doctors'),
          fetch('/api/procedures?all=true&isActive=true'),
        ])

        if (patientsRes.ok) {
          const data = await patientsRes.json()
          setPatients(data.patients)
          // Set preselected patient if available
          if (preselectedPatientId) {
            const patient = data.patients.find((p: Patient) => p.id === preselectedPatientId)
            if (patient) setSelectedPatient(patient)
          }
        }

        if (doctorsRes.ok) {
          const data = await doctorsRes.json()
          setDoctors(data.doctors || data)
        }

        if (proceduresRes.ok) {
          const data = await proceduresRes.json()
          setProcedures(data.procedures)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchData()
  }, [preselectedPatientId])

  // Filter patients by search
  const filteredPatients = patients.filter((patient) => {
    const searchLower = patientSearch.toLowerCase()
    return (
      patient.firstName.toLowerCase().includes(searchLower) ||
      patient.lastName.toLowerCase().includes(searchLower) ||
      patient.phone.includes(patientSearch) ||
      patient.patientId.toLowerCase().includes(searchLower)
    )
  })

  // Group procedures by category
  const groupedProcedures = procedures.reduce(
    (acc, proc) => {
      if (!acc[proc.category]) {
        acc[proc.category] = []
      }
      acc[proc.category].push(proc)
      return acc
    },
    {} as Record<string, Procedure[]>
  )

  const handlePatientSelect = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId)
    setSelectedPatient(patient || null)
    setFormData({ ...formData, patientId })
  }

  const handleProcedureSelect = (procedureId: string) => {
    const procedure = procedures.find((p) => p.id === procedureId)
    setSelectedProcedure(procedure || null)
    setFormData({
      ...formData,
      procedureId,
      cost: procedure ? procedure.basePrice.toString() : '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.patientId) {
      setError(t('selectPatientError'))
      return
    }
    if (!formData.doctorId) {
      setError(t('selectDoctorError'))
      return
    }
    if (!formData.procedureId) {
      setError(t('selectProcedureError'))
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/treatments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          toothNumbers: formData.toothNumbers.length > 0 ? formData.toothNumbers.join(',') : null,
          cost: formData.cost ? parseFloat(formData.cost) : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('createFailed'))
      }

      const treatment = await response.json()
      router.push(`/treatments/${treatment.id}`)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/treatments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('patientInfo')}
            </CardTitle>
            <CardDescription>{t('patientInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedPatient ? (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedPatient.patientId} | {selectedPatient.phone}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedPatient(null)
                    setFormData({ ...formData, patientId: '' })
                  }}
                >
                  {t('change')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('searchPatients')}
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  {filteredPatients.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">{t('noPatients')}</div>
                  ) : (
                    filteredPatients.slice(0, 10).map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handlePatientSelect(patient.id)}
                        className="w-full flex items-center gap-4 p-3 hover:bg-muted/50 border-b last:border-b-0 text-left"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {patient.firstName} {patient.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {patient.patientId} | {patient.phone}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Doctor and Procedure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              {t('treatmentDetails')}
            </CardTitle>
            <CardDescription>{t('treatmentDetailsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="doctor">{t('doctor')}</Label>
                <Select
                  value={formData.doctorId}
                  onValueChange={(value) => setFormData({ ...formData, doctorId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectDoctor')} />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.specialization
                          ? t('doctorNameSpec', {
                              name: `${doctor.firstName} ${doctor.lastName}`,
                              spec: doctor.specialization,
                            })
                          : t('doctorName', {
                              name: `${doctor.firstName} ${doctor.lastName}`,
                            })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="procedure">{t('procedure')}</Label>
                <Select value={formData.procedureId} onValueChange={handleProcedureSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectProcedure')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupedProcedures).map(([category, procs]) => (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                          {tCategory.has(category)
                            ? tCategory(category)
                            : procedureCategoryConfig[category]?.label || category}
                        </div>
                        {procs.map((proc) => (
                          <SelectItem key={proc.id} value={proc.id}>
                            {t('procedureOption', {
                              code: proc.code,
                              name: proc.name,
                              price: fmt.formatCurrency(proc.basePrice),
                            })}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedProcedure && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="font-medium">{selectedProcedure.name}</div>
                {selectedProcedure.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedProcedure.description}
                  </p>
                )}
                <div className="flex gap-4 mt-2 text-sm">
                  <span>{t('duration', { minutes: selectedProcedure.defaultDuration })}</span>
                  <span>
                    {t('basePrice', { price: fmt.formatCurrency(selectedProcedure.basePrice) })}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="cost">{t('treatmentCost')}</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                placeholder={t('costPlaceholder')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dental Chart */}
        {selectedPatient && (
          <DentalChart
            patientId={selectedPatient.id}
            selectedTeeth={formData.toothNumbers}
            onTeethSelect={(teeth) => setFormData({ ...formData, toothNumbers: teeth })}
          />
        )}

        {/* Clinical Notes */}
        <Card>
          <CardHeader>
            <CardTitle>{t('clinicalNotes')}</CardTitle>
            <CardDescription>{t('clinicalNotesDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chiefComplaint">{t('chiefComplaint')}</Label>
              <Textarea
                id="chiefComplaint"
                value={formData.chiefComplaint}
                onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
                placeholder={t('chiefComplaintPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="diagnosis">{t('diagnosis')}</Label>
              <Textarea
                id="diagnosis"
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                placeholder={t('diagnosisPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="findings">{t('findings')}</Label>
              <Textarea
                id="findings"
                value={formData.findings}
                onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                placeholder={t('findingsPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="procedureNotes">{t('procedureNotes')}</Label>
                <VoiceInput
                  onTranscript={(text) =>
                    setFormData((prev) => ({
                      ...prev,
                      procedureNotes: prev.procedureNotes ? prev.procedureNotes + ' ' + text : text,
                    }))
                  }
                />
              </div>
              <Textarea
                id="procedureNotes"
                value={formData.procedureNotes}
                onChange={(e) => setFormData({ ...formData, procedureNotes: e.target.value })}
                placeholder={t('procedureNotesPlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="materialsUsed">{t('materialsUsed')}</Label>
              <Textarea
                id="materialsUsed"
                value={formData.materialsUsed}
                onChange={(e) => setFormData({ ...formData, materialsUsed: e.target.value })}
                placeholder={t('materialsUsedPlaceholder')}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Treatment Assistant */}
        {formData.patientId && formData.procedureId && (
          <TreatmentAssist
            patientId={formData.patientId}
            procedureId={formData.procedureId}
            procedureName={procedures.find((p) => p.id === formData.procedureId)?.name}
            diagnosis={formData.diagnosis}
            findings={formData.findings}
            procedureNotes={formData.procedureNotes}
          />
        )}

        {/* Follow-up */}
        <Card>
          <CardHeader>
            <CardTitle>{t('followUp')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="followUpRequired"
                checked={formData.followUpRequired}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, followUpRequired: checked as boolean })
                }
              />
              <Label htmlFor="followUpRequired">{t('followUpRequired')}</Label>
            </div>

            {formData.followUpRequired && (
              <div className="space-y-2">
                <Label htmlFor="followUpDate">{t('followUpDate')}</Label>
                <Input
                  id="followUpDate"
                  type="date"
                  value={formData.followUpDate}
                  onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link href="/treatments">
            <Button type="button" variant="outline">
              {t('cancel')}
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              t('creating')
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('createTreatment')}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
