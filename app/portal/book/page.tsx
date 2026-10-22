'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CalendarPlus,
  User,
  Calendar,
  Clock,
  Loader2,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface Doctor {
  id: string
  firstName: string
  lastName: string
  specialization: string | null
}

interface Slot {
  time: string
  available: boolean
}

type Step = 1 | 2 | 3 | 4

export default function BookAppointment() {
  const t = useTranslations('portal.book')
  const { formatDate } = useClinicFormatters()
  const router = useRouter()

  const [step, setStep] = useState<Step>(1)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctorsLoading, setDoctorsLoading] = useState(true)

  // Form state
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')

  // Slots state
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Booking state
  const [booking, setBooking] = useState(false)
  const [bookingResult, setBookingResult] = useState<any>(null)
  const [error, setError] = useState('')

  // Fetch doctors on mount — uses portal API which provides hospitalId
  useEffect(() => {
    // We need to know the hospital slug. Get it from the portal context cookie
    // by calling the dashboard API which requires auth.
    fetch('/api/patient-portal/appointments?filter=upcoming&limit=0')
      .then(() => {
        // The slug comes from the portal layout context.
        // For booking, we use the patient portal appointment API directly.
      })
      .catch(() => {})

    // Fetch doctors via a helper that reads from the portal auth context
    fetchDoctors()
  }, [])

  const fetchDoctors = async () => {
    setDoctorsLoading(true)
    try {
      const res = await fetch('/api/patient-portal/doctors')
      if (res.ok) {
        const data = await res.json()
        setDoctors(data.doctors || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDoctorsLoading(false)
    }
  }

  const fetchSlots = useCallback(async () => {
    if (!selectedDoctor || !selectedDate) return
    setSlotsLoading(true)
    setSelectedTime('')
    try {
      const res = await fetch(
        `/api/patient-portal/slots?doctorId=${selectedDoctor}&date=${selectedDate}`
      )
      if (res.ok) {
        const data = await res.json()
        setSlots(data.slots || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSlotsLoading(false)
    }
  }, [selectedDoctor, selectedDate])

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchSlots()
    }
  }, [selectedDoctor, selectedDate, fetchSlots])

  const handleBook = async () => {
    setBooking(true)
    setError('')
    try {
      const res = await fetch('/api/patient-portal/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedDoctor,
          date: selectedDate,
          time: selectedTime,
          type: 'CONSULTATION',
          chiefComplaint: chiefComplaint || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('bookingFailed'))
        return
      }

      setBookingResult(data.appointment)
      setStep(4)
    } catch {
      setError(t('networkError'))
    } finally {
      setBooking(false)
    }
  }

  const selectedDoctorObj = doctors.find((d) => d.id === selectedDoctor)
  const availableSlots = slots.filter((s) => s.available)

  // Minimum date: today
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/portal/appointments')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={cn(
              'h-2 flex-1 rounded-full transition-colors',
              s <= step ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Step 1: Select Doctor */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" /> {t('step1Title')}
            </CardTitle>
            <CardDescription>{t('step1Desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {doctorsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : doctors.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t('noDoctors')}</p>
            ) : (
              <div className="space-y-2">
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    className={cn(
                      'p-3 rounded-lg border-2 cursor-pointer transition-colors',
                      selectedDoctor === doc.id
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                    )}
                    onClick={() => setSelectedDoctor(doc.id)}
                  >
                    <p className="font-medium">
                      {t('doctor', { name: `${doc.firstName} ${doc.lastName}` })}
                    </p>
                    {doc.specialization && (
                      <p className="text-sm text-muted-foreground">{doc.specialization}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button className="w-full mt-4" disabled={!selectedDoctor} onClick={() => setStep(2)}>
              {t('continue')} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Date & Time */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" /> {t('step2Title')}
            </CardTitle>
            <CardDescription>
              {selectedDoctorObj &&
                t('doctor', {
                  name: `${selectedDoctorObj.firstName} ${selectedDoctorObj.lastName}`,
                })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('fieldDate')}</Label>
              <Input
                type="date"
                min={today}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            {selectedDate && (
              <div className="space-y-2">
                <Label>{t('availableSlots')}</Label>
                {slotsLoading ? (
                  <Skeleton className="h-32" />
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">{t('noSlots')}</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <Button
                        key={slot.time}
                        variant={selectedTime === slot.time ? 'default' : 'outline'}
                        size="sm"
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={cn('text-xs', !slot.available && 'opacity-40 line-through')}
                      >
                        {slot.time}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> {t('back')}
              </Button>
              <Button className="flex-1" disabled={!selectedTime} onClick={() => setStep(3)}>
                {t('continue')} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5" /> {t('step3Title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('fieldDoctor')}</span>
                <span className="font-medium">
                  {t('doctor', {
                    name: `${selectedDoctorObj?.firstName ?? ''} ${selectedDoctorObj?.lastName ?? ''}`,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('fieldDate')}</span>
                <span className="font-medium">
                  {formatDate(selectedDate, { weekday: 'long', month: 'long' })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('fieldTime')}</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('reasonLabel')}</Label>
              <Textarea
                placeholder={t('reasonPlaceholder')}
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> {t('back')}
              </Button>
              <Button className="flex-1" onClick={handleBook} disabled={booking}>
                {booking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('confirmBooking')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Success */}
      {step === 4 && bookingResult && (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-green-700">{t('confirmedTitle')}</h2>
            <div className="p-4 rounded-lg bg-green-50 space-y-2 text-sm">
              <p>
                <strong>{t('fieldAppointment')}:</strong> {bookingResult.appointmentNo}
              </p>
              <p>
                <strong>{t('fieldDoctor')}:</strong>{' '}
                {bookingResult.doctor?.firstName
                  ? t('doctor', {
                      name: `${bookingResult.doctor.firstName} ${bookingResult.doctor.lastName}`,
                    })
                  : selectedDoctorObj
                    ? t('doctor', {
                        name: `${selectedDoctorObj.firstName} ${selectedDoctorObj.lastName}`,
                      })
                    : ''}
              </p>
              <p>
                <strong>{t('fieldDate')}:</strong>{' '}
                {formatDate(selectedDate, { weekday: 'long', month: 'long' })}
              </p>
              <p>
                <strong>{t('fieldTime')}:</strong> {selectedTime}
              </p>
            </div>
            <Button onClick={() => router.push('/portal/appointments')}>
              {t('viewMyAppointments')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
