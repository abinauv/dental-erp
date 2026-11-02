'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Printer, Loader2, Trash2 } from 'lucide-react'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface PrescriptionDetail {
  id: string
  prescriptionNo: string
  diagnosis: string | null
  notes: string | null
  validUntil: string | null
  createdAt: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
    dateOfBirth: string | null
    gender: string | null
    address: string | null
    city: string | null
    allergies: string | null
  }
  doctor: { id: string; name: string; specialization: string | null; registrationNo: string | null }
  medications: {
    id: string
    medicationName: string
    dosage: string
    frequency: string
    duration: string
    route: string
    timing: string | null
    quantity: number | null
    instructions: string | null
  }[]
}

interface Hospital {
  name: string
  tagline: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  logo: string | null
  registrationNo: string | null
}

export default function PrescriptionDetailPage() {
  const t = useTranslations('prescriptions.detail')
  const tRoute = useTranslations('prescriptions.route')
  const tTiming = useTranslations('prescriptions.timing')
  const { formatDate } = useClinicFormatters()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const printRef = useRef<HTMLDivElement>(null)

  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null)
  const [hospital, setHospital] = useState<Hospital | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/prescriptions/${params.id}`)
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        setPrescription(result.data)
        setHospital(result.hospital)
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: t('errorTitle'),
          description: err.message || t('loadFailed'),
        })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [params.id])

  const handlePrint = () => {
    window.print()
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('deleteTitle'),
      description: t('deleteDesc'),
      confirmLabel: t('deleteConfirm'),
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/prescriptions/${params.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast({ title: t('deletedTitle') })
      router.push('/prescriptions')
    } catch {
      toast({ variant: 'destructive', title: t('errorTitle'), description: t('deleteFailed') })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!prescription) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <p className="text-center text-muted-foreground py-20">{t('notFound')}</p>
      </div>
    )
  }

  const patientAge = prescription.patient.dateOfBirth
    ? Math.floor(
        (Date.now() - new Date(prescription.patient.dateOfBirth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : null

  return (
    <>
      {/* Screen-only controls */}
      <div className="container mx-auto p-6 max-w-4xl print:hidden">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => router.push('/prescriptions')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {t('back')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> {t('delete')}
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> {t('print')}
            </Button>
          </div>
        </div>
      </div>

      {/* Printable prescription */}
      <div
        ref={printRef}
        className="container mx-auto px-6 pb-6 max-w-4xl print:max-w-full print:px-0 print:pb-0"
      >
        <Card className="print:shadow-none print:border-none">
          <CardContent className="p-8 print:p-6">
            {/* Header — Clinic Info */}
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-4">
                {hospital?.logo ? (
                  <img src={hospital.logo} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
                    {hospital?.name?.charAt(0) || 'D'}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold">{hospital?.name || t('defaultClinic')}</h1>
                  {hospital?.tagline && (
                    <p className="text-sm text-muted-foreground">{hospital.tagline}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {[hospital?.address, hospital?.city, hospital?.state, hospital?.pincode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[hospital?.phone && t('phPrefix', { phone: hospital.phone }), hospital?.email]
                      .filter(Boolean)
                      .join(' | ')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-base font-mono">
                  {prescription.prescriptionNo}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(prescription.createdAt, { month: 'long' })}
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4">
              <div>
                <span className="text-muted-foreground">{t('patientLabel')}</span>
                <span className="font-medium">
                  {prescription.patient.firstName} {prescription.patient.lastName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('idLabel')}</span>
                <span className="font-mono">{prescription.patient.patientId}</span>
              </div>
              {patientAge !== null && (
                <div>
                  <span className="text-muted-foreground">{t('ageGenderLabel')}</span>
                  <span>
                    {prescription.patient.gender
                      ? t('ageGender', { age: patientAge, gender: prescription.patient.gender })
                      : t('ageOnly', { age: patientAge })}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">{t('phoneLabel')}</span>
                <span>{prescription.patient.phone}</span>
              </div>
              {prescription.patient.allergies && (
                <div className="col-span-2 text-destructive font-medium">
                  {t('allergiesLabel', { allergies: prescription.patient.allergies })}
                </div>
              )}
            </div>

            {prescription.diagnosis && (
              <div className="mb-4 text-sm">
                <span className="text-muted-foreground">{t('diagnosisLabel')}</span>
                <span className="font-medium">{prescription.diagnosis}</span>
              </div>
            )}

            <Separator className="my-4" />

            {/* Rx Symbol */}
            <div className="text-3xl font-serif font-bold mb-4">&#8478;</div>

            {/* Medications Table */}
            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium w-8">{t('colNum')}</th>
                  <th className="pb-2 font-medium">{t('colMedication')}</th>
                  <th className="pb-2 font-medium">{t('colDosage')}</th>
                  <th className="pb-2 font-medium">{t('colFrequency')}</th>
                  <th className="pb-2 font-medium">{t('colDuration')}</th>
                  <th className="pb-2 font-medium hidden print:table-cell">{t('colQty')}</th>
                </tr>
              </thead>
              <tbody>
                {prescription.medications.map((med, i) => (
                  <tr key={med.id} className="border-b last:border-0">
                    <td className="py-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-3">
                      <div className="font-medium">{med.medicationName}</div>
                      <div className="text-xs text-muted-foreground">
                        {[
                          med.route !== 'Oral' &&
                            (tRoute.has(med.route) ? tRoute(med.route) : med.route),
                          med.timing &&
                            (tTiming.has(med.timing) ? tTiming(med.timing) : med.timing),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {med.instructions && (
                        <div className="text-xs italic text-muted-foreground mt-0.5">
                          {med.instructions}
                        </div>
                      )}
                    </td>
                    <td className="py-3">{med.dosage}</td>
                    <td className="py-3">{med.frequency}</td>
                    <td className="py-3">{med.duration}</td>
                    <td className="py-3 hidden print:table-cell">{med.quantity || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {prescription.notes && (
              <div className="mb-6 p-3 bg-muted/50 rounded text-sm">
                <span className="font-medium">{t('notesLabel')}</span>
                {prescription.notes}
              </div>
            )}

            {prescription.validUntil && (
              <p className="text-xs text-muted-foreground mb-6">
                {t('validUntil', { date: formatDate(prescription.validUntil, { month: 'long' }) })}
              </p>
            )}

            {/* Doctor signature */}
            <div className="flex justify-end mt-8">
              <div className="text-right">
                <div className="border-b border-foreground w-48 mb-1" />
                <p className="font-medium">{prescription.doctor.name}</p>
                {prescription.doctor.specialization && (
                  <p className="text-xs text-muted-foreground">
                    {prescription.doctor.specialization}
                  </p>
                )}
                {prescription.doctor.registrationNo && (
                  <p className="text-xs text-muted-foreground">
                    {t('regNo', { no: prescription.doctor.registrationNo })}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {ConfirmDialogComponent}
    </>
  )
}
