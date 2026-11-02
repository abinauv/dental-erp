'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
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
import { ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react'
import { RegionField } from '@/components/geo/region-field'
import { getLocaleDefaults } from '@/lib/i18n/config'
import { useToast } from '@/hooks/use-toast'

export default function NewStaffPage() {
  const router = useRouter()
  const t = useTranslations('staff.new')
  const { currencySymbol } = useClinicFormatters()
  const clinicCountry = getLocaleDefaults(useLocale()).country
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [formData, setFormData] = useState({
    // Basic Info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    alternatePhone: '',
    role: '',
    password: '',

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
    joiningDate: new Date().toISOString().split('T')[0],

    // Financial
    salary: '',
    bankAccountNo: '',
    bankIfsc: '',

    // Emergency
    emergencyContact: '',
    emergencyPhone: '',
  })

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.phone ||
      !formData.role ||
      !formData.password
    ) {
      toast({
        variant: 'destructive',
        title: t('validationError'),
        description: t('requiredFields'),
      })
      return
    }

    if (formData.password.length < 6) {
      toast({
        variant: 'destructive',
        title: t('validationError'),
        description: t('passwordLength'),
      })
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || t('createFailed'))
      }

      const staff = await response.json()

      toast({
        title: t('success'),
        description: t('createdDesc', { name: `${staff.firstName} ${staff.lastName}` }),
      })

      router.push('/staff')
    } catch (error: any) {
      console.error('Error creating staff:', error)
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message || t('createFailed'),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/staff">
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
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('accountInfo')}</CardTitle>
              <CardDescription>{t('accountInfoDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t('firstName')}</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    placeholder={t('firstNamePlaceholder')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t('lastName')}</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    placeholder={t('lastNamePlaceholder')}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    required
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

              <div className="space-y-2">
                <Label htmlFor="role">{t('role')}</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleChange('role', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">{t('roleAdmin')}</SelectItem>
                    <SelectItem value="DOCTOR">{t('roleDoctor')}</SelectItem>
                    <SelectItem value="RECEPTIONIST">{t('roleReceptionist')}</SelectItem>
                    <SelectItem value="LAB_TECH">{t('roleLabTech')}</SelectItem>
                    <SelectItem value="ACCOUNTANT">{t('roleAccountant')}</SelectItem>
                  </SelectContent>
                </Select>
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
                  <Label htmlFor="phone">{t('phone')}</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder={t('phonePlaceholder')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alternatePhone">{t('alternatePhone')}</Label>
                  <Input
                    id="alternatePhone"
                    value={formData.alternatePhone}
                    onChange={(e) => handleChange('alternatePhone', e.target.value)}
                    placeholder={t('phonePlaceholder')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t('address')}</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder={t('addressPlaceholder')}
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">{t('city')}</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder={t('cityPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">{t('state')}</Label>
                  <RegionField
                    id="state"
                    country={clinicCountry}
                    value={formData.state}
                    onChange={(v) => handleChange('state', v)}
                    placeholder={t('statePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">{t('pincode')}</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                    placeholder={t('pincodePlaceholder')}
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
                  <Label htmlFor="dateOfBirth">{t('dateOfBirth')}</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">{t('gender')}</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => handleChange('gender', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectGender')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">{t('genderMale')}</SelectItem>
                      <SelectItem value="FEMALE">{t('genderFemale')}</SelectItem>
                      <SelectItem value="OTHER">{t('genderOther')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="aadharNumber">{t('aadharNumber')}</Label>
                  <Input
                    id="aadharNumber"
                    value={formData.aadharNumber}
                    onChange={(e) => handleChange('aadharNumber', e.target.value)}
                    placeholder={t('aadharPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="panNumber">{t('panNumber')}</Label>
                  <Input
                    id="panNumber"
                    value={formData.panNumber}
                    onChange={(e) => handleChange('panNumber', e.target.value)}
                    placeholder={t('panPlaceholder')}
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
                  <Label htmlFor="qualification">{t('qualification')}</Label>
                  <Input
                    id="qualification"
                    value={formData.qualification}
                    onChange={(e) => handleChange('qualification', e.target.value)}
                    placeholder={t('qualificationPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialization">{t('specialization')}</Label>
                  <Input
                    id="specialization"
                    value={formData.specialization}
                    onChange={(e) => handleChange('specialization', e.target.value)}
                    placeholder={t('specializationPlaceholder')}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">{t('licenseNumber')}</Label>
                  <Input
                    id="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={(e) => handleChange('licenseNumber', e.target.value)}
                    placeholder={t('licensePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="joiningDate">{t('joiningDate')}</Label>
                  <Input
                    id="joiningDate"
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => handleChange('joiningDate', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Details */}
          <Card>
            <CardHeader>
              <CardTitle>{t('financialDetails')}</CardTitle>
              <CardDescription>{t('financialDetailsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="salary">{t('monthlySalary', { currency: currencySymbol })}</Label>
                <Input
                  id="salary"
                  type="number"
                  value={formData.salary}
                  onChange={(e) => handleChange('salary', e.target.value)}
                  placeholder={t('salaryPlaceholder')}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNo">{t('bankAccountNo')}</Label>
                  <Input
                    id="bankAccountNo"
                    value={formData.bankAccountNo}
                    onChange={(e) => handleChange('bankAccountNo', e.target.value)}
                    placeholder={t('bankAccountPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankIfsc">{t('ifscCode')}</Label>
                  <Input
                    id="bankIfsc"
                    value={formData.bankIfsc}
                    onChange={(e) => handleChange('bankIfsc', e.target.value)}
                    placeholder={t('ifscPlaceholder')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardHeader>
              <CardTitle>{t('emergencyContact')}</CardTitle>
              <CardDescription>{t('emergencyContactDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">{t('contactName')}</Label>
                <Input
                  id="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={(e) => handleChange('emergencyContact', e.target.value)}
                  placeholder={t('contactNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyPhone">{t('contactPhone')}</Label>
                <Input
                  id="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={(e) => handleChange('emergencyPhone', e.target.value)}
                  placeholder={t('phonePlaceholder')}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href="/staff">
            <Button variant="outline" type="button">
              {t('cancel')}
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('createStaff')}
          </Button>
        </div>
      </form>
    </div>
  )
}
