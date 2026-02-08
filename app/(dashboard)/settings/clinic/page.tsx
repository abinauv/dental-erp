'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Building2, Save, Upload, Trash2, Loader2, Copy } from 'lucide-react';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

type DaySchedule = { open: string; close: string; closed: boolean };
type WeekSchedule = Record<string, DaySchedule>;

const DEFAULT_SCHEDULE: WeekSchedule = {
  monday:    { open: '09:00', close: '20:00', closed: false },
  tuesday:   { open: '09:00', close: '20:00', closed: false },
  wednesday: { open: '09:00', close: '20:00', closed: false },
  thursday:  { open: '09:00', close: '20:00', closed: false },
  friday:    { open: '09:00', close: '20:00', closed: false },
  saturday:  { open: '09:00', close: '14:00', closed: false },
  sunday:    { open: '', close: '', closed: true },
};

function parseSchedule(raw: string | null | undefined): WeekSchedule {
  if (!raw) return { ...DEFAULT_SCHEDULE };
  try {
    const parsed = JSON.parse(raw);
    const schedule: WeekSchedule = {};
    for (const day of DAYS) {
      const d = parsed[day];
      if (d && d.open && d.close) {
        schedule[day] = { open: d.open, close: d.close, closed: false };
      } else {
        schedule[day] = { open: '', close: '', closed: true };
      }
    }
    return schedule;
  } catch {
    return { ...DEFAULT_SCHEDULE };
  }
}

function serializeSchedule(schedule: WeekSchedule): string {
  const obj: Record<string, { open: string | null; close: string | null }> = {};
  for (const day of DAYS) {
    const d = schedule[day];
    obj[day] = d.closed ? { open: null, close: null } : { open: d.open, close: d.close };
  }
  return JSON.stringify(obj);
}

