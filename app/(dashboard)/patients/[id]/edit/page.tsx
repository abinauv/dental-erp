'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
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
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

const BLOOD_GROUPS = [
  { value: 'A_POSITIVE', label: 'A+' },
  { value: 'A_NEGATIVE', label: 'A-' },
  { value: 'B_POSITIVE', label: 'B+' },
  { value: 'B_NEGATIVE', label: 'B-' },
  { value: 'AB_POSITIVE', label: 'AB+' },
  { value: 'AB_NEGATIVE', label: 'AB-' },
  { value: 'O_POSITIVE', label: 'O+' },
  { value: 'O_NEGATIVE', label: 'O-' },
]

export default function EditPatientPage() {
  const router = useRouter()
  const params = useParams()
  const patientId = params.id as string
  const { toast } = useToast()
  const t = useTranslations('patients.new')
  const tEdit = useTranslations('patients.edit')
  const tGender = useTranslations('patients.gender')
  const tCommon = useTranslations('common')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    age: '',
    gender: '',
    bloodGroup: '',
    phone: '',
    alternatePhone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    aadharNumber: '',
    occupation: '',
    referredBy: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  })

  useEffect(() => {
    async function loadPatient() {
      try {
        const res = await fetch(`/api/patients/${patientId}`)
        if (!res.ok) throw new Error(tEdit('loadError'))
        const data = await res.json()
        const p = data.patient || data

        setForm({
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split('T')[0] : '',
          age: p.age != null ? String(p.age) : '',
          gender: p.gender || '',
          bloodGroup: p.bloodGroup || '',
          phone: p.phone || '',
          alternatePhone: p.alternatePhone || '',
          email: p.email || '',
          address: p.address || '',
          city: p.city || '',
          state: p.state || '',
          pincode: p.pincode || '',
          aadharNumber: p.aadharNumber || '',
          occupation: p.occupation || '',
          referredBy: p.referredBy || '',
          emergencyContactName: p.emergencyContactName || '',
          emergencyContactPhone: p.emergencyContactPhone || '',
          emergencyContactRelation: p.emergencyContactRelation || '',
        })
      } catch {
        toast({
          variant: 'destructive',
          title: t('errorTitle'),
          description: tEdit('loadError'),
        })
      } finally {
        setLoading(false)
      }
    }
    loadPatient()
  }, [patientId, toast])

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.firstName || !form.lastName || !form.phone) {
      toast({
        variant: 'destructive',
        title: t('validationError'),
        description: t('requiredFields'),
      })
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
      }

      if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth
      if (form.age) payload.age = parseInt(form.age)
      if (form.gender) payload.gender = form.gender
      if (form.bloodGroup) payload.bloodGroup = form.bloodGroup
      if (form.alternatePhone) payload.alternatePhone = form.alternatePhone
      if (form.email) payload.email = form.email
      if (form.address) payload.address = form.address
      if (form.city) payload.city = form.city
      if (form.state) payload.state = form.state
      if (form.pincode) payload.pincode = form.pincode
      if (form.occupation) payload.occupation = form.occupation
      if (form.emergencyContactName) payload.emergencyContactName = form.emergencyContactName
      if (form.emergencyContactPhone) payload.emergencyContactPhone = form.emergencyContactPhone
      if (form.emergencyContactRelation)
        payload.emergencyContactRelation = form.emergencyContactRelation

      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: t('unknownError') }))
        throw new Error(data.error || tEdit('updateErrorStatus', { status: response.status }))
      }

      toast({
        title: tEdit('updated'),
        description: tEdit('updatedDesc', { name: `${form.firstName} ${form.lastName}` }),
      })

      router.push(`/patients/${patientId}`)
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('errorTitle'),
        description: error.message || tEdit('updateError'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/patients/${patientId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{tEdit('title')}</h1>
          <p className="text-muted-foreground">{tEdit('subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('personalInfo')}</CardTitle>
            <CardDescription>{t('personalInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('firstName')}</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                placeholder={t('firstNamePlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t('lastName')}</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                placeholder={t('lastNamePlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">{t('dateOfBirth')}</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => updateField('dateOfBirth', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">{t('age')}</Label>
              <Input
                id="age"
                type="number"
                value={form.age}
                onChange={(e) => updateField('age', e.target.value)}
                placeholder={t('agePlaceholder')}
                min="0"
                max="150"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">{t('gender')}</Label>
              <Select value={form.gender} onValueChange={(v) => updateField('gender', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectGender')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">{tGender('MALE')}</SelectItem>
                  <SelectItem value="FEMALE">{tGender('FEMALE')}</SelectItem>
                  <SelectItem value="OTHER">{tGender('OTHER')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">{t('bloodGroup')}</Label>
              <Select value={form.bloodGroup} onValueChange={(v) => updateField('bloodGroup', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectBloodGroup')} />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map((bg) => (
                    <SelectItem key={bg.value} value={bg.value}>
                      {bg.label}
                    </SelectItem>
                  ))}
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
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder={t('phonePlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alternatePhone">{t('alternatePhone')}</Label>
              <Input
                id="alternatePhone"
                value={form.alternatePhone}
                onChange={(e) => updateField('alternatePhone', e.target.value)}
                placeholder={t('alternatePhonePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder={t('emailPlaceholder')}
              />
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label htmlFor="address">{t('address')}</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder={t('addressPlaceholder')}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t('city')}</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder={t('cityPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">{t('state')}</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => updateField('state', e.target.value)}
                placeholder={t('statePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode">{t('pincode')}</Label>
              <Input
                id="pincode"
                value={form.pincode}
                onChange={(e) => updateField('pincode', e.target.value)}
                placeholder={t('pincodePlaceholder')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Additional Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t('additionalDetails')}</CardTitle>
            <CardDescription>{t('additionalDetailsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aadharNumber">{t('aadharNumber')}</Label>
              <Input
                id="aadharNumber"
                value={form.aadharNumber}
                onChange={(e) => updateField('aadharNumber', e.target.value)}
                placeholder={t('aadharPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="occupation">{t('occupation')}</Label>
              <Input
                id="occupation"
                value={form.occupation}
                onChange={(e) => updateField('occupation', e.target.value)}
                placeholder={t('occupationPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referredBy">{t('referredBy')}</Label>
              <Input
                id="referredBy"
                value={form.referredBy}
                onChange={(e) => updateField('referredBy', e.target.value)}
                placeholder={t('referredByPlaceholder')}
                disabled
              />
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle>{t('emergencyContact')}</CardTitle>
            <CardDescription>{t('emergencyContactDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyContactName">{t('contactName')}</Label>
              <Input
                id="emergencyContactName"
                value={form.emergencyContactName}
                onChange={(e) => updateField('emergencyContactName', e.target.value)}
                placeholder={t('contactNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContactPhone">{t('contactPhone')}</Label>
              <Input
                id="emergencyContactPhone"
                value={form.emergencyContactPhone}
                onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
                placeholder={t('contactPhonePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContactRelation">{t('relation')}</Label>
              <Input
                id="emergencyContactRelation"
                value={form.emergencyContactRelation}
                onChange={(e) => updateField('emergencyContactRelation', e.target.value)}
                placeholder={t('relationPlaceholder')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href={`/patients/${patientId}`}>
            <Button type="button" variant="outline">
              {tCommon('actions.cancel')}
            </Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tEdit('saving')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {tEdit('saveChanges')}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
