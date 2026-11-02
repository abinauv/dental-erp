'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClipboardList, Plus, Trash2, Loader2, Search, ArrowLeft } from 'lucide-react'

interface Patient {
  id: string
  patientId: string
  firstName: string
  lastName: string
  phone: string
  dateOfBirth: string | null
  allergies: string | null
}

interface MedicationOption {
  id: string
  name: string
  genericName: string | null
  form: string | null
  strength: string | null
  defaultDosage: string | null
  defaultFrequency: string | null
  defaultDuration: string | null
}

interface MedicationRow {
  key: number
  medicationId: string | null
  medicationName: string
  dosage: string
  frequency: string
  duration: string
  route: string
  timing: string
  quantity: string
  instructions: string
}

const ROUTES = [
  'Oral',
  'Topical',
  'Sublingual',
  'Buccal',
  'IV',
  'IM',
  'Subcutaneous',
  'Inhalation',
  'Nasal',
  'Otic',
  'Ophthalmic',
  'Rectal',
  'Vaginal',
]
const TIMINGS = [
  'Before food',
  'After food',
  'With food',
  'Empty stomach',
  'At bedtime',
  'As needed',
  'Morning',
  'Evening',
  'Morning & Evening',
]

let rowKey = 0

export default function NewPrescriptionPage() {
  const t = useTranslations('prescriptions.new')
  const tRoute = useTranslations('prescriptions.route')
  const tTiming = useTranslations('prescriptions.timing')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [saving, setSaving] = useState(false)

  // Patient selection
  const [patientSearch, setPatientSearch] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [searchingPatients, setSearchingPatients] = useState(false)

  // Medication search
  const [medSearch, setMedSearch] = useState('')
  const [medOptions, setMedOptions] = useState<MedicationOption[]>([])
  const [searchingMeds, setSearchingMeds] = useState(false)
  const [activeMedRow, setActiveMedRow] = useState<number | null>(null)

  // Form data
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [medications, setMedications] = useState<MedicationRow[]>([
    {
      key: ++rowKey,
      medicationId: null,
      medicationName: '',
      dosage: '',
      frequency: '',
      duration: '',
      route: 'Oral',
      timing: '',
      quantity: '',
      instructions: '',
    },
  ])

  // Pre-fill patient from query param
  useEffect(() => {
    const pid = searchParams.get('patientId')
    if (pid) {
      fetch(`/api/patients/${pid}`)
        .then((r) => r.json())
        .then((result) => {
          if (result.success || result.data || result.id) {
            const p = result.data || result
            setSelectedPatient(p)
          }
        })
        .catch(() => {})
    }
  }, [searchParams])

  // Patient search
  useEffect(() => {
    if (patientSearch.length < 2) {
      setPatients([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingPatients(true)
      try {
        const res = await fetch(
          `/api/patients?search=${encodeURIComponent(patientSearch)}&limit=10`
        )
        const result = await res.json()
        setPatients(result.data || result.patients || [])
      } catch {
        /* ignore */
      }
      setSearchingPatients(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [patientSearch])

  // Medication search
  useEffect(() => {
    if (medSearch.length < 2) {
      setMedOptions([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingMeds(true)
      try {
        const res = await fetch(
          `/api/medications?search=${encodeURIComponent(medSearch)}&limit=10&active=true`
        )
        const result = await res.json()
        setMedOptions(result.data || [])
      } catch {
        /* ignore */
      }
      setSearchingMeds(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [medSearch])

  const selectMedication = (med: MedicationOption, rowIndex: number) => {
    setMedications((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              medicationId: med.id,
              medicationName: `${med.name}${med.strength ? ` ${med.strength}` : ''}${med.form ? ` (${med.form})` : ''}`,
              dosage: r.dosage || med.defaultDosage || '',
              frequency: r.frequency || med.defaultFrequency || '',
              duration: r.duration || med.defaultDuration || '',
            }
          : r
      )
    )
    setMedSearch('')
    setMedOptions([])
    setActiveMedRow(null)
  }

  const updateMedRow = (index: number, field: keyof MedicationRow, value: string) => {
    setMedications((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  const addMedRow = () => {
    setMedications((prev) => [
      ...prev,
      {
        key: ++rowKey,
        medicationId: null,
        medicationName: '',
        dosage: '',
        frequency: '',
        duration: '',
        route: 'Oral',
        timing: '',
        quantity: '',
        instructions: '',
      },
    ])
  }

  const removeMedRow = (index: number) => {
    if (medications.length <= 1) return
    setMedications((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!selectedPatient) {
      toast({ variant: 'destructive', title: t('errorTitle'), description: t('selectPatient') })
      return
    }

    const validMeds = medications.filter(
      (m) => m.medicationName && m.dosage && m.frequency && m.duration
    )
    if (validMeds.length === 0) {
      toast({
        variant: 'destructive',
        title: t('errorTitle'),
        description: t('addMedError'),
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          diagnosis,
          notes,
          validUntil: validUntil || null,
          medications: validMeds.map((m) => ({
            medicationId: m.medicationId,
            medicationName: m.medicationName,
            dosage: m.dosage,
            frequency: m.frequency,
            duration: m.duration,
            route: m.route,
            timing: m.timing || null,
            quantity: m.quantity ? parseInt(m.quantity) : null,
            instructions: m.instructions || null,
          })),
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      toast({
        title: t('createdTitle'),
        description: t('createdDesc', { no: result.data.prescriptionNo }),
      })
      router.push(`/prescriptions/${result.data.id}`)
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('errorTitle'), description: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button variant="ghost" className="mb-4" onClick={() => router.push('/prescriptions')}>
        <ArrowLeft className="h-4 w-4 mr-2" /> {t('back')}
      </Button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardList className="h-8 w-8" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="space-y-6">
        {/* Patient Selection */}
        <Card>
          <CardHeader>
            <CardTitle>{t('patient')}</CardTitle>
            <CardDescription>{t('patientDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPatient.patientId} · {selectedPatient.phone}
                    {selectedPatient.allergies && (
                      <span className="text-destructive ml-2">
                        {t('allergiesLabel', { allergies: selectedPatient.allergies })}
                      </span>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedPatient(null)}>
                  {t('change')}
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('patientSearchPlaceholder')}
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="pl-9"
                />
                {(patients.length > 0 || searchingPatients) && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                    {searchingPatients ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {t('searching')}
                      </div>
                    ) : (
                      patients.map((p) => (
                        <button
                          key={p.id}
                          className="w-full px-3 py-2 text-left hover:bg-accent text-sm"
                          onClick={() => {
                            setSelectedPatient(p)
                            setPatientSearch('')
                            setPatients([])
                          }}
                        >
                          <span className="font-medium">
                            {p.firstName} {p.lastName}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            {p.patientId} · {p.phone}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diagnosis */}
        <Card>
          <CardHeader>
            <CardTitle>{t('diagnosis')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t('diagnosisLabel')}</Label>
              <Input
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder={t('diagnosisPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('validUntil')}</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medications */}
        <Card>
          <CardHeader>
            <CardTitle>{t('medications')}</CardTitle>
            <CardDescription>{t('medicationsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {medications.map((med, index) => (
              <div key={med.key} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('medicationN', { n: index + 1 })}
                  </span>
                  {medications.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeMedRow(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Medication name with search */}
                <div className="relative">
                  <Label>{t('medNameLabel')}</Label>
                  <Input
                    value={activeMedRow === index ? medSearch : med.medicationName}
                    onChange={(e) => {
                      if (activeMedRow !== index) setActiveMedRow(index)
                      setMedSearch(e.target.value)
                      updateMedRow(index, 'medicationName', e.target.value)
                      updateMedRow(index, 'medicationId', '')
                    }}
                    onFocus={() => setActiveMedRow(index)}
                    placeholder={t('medNamePlaceholder')}
                  />
                  {activeMedRow === index && medOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {medOptions.map((m) => (
                        <button
                          key={m.id}
                          className="w-full px-3 py-2 text-left hover:bg-accent text-sm"
                          onClick={() => selectMedication(m, index)}
                        >
                          <span className="font-medium">{m.name}</span>
                          {m.strength && (
                            <span className="text-muted-foreground ml-1">{m.strength}</span>
                          )}
                          {m.form && <span className="text-muted-foreground ml-1">({m.form})</span>}
                          {m.genericName && (
                            <span className="text-muted-foreground ml-2">— {m.genericName}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label>{t('dosageLabel')}</Label>
                    <Input
                      value={med.dosage}
                      onChange={(e) => updateMedRow(index, 'dosage', e.target.value)}
                      placeholder={t('dosagePlaceholder')}
                    />
                  </div>
                  <div>
                    <Label>{t('frequencyLabel')}</Label>
                    <Input
                      value={med.frequency}
                      onChange={(e) => updateMedRow(index, 'frequency', e.target.value)}
                      placeholder={t('frequencyPlaceholder')}
                    />
                  </div>
                  <div>
                    <Label>{t('durationLabel')}</Label>
                    <Input
                      value={med.duration}
                      onChange={(e) => updateMedRow(index, 'duration', e.target.value)}
                      placeholder={t('durationPlaceholder')}
                    />
                  </div>
                  <div>
                    <Label>{t('routeLabel')}</Label>
                    <Select
                      value={med.route}
                      onValueChange={(v) => updateMedRow(index, 'route', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROUTES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {tRoute.has(r) ? tRoute(r) : r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('timingLabel')}</Label>
                    <Select
                      value={med.timing || undefined}
                      onValueChange={(v) => updateMedRow(index, 'timing', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('timingPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMINGS.map((tm) => (
                          <SelectItem key={tm} value={tm}>
                            {tTiming.has(tm) ? tTiming(tm) : tm}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('quantityLabel')}</Label>
                    <Input
                      type="number"
                      value={med.quantity}
                      onChange={(e) => updateMedRow(index, 'quantity', e.target.value)}
                      placeholder={t('quantityPlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <Label>{t('instructionsLabel')}</Label>
                  <Input
                    value={med.instructions}
                    onChange={(e) => updateMedRow(index, 'instructions', e.target.value)}
                    placeholder={t('instructionsPlaceholder')}
                  />
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addMedRow} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {t('addAnother')}
            </Button>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>{t('additionalNotes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.push('/prescriptions')}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving} size="lg">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('createPrescription')}
          </Button>
        </div>
      </div>
    </div>
  )
}
