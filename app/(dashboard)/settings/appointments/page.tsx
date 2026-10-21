'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Calendar, Clock, Plus, Trash2, Save } from 'lucide-react'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

export default function AppointmentSettingsPage() {
  const t = useTranslations('settings.appointments')
  const fmt = useClinicFormatters()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [holidays, setHolidays] = useState<any[]>([])
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '' })

  const [settings, setSettings] = useState({
    slotDuration: '30',
    bufferTime: '10',
    startTime: '09:00',
    endTime: '20:00',
    lunchBreakStart: '13:00',
    lunchBreakEnd: '14:00',
    maxAdvanceBookingDays: '30',
    reminderHoursBefore: '24',
  })

  useEffect(() => {
    fetchSettings()
    fetchHolidays()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings?category=appointments')
      const result = await response.json()

      if (result.success && result.data) {
        const settingsMap: any = {}
        result.data.forEach((s: any) => {
          const key = s.key.replace('appointments.', '')
          settingsMap[key] = s.value
        })

        setSettings((prev) => ({ ...prev, ...settingsMap }))
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  const fetchHolidays = async () => {
    try {
      const currentYear = new Date().getFullYear()
      const response = await fetch(`/api/settings/holidays?year=${currentYear}`)
      const result = await response.json()

      if (result.success) {
        setHolidays(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const settingsArray = Object.entries(settings).map(([key, value]) => ({
        key: `appointments.${key}`,
        value: value.toString(),
        category: 'appointments',
      }))

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsArray }),
      })

      if (response.ok) {
        toast({
          title: t('success'),
          description: t('savedSuccess'),
        })
      } else {
        throw new Error(t('saveFailed'))
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) {
      toast({
        title: t('error'),
        description: t('holidayFieldsError'),
        variant: 'destructive',
      })
      return
    }

    try {
      const response = await fetch('/api/settings/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newHoliday.name,
          date: new Date(newHoliday.date).toISOString(),
        }),
      })

      if (response.ok) {
        toast({
          title: t('success'),
          description: t('holidayAdded'),
        })
        setNewHoliday({ name: '', date: '' })
        fetchHolidays()
      } else {
        throw new Error(t('addHolidayFailed'))
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleDeleteHoliday = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/holidays?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: t('success'),
          description: t('holidayDeleted'),
        })
        fetchHolidays()
      } else {
        throw new Error(t('deleteHolidayFailed'))
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="w-8 h-8" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="space-y-6">
        {/* Slot Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>{t('slotConfig')}</CardTitle>
            <CardDescription>{t('slotConfigDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="slotDuration">{t('slotDuration')}</Label>
                <Input
                  id="slotDuration"
                  type="number"
                  value={settings.slotDuration}
                  onChange={(e) => setSettings({ ...settings, slotDuration: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="bufferTime">{t('bufferTime')}</Label>
                <Input
                  id="bufferTime"
                  type="number"
                  value={settings.bufferTime}
                  onChange={(e) => setSettings({ ...settings, bufferTime: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card>
          <CardHeader>
            <CardTitle>{t('workingHours')}</CardTitle>
            <CardDescription>{t('workingHoursDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">{t('startTime')}</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={settings.startTime}
                  onChange={(e) => setSettings({ ...settings, startTime: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="endTime">{t('endTime')}</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={settings.endTime}
                  onChange={(e) => setSettings({ ...settings, endTime: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="lunchBreakStart">{t('lunchStart')}</Label>
                <Input
                  id="lunchBreakStart"
                  type="time"
                  value={settings.lunchBreakStart}
                  onChange={(e) => setSettings({ ...settings, lunchBreakStart: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="lunchBreakEnd">{t('lunchEnd')}</Label>
                <Input
                  id="lunchBreakEnd"
                  type="time"
                  value={settings.lunchBreakEnd}
                  onChange={(e) => setSettings({ ...settings, lunchBreakEnd: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('bookingSettings')}</CardTitle>
            <CardDescription>{t('bookingSettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxAdvanceBookingDays">{t('maxAdvance')}</Label>
                <Input
                  id="maxAdvanceBookingDays"
                  type="number"
                  value={settings.maxAdvanceBookingDays}
                  onChange={(e) =>
                    setSettings({ ...settings, maxAdvanceBookingDays: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">{t('maxAdvanceHint')}</p>
              </div>

              <div>
                <Label htmlFor="reminderHoursBefore">{t('reminderTime')}</Label>
                <Input
                  id="reminderHoursBefore"
                  type="number"
                  value={settings.reminderHoursBefore}
                  onChange={(e) =>
                    setSettings({ ...settings, reminderHoursBefore: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">{t('reminderTimeHint')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Holidays */}
        <Card>
          <CardHeader>
            <CardTitle>{t('holidayCalendar')}</CardTitle>
            <CardDescription>{t('holidayCalendarDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Holiday Form */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-semibold mb-3">{t('addNewHoliday')}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <Input
                    placeholder={t('holidayNamePlaceholder')}
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  />
                </div>
                <div>
                  <Button onClick={handleAddHoliday} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('addHoliday')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Holidays List */}
            <div className="space-y-2">
              <h4 className="font-semibold">{t('upcomingHolidays')}</h4>
              {holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noHolidays')}</p>
              ) : (
                <div className="space-y-2">
                  {holidays.map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{holiday.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {fmt.formatDate(holiday.date)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteHoliday(holiday.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {saving ? t('saving') : t('saveAppointmentSettings')}
          </Button>
        </div>
      </div>
    </div>
  )
}
