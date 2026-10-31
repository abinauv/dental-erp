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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Search,
  User,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  GripVertical,
} from 'lucide-react'
import { procedureCategoryConfig } from '@/lib/treatment-utils'

interface Patient {
  id: string
  patientId: string
  firstName: string
  lastName: string
  phone: string
}

interface Procedure {
  id: string
  code: string
  name: string
  category: string
  defaultDuration: number
  basePrice: string | number
}

interface PlanItem {
  procedureId: string
  procedureName: string
  procedureCode: string
  category: string
  toothNumbers: string
  estimatedCost: number
  notes: string
}

export default function NewTreatmentPlanPage() {
  const router = useRouter()
  const t = useTranslations('treatments.planNew')
  const tCategory = useTranslations('treatments.category')
  const fmt = useClinicFormatters()
  const searchParams = useSearchParams()
  const preselectedPatientId = searchParams.get('patientId')

  const [patients, setPatients] = useState<Patient[]>([])
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [patientSearch, setPatientSearch] = useState('')

  // Form state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [startDate, setStartDate] = useState('')
  const [expectedEndDate, setExpectedEndDate] = useState('')
  const [items, setItems] = useState<PlanItem[]>([])

  // Add procedure modal state
  const [selectedProcedureId, setSelectedProcedureId] = useState('')
  const [itemToothNumbers, setItemToothNumbers] = useState('')
  const [itemNotes, setItemNotes] = useState('')
  const [itemCost, setItemCost] = useState('')

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [patientsRes, proceduresRes] = await Promise.all([
          fetch('/api/patients?limit=100'),
          fetch('/api/procedures?all=true&isActive=true'),
        ])

        if (patientsRes.ok) {
          const data = await patientsRes.json()
          setPatients(data.patients)
          if (preselectedPatientId) {
            const patient = data.patients.find((p: Patient) => p.id === preselectedPatientId)
            if (patient) setSelectedPatient(patient)
          }
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

  const filteredPatients = patients.filter((patient) => {
    const searchLower = patientSearch.toLowerCase()
    return (
      patient.firstName.toLowerCase().includes(searchLower) ||
      patient.lastName.toLowerCase().includes(searchLower) ||
      patient.phone.includes(patientSearch) ||
      patient.patientId.toLowerCase().includes(searchLower)
    )
  })

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

  const handleAddProcedure = () => {
    if (!selectedProcedureId) return

    const procedure = procedures.find((p) => p.id === selectedProcedureId)
    if (!procedure) return

    const newItem: PlanItem = {
      procedureId: procedure.id,
      procedureName: procedure.name,
      procedureCode: procedure.code,
      category: procedure.category,
      toothNumbers: itemToothNumbers,
      estimatedCost: itemCost ? parseFloat(itemCost) : Number(procedure.basePrice),
      notes: itemNotes,
    }

    setItems([...items, newItem])

    // Reset form
    setSelectedProcedureId('')
    setItemToothNumbers('')
    setItemNotes('')
    setItemCost('')
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const calculateTotalCost = () => {
    return items.reduce((sum, item) => sum + item.estimatedCost, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedPatient) {
      setError(t('selectPatientError'))
      return
    }

    if (!title) {
      setError(t('titleError'))
      return
    }

    if (items.length === 0) {
      setError(t('itemsError'))
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          title,
          notes,
          startDate: startDate || null,
          expectedEndDate: expectedEndDate || null,
          items: items.map((item, index) => ({
            procedureId: item.procedureId,
            toothNumbers: item.toothNumbers || null,
            priority: index + 1,
            estimatedCost: item.estimatedCost,
            notes: item.notes || null,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('createFailed'))
      }

      const plan = await response.json()
      router.push(`/treatments/plans/${plan.id}`)
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
        <Link href="/treatments/plans">
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
              {t('patient')}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                <Button type="button" variant="outline" onClick={() => setSelectedPatient(null)}>
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
                  {filteredPatients.slice(0, 10).map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatient(patient)}
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
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t('planDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t('planTitle')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">{t('startDate')}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedEndDate">{t('endDate')}</Label>
                <Input
                  id="expectedEndDate"
                  type="date"
                  value={expectedEndDate}
                  onChange={(e) => setExpectedEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Procedures */}
        <Card>
          <CardHeader>
            <CardTitle>{t('procedures')}</CardTitle>
            <CardDescription>{t('proceduresDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add Procedure Form */}
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('procedure')}</Label>
                  <Select value={selectedProcedureId} onValueChange={setSelectedProcedureId}>
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
                              {t('procedureOption', { code: proc.code, name: proc.name })}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('toothNumbers')}</Label>
                  <Input
                    value={itemToothNumbers}
                    onChange={(e) => setItemToothNumbers(e.target.value)}
                    placeholder={t('toothPlaceholder')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('estimatedCost')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                    placeholder={
                      selectedProcedureId
                        ? t('costDefault', {
                            price: fmt.formatCurrency(
                              procedures.find((p) => p.id === selectedProcedureId)?.basePrice || 0
                            ),
                          })
                        : t('costPlaceholder')
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('itemNotes')}</Label>
                  <Input
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder={t('itemNotesPlaceholder')}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddProcedure}
                disabled={!selectedProcedureId}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('addProcedure')}
              </Button>
            </div>

            {/* Procedures List */}
            {items.length > 0 && (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{t('colProcedure')}</TableHead>
                      <TableHead>{t('colTeeth')}</TableHead>
                      <TableHead>{t('colCost')}</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.procedureName}</div>
                          <div className="text-sm text-muted-foreground">{item.procedureCode}</div>
                          <Badge
                            variant="outline"
                            className={`mt-1 ${procedureCategoryConfig[item.category]?.bgColor} ${procedureCategoryConfig[item.category]?.color} border-0`}
                          >
                            {tCategory.has(item.category)
                              ? tCategory(item.category)
                              : procedureCategoryConfig[item.category]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.toothNumbers || '-'}</TableCell>
                        <TableCell>{fmt.formatCurrency(item.estimatedCost)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-medium">
                        {t('totalCost')}
                      </TableCell>
                      <TableCell className="font-bold text-lg">
                        {fmt.formatCurrency(calculateTotalCost())}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link href="/treatments/plans">
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
                {t('createPlan')}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
