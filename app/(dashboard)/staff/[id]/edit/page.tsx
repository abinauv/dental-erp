'use client'

import { useState, useEffect, use } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Eye, EyeOff, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const t = useTranslations('staff.edit')
  const tNew = useTranslations('staff.new')
  const tDays = useTranslations('staff.detail')
  const { currencySymbol } = useClinicFormatters()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [formData, setFormData] = useState({
    // Basic Info
    firstName: '',
    lastName: '',
    phone: '',
    alternatePhone: '',
    role: '',
    newPassword: '',

    // Personal Details
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    pincode: '',

    // Documents
    aadharNumber: '',
    panNumber: '',

    // Professional
    qualification: '',
    specialization: '',
    licenseNumber: '',

    // Financial
    salary: '',
    bankAccountNo: '',
    bankIfsc: '',

    // Emergency
    emergencyContact: '',
    emergencyPhone: '',

    // Status
    isActive: true,
  })

  const [shifts, setShifts] = useState<
    Array<{
      dayOfWeek: number
      startTime: string
      endTime: string
      isActive: boolean
    }>
  >([])

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

      setFormData({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        phone: data.phone || '',
        alternatePhone: data.alternatePhone || '',
        role: data.user.role || '',
        newPassword: '',
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : '',
        gender: data.gender || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        aadharNumber: data.aadharNumber || '',
        panNumber: data.panNumber || '',
        qualification: data.qualification || '',
        specialization: data.specialization || '',
        licenseNumber: data.licenseNumber || '',
        salary: data.salary ? data.salary.toString() : '',
        bankAccountNo: data.bankAccountNo || '',
        bankIfsc: data.bankIfsc || '',
        emergencyContact: data.emergencyContact || '',
        emergencyPhone: data.emergencyPhone || '',
        isActive: data.isActive,
      })

      // Initialize shifts for all 7 days
      const initialShifts = dayNames.map((_, index) => {
        const existingShift = data.shifts?.find((s: any) => s.dayOfWeek === index)
        return (
          existingShift || {
            dayOfWeek: index,
            startTime: '09:00',
            endTime: '18:00',
            isActive: false,
          }
        )
      })
      setShifts(initialShifts)
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

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleShiftChange = (dayOfWeek: number, field: string, value: string | boolean) => {
    setShifts((prev) =>
      prev.map((shift) => (shift.dayOfWeek === dayOfWeek ? { ...shift, [field]: value } : shift))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.firstName || !formData.lastName || !formData.phone) {
      toast({
        variant: 'destructive',
        title: t('validationError'),
        description: t('requiredFields'),
      })
      return
    }

    try {
      setSaving(true)

      // Update staff profile
      const response = await fetch(`/api/staff/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || t('updateFailed'))
      }

      // Update shifts
      const activeShifts = shifts.filter((s) => s.isActive)
      const shiftsResponse = await fetch(`/api/staff/${resolvedParams.id}/shifts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shifts: activeShifts }),
      })

      if (!shiftsResponse.ok) {
        console.error('Failed to update shifts')
      }

      toast({
        title: t('success'),
        description: t('updateSuccess'),
      })

      router.push(`/staff/${resolvedParams.id}`)
    } catch (error: any) {
      console.error('Error updating staff:', error)
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message || t('updateFailed'),
      })
    } finally {
      setSaving(false)
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/staff/${resolvedParams.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('basicInfo')}</CardTitle>
              <CardDescription>{t('basicInfoDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{tNew('firstName')}</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{tNew('lastName')}</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">{tNew('role')}</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleChange('role', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tNew('selectRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">{tNew('roleAdmin')}</SelectItem>
                    <SelectItem value="DOCTOR">{tNew('roleDoctor')}</SelectItem>
                    <SelectItem value="RECEPTIONIST">{tNew('roleReceptionist')}</SelectItem>
                    <SelectItem value="LAB_TECH">{tNew('roleLabTech')}</SelectItem>
                    <SelectItem value="ACCOUNTANT">{tNew('roleAccountant')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('newPassword')}</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={(e) => handleChange('newPassword', e.target.value)}
                    placeholder={t('newPasswordPlaceholder')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('accountStatus')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.isActive ? t('activeCanLogin') : t('inactiveCannotLogin')}
                  </p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleChange('isActive', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('contactInfo')}</CardTitle>
              <CardDescription>{t('contactInfoDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">{tNew('phone')}</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alternatePhone">{tNew('alternatePhone')}</Label>
                  <Input
                    id="alternatePhone"
                    value={formData.alternatePhone}
                    onChange={(e) => handleChange('alternatePhone', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{tNew('address')}</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">{tNew('city')}</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">{tNew('state')}</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">{tNew('pincode')}</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Details */}
          <Card>
            <CardHeader>
              <CardTitle>{t('personalDetails')}</CardTitle>
              <CardDescription>{t('personalDetailsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">{tNew('dateOfBirth')}</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">{tNew('gender')}</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => handleChange('gender', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tNew('selectGender')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">{tNew('genderMale')}</SelectItem>
                      <SelectItem value="FEMALE">{tNew('genderFemale')}</SelectItem>
                      <SelectItem value="OTHER">{tNew('genderOther')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="aadharNumber">{tNew('aadharNumber')}</Label>
                  <Input
                    id="aadharNumber"
                    value={formData.aadharNumber}
                    onChange={(e) => handleChange('aadharNumber', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="panNumber">{tNew('panNumber')}</Label>
                  <Input
                    id="panNumber"
                    value={formData.panNumber}
                    onChange={(e) => handleChange('panNumber', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContact">{t('emergencyContact')}</Label>
                  <Input
                    id="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={(e) => handleChange('emergencyContact', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">{t('emergencyPhone')}</Label>
                  <Input
                    id="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={(e) => handleChange('emergencyPhone', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Details */}
          <Card>
            <CardHeader>
              <CardTitle>{t('professionalDetails')}</CardTitle>
              <CardDescription>{t('professionalDetailsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="qualification">{tNew('qualification')}</Label>
                  <Input
                    id="qualification"
                    value={formData.qualification}
                    onChange={(e) => handleChange('qualification', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialization">{tNew('specialization')}</Label>
                  <Input
                    id="specialization"
                    value={formData.specialization}
                    onChange={(e) => handleChange('specialization', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="licenseNumber">{tNew('licenseNumber')}</Label>
                <Input
                  id="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={(e) => handleChange('licenseNumber', e.target.value)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="salary">
                  {tNew('monthlySalary', { currency: currencySymbol })}
                </Label>
                <Input
                  id="salary"
                  type="number"
                  value={formData.salary}
                  onChange={(e) => handleChange('salary', e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNo">{tNew('bankAccountNo')}</Label>
                  <Input
                    id="bankAccountNo"
                    value={formData.bankAccountNo}
                    onChange={(e) => handleChange('bankAccountNo', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankIfsc">{tNew('ifscCode')}</Label>
                  <Input
                    id="bankIfsc"
                    value={formData.bankIfsc}
                    onChange={(e) => handleChange('bankIfsc', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Schedule */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('workSchedule')}
              </CardTitle>
              <CardDescription>{t('workScheduleDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {shifts.map((shift, index) => (
                  <div
                    key={shift.dayOfWeek}
                    className={`p-4 rounded-lg border ${
                      shift.isActive ? 'border-primary bg-primary/5' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">{tDays(`days.${index}`)}</span>
                      <Switch
                        checked={shift.isActive}
                        onCheckedChange={(checked) =>
                          handleShiftChange(shift.dayOfWeek, 'isActive', checked)
                        }
                      />
                    </div>
                    {shift.isActive && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{t('start')}</Label>
                          <Input
                            type="time"
                            value={shift.startTime}
                            onChange={(e) =>
                              handleShiftChange(shift.dayOfWeek, 'startTime', e.target.value)
                            }
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t('end')}</Label>
                          <Input
                            type="time"
                            value={shift.endTime}
                            onChange={(e) =>
                              handleShiftChange(shift.dayOfWeek, 'endTime', e.target.value)
                            }
                            className="h-8"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href={`/staff/${resolvedParams.id}`}>
            <Button variant="outline" type="button">
              {t('cancel')}
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('saveChanges')}
          </Button>
        </div>
      </form>
    </div>
  )
}