export default function ClinicSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [schedule, setSchedule] = useState<WeekSchedule>({ ...DEFAULT_SCHEDULE });
  const [patientPortalEnabled, setPatientPortalEnabled] = useState(false);
  const [hospitalSlug, setHospitalSlug] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    phone: '',
    alternatePhone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    registrationNo: '',
    gstNumber: '',
    panNumber: '',
    workingHours: '',
    bankName: '',
    bankAccountNo: '',
    bankIfsc: '',
    upiId: '',
  });

  useEffect(() => {
    fetchClinicInfo();
  }, []);

  const fetchClinicInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/clinic');
      const result = await response.json();

      if (result.success && result.data) {
        setLogo(result.data.logo || null);
        setSchedule(parseSchedule(result.data.workingHours));
        setPatientPortalEnabled(result.data.patientPortalEnabled || false);
        setHospitalSlug(result.data.slug || '');
        setFormData({
          name: result.data.name || '',
          tagline: result.data.tagline || '',
          phone: result.data.phone || '',
          alternatePhone: result.data.alternatePhone || '',
          email: result.data.email || '',
          website: result.data.website || '',
          address: result.data.address || '',
          city: result.data.city || '',
          state: result.data.state || 'Tamil Nadu',
          pincode: result.data.pincode || '',
          registrationNo: result.data.registrationNo || '',
          gstNumber: result.data.gstNumber || '',
          panNumber: result.data.panNumber || '',
          workingHours: result.data.workingHours || '',
          bankName: result.data.bankName || '',
          bankAccountNo: result.data.bankAccountNo || '',
          bankIfsc: result.data.bankIfsc || '',
          upiId: result.data.upiId || '',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load clinic information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/settings/clinic/logo', { method: 'POST', body: fd });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Upload failed');

      setLogo(result.logo);
      toast({ title: 'Logo uploaded', description: 'Your clinic logo has been updated.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogoRemove = async () => {
    setUploadingLogo(true);
    try {
      const res = await fetch('/api/settings/clinic/logo', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove logo');

      setLogo(null);
      toast({ title: 'Logo removed' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setUploadingLogo(false);
    }
  };

  const updateDay = useCallback((day: string, field: keyof DaySchedule, value: string | boolean) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }, []);

  const copyToAll = useCallback((sourceDay: string) => {
    setSchedule(prev => {
      const source = prev[sourceDay];
      const next: WeekSchedule = {};
      for (const day of DAYS) {
        next[day] = { ...source };
      }
      return next;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...formData, workingHours: serializeSchedule(schedule), patientPortalEnabled };
      const response = await fetch('/api/settings/clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Clinic information saved successfully',
        });
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="w-8 h-8" />
          Clinic Information
        </h1>
        <p className="text-gray-600">Manage your clinic details and contact information</p>
      </div>

      <div className="space-y-6">
        {/* Clinic Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Clinic Logo</CardTitle>
            <CardDescription>Upload your clinic logo to display in the sidebar and invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Preview */}
              {logo ? (
                <img
                  src={logo}
                  alt="Clinic logo"
                  className="h-20 w-20 rounded-lg object-cover border"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-primary text-primary-foreground text-2xl font-bold border">
                  {formData.name?.charAt(0) || 'D'}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {logo ? 'Change Logo' : 'Upload Logo'}
                </Button>
                {logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploadingLogo}
                    onClick={handleLogoRemove}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, WebP, GIF or SVG. Max 2 MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Primary clinic details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="name">Clinic Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Dr. Dev's Dental Hospital"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="tagline">Tagline / Motto</Label>
                <Input
                  id="tagline"
                  value={formData.tagline}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  placeholder="Your Smile, Our Priority"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>How patients can reach you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Primary Phone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="044-12345678"
                  required
                />
              </div>

              <div>
                <Label htmlFor="alternatePhone">Alternate Phone</Label>
                <Input
                  id="alternatePhone"
                  value={formData.alternatePhone}
                  onChange={(e) => handleChange('alternatePhone', e.target.value)}
                  placeholder="9876543210"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="info@drdevdental.com"
                />
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://www.drdevdental.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>Clinic location details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="address">Street Address *</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="123, Main Street, Ayanavaram"
                rows={2}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Chennai"
                  required
                />
              </div>

              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => handleChange('pincode', e.target.value)}
                  placeholder="600023"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registration & Tax */}
        <Card>
          <CardHeader>
            <CardTitle>Registration & Tax Information</CardTitle>
            <CardDescription>Legal and tax registration details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="registrationNo">Registration Number</Label>
                <Input
                  id="registrationNo"
                  value={formData.registrationNo}
                  onChange={(e) => handleChange('registrationNo', e.target.value)}
                  placeholder="REG123456"
                />
              </div>

              <div>
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input
                  id="gstNumber"
                  value={formData.gstNumber}
                  onChange={(e) => handleChange('gstNumber', e.target.value)}
                  placeholder="29XXXXX1234X1ZX"
                />
              </div>

              <div>
                <Label htmlFor="panNumber">PAN Number</Label>
                <Input
                  id="panNumber"
                  value={formData.panNumber}
                  onChange={(e) => handleChange('panNumber', e.target.value)}
                  placeholder="ABCDE1234F"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Working Hours</CardTitle>
            <CardDescription>Clinic operating schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Header row */}
            <div className="hidden md:grid md:grid-cols-[140px_1fr_1fr_80px_40px] gap-3 items-center text-xs font-medium text-muted-foreground px-1">
              <span>Day</span>
              <span>Opens at</span>
              <span>Closes at</span>
              <span className="text-center">Open</span>
              <span />
            </div>
            <Separator />
            {DAYS.map((day) => {
              const d = schedule[day];
              return (
                <div
                  key={day}
                  className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_80px_40px] gap-3 items-center"
                >
                  <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                  <Input
                    type="time"
                    value={d.closed ? '' : d.open}
                    disabled={d.closed}
                    onChange={(e) => updateDay(day, 'open', e.target.value)}
                    className={d.closed ? 'opacity-40' : ''}
                  />
                  <Input
                    type="time"
                    value={d.closed ? '' : d.close}
                    disabled={d.closed}
                    onChange={(e) => updateDay(day, 'close', e.target.value)}
                    className={d.closed ? 'opacity-40' : ''}
                  />
                  <div className="flex justify-center">
                    <Switch
                      checked={!d.closed}
                      onCheckedChange={(checked) => updateDay(day, 'closed', !checked)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Copy to all days"
                    onClick={() => copyToAll(day)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle>Bank & Payment Details</CardTitle>
            <CardDescription>For invoicing and payment collection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                  placeholder="State Bank of India"
                />
              </div>

              <div>
                <Label htmlFor="bankAccountNo">Account Number</Label>
                <Input
                  id="bankAccountNo"
                  value={formData.bankAccountNo}
                  onChange={(e) => handleChange('bankAccountNo', e.target.value)}
                  placeholder="1234567890"
                />
              </div>

              <div>
                <Label htmlFor="bankIfsc">IFSC Code</Label>
                <Input
                  id="bankIfsc"
                  value={formData.bankIfsc}
                  onChange={(e) => handleChange('bankIfsc', e.target.value)}
                  placeholder="SBIN0001234"
                />
              </div>

              <div>
                <Label htmlFor="upiId">UPI ID</Label>
                <Input
                  id="upiId"
                  value={formData.upiId}
                  onChange={(e) => handleChange('upiId', e.target.value)}
                  placeholder="clinic@upi"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Portal */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Portal</CardTitle>
            <CardDescription>
              Allow patients to log in, view records, book appointments, and pay bills online
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Patient Portal</p>
                <p className="text-xs text-muted-foreground">
                  Patients can access the portal via OTP login
                </p>
              </div>
              <Switch
                checked={patientPortalEnabled}
                onCheckedChange={setPatientPortalEnabled}
              />
            </div>
            {patientPortalEnabled && hospitalSlug && (
              <div className="p-3 rounded-lg bg-gray-50 space-y-2">
                <p className="text-sm font-medium">Portal Login URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white p-2 rounded border break-all">
                    {typeof window !== 'undefined' ? window.location.origin : ''}/portal/login?clinic={hospitalSlug}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/portal/login?clinic=${hospitalSlug}`
                      );
                      toast({ title: 'Copied', description: 'Portal URL copied to clipboard' });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this URL with patients so they can log in with their registered phone number
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Clinic Information'}
          </Button>
        </div>
      </div>
    </div>
  );
}
