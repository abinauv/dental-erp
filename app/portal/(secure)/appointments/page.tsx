'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, CalendarPlus, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface Appointment {
  id: string
  appointmentNo: string
  scheduledDate: string
  scheduledTime: string
  duration: number
  appointmentType: string
  status: string
  chiefComplaint: string | null
  doctor: {
    firstName: string
    lastName: string
    specialization: string | null
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const statusColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-muted text-foreground',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-yellow-100 text-yellow-700',
  CHECKED_IN: 'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  RESCHEDULED: 'bg-orange-100 text-orange-700',
}

export default function PatientAppointments() {
  const t = useTranslations('portal.appointments')
  const tAptType = useTranslations('appointments.type')
  const tStatus = useTranslations('appointments.status')
  const { formatDate } = useClinicFormatters()
  const [filter, setFilter] = useState('upcoming')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchAppointments = async (page = 1) => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/patient-portal/appointments?filter=${filter}&page=${page}&limit=10`
      )
      const data = await res.json()
      setAppointments(data.appointments || [])
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments(1)
  }, [filter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/portal/book">
          <Button>
            <CalendarPlus className="h-4 w-4 mr-2" />
            {t('bookNew')}
          </Button>
        </Link>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="upcoming">{t('tabUpcoming')}</TabsTrigger>
          <TabsTrigger value="past">{t('tabPast')}</TabsTrigger>
          <TabsTrigger value="all">{t('tabAll')}</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>{t('noAppointments')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <Card key={apt.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {t('aptWhen', {
                              date: formatDate(apt.scheduledDate, { weekday: 'short' }),
                              time: apt.scheduledTime,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {apt.doctor.specialization
                              ? t('doctorWithSpec', {
                                  name: `${apt.doctor.firstName} ${apt.doctor.lastName}`,
                                  spec: apt.doctor.specialization,
                                })
                              : t('doctor', {
                                  name: `${apt.doctor.firstName} ${apt.doctor.lastName}`,
                                })}
                          </span>
                        </div>
                        {apt.chiefComplaint && (
                          <p className="text-sm text-muted-foreground">
                            {t('reason', { complaint: apt.chiefComplaint })}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {t('meta', {
                            no: apt.appointmentNo,
                            duration: apt.duration,
                            type: tAptType.has(apt.appointmentType)
                              ? tAptType(apt.appointmentType)
                              : apt.appointmentType.replace('_', ' '),
                          })}
                        </p>
                      </div>
                      <Badge className={statusColors[apt.status] || 'bg-muted text-foreground'}>
                        {tStatus.has(apt.status)
                          ? tStatus(apt.status)
                          : apt.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchAppointments(pagination.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {t('pageOf', { page: pagination.page, total: pagination.totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchAppointments(pagination.page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
