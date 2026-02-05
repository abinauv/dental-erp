'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Building2, Save } from 'lucide-react';

export default function ClinicSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    workingHours: 'Mon-Sat: 9:00 AM - 8:00 PM\nSun: 9:00 AM - 2:00 PM',
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
          workingHours: result.data.workingHours || 'Mon-Sat: 9:00 AM - 8:00 PM\nSun: 9:00 AM - 2:00 PM',
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
          <CardContent>
            <Label htmlFor="workingHours">Working Hours</Label>
            <Textarea
              id="workingHours"
              value={formData.workingHours}
              onChange={(e) => handleChange('workingHours', e.target.value)}
              placeholder="Mon-Sat: 9:00 AM - 8:00 PM&#10;Sun: 9:00 AM - 2:00 PM"
              rows={4}
            />
            <p className="text-sm text-gray-500 mt-1">
              Enter working hours for each day. Use line breaks to separate days.
            </p>
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
