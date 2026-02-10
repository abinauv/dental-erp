'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export default function CommunicationSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // SMS Settings
  const [smsGateway, setSmsGateway] = useState('MSG91');
  const [smsApiKey, setSmsApiKey] = useState('');
  const [smsSenderId, setSmsSenderId] = useState('');
  const [smsRoute, setSmsRoute] = useState('4');
  const [smsEnabled, setSmsEnabled] = useState(true);

  // Email Settings
  const [emailHost, setEmailHost] = useState('');
  const [emailPort, setEmailPort] = useState('587');
  const [emailSecure, setEmailSecure] = useState(false);
  const [emailUser, setEmailUser] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailFromName, setEmailFromName] = useState("Dr. Dev's Dental Hospital");
  const [emailFromEmail, setEmailFromEmail] = useState('');
  const [emailReplyTo, setEmailReplyTo] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);

  // Google Review Settings
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [autoReviewRequests, setAutoReviewRequests] = useState(false);
  const [reviewRequestDelay, setReviewRequestDelay] = useState('2');

  // Test fields
  const [testPhone, setTestPhone] = useState('');
  const [testEmail, setTestEmail] = useState('');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoadingSettings(true);
      const response = await fetch('/api/settings/communications');

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const data = await response.json();

      // Load SMS settings
      if (data.sms) {
        setSmsGateway(data.sms.gateway || 'MSG91');
        setSmsApiKey(data.sms.apiKey || '');
        setSmsSenderId(data.sms.senderId || '');
        setSmsRoute(data.sms.route || '4');
        setSmsEnabled(data.sms.enabled !== 'false' && data.sms.enabled !== false);
      }

      // Load Google Review settings
      if (data.reviews) {
        setGoogleReviewUrl(data.reviews.google_review_url || '');
        setAutoReviewRequests(data.reviews.auto_review_requests === 'true' || data.reviews.auto_review_requests === true);
        setReviewRequestDelay(data.reviews.review_request_delay_hours || '2');
      }

      // Load Email settings
      if (data.email) {
        setEmailHost(data.email.smtp_host || '');
        setEmailPort(data.email.smtp_port || '587');
        setEmailSecure(data.email.smtp_secure === 'true' || data.email.smtp_secure === true);
        setEmailUser(data.email.smtp_user || '');
        setEmailPassword(data.email.smtp_password || '');
        setEmailFromName(data.email.from_name || "Dr. Dev's Dental Hospital");
        setEmailFromEmail(data.email.from_email || '');
        setEmailReplyTo(data.email.replyTo || '');
        setEmailEnabled(data.email.enabled !== 'false' && data.email.enabled !== false);
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveSMSSettings = async () => {
    setLoading(true);
    try {
      const settings = {
        gateway: smsGateway,
        apiKey: smsApiKey,
        senderId: smsSenderId,
        route: smsRoute,
        enabled: smsEnabled,
      };

      const response = await fetch('/api/settings/communications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'sms',
          settings,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      toast({
        title: 'Success',
        description: 'SMS settings saved successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmailSettings = async () => {
    setLoading(true);
    try {
      const settings = {
        smtp_host: emailHost,
        smtp_port: emailPort,
        smtp_secure: emailSecure,
        smtp_user: emailUser,
        smtp_password: emailPassword,
        from_name: emailFromName,
        from_email: emailFromEmail,
        replyTo: emailReplyTo,
        enabled: emailEnabled,
      };

      const response = await fetch('/api/settings/communications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'email',
          settings,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      toast({
        title: 'Success',
        description: 'Email settings saved successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestSMS = async () => {
    if (!testPhone) {
      toast({
        title: 'Error',
        description: 'Please enter a phone number to test',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/settings/communications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'sms',
          testData: {
            phone: testPhone,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.details || data.error || 'Failed to send test SMS');
      }

      toast({
        title: 'Success',
        description: data.message || 'Test SMS sent successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: 'Error',
        description: 'Please enter an email address to test',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/settings/communications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'email',
          testData: {
            email: testEmail,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.details || data.error || 'Failed to send test email');
      }

      toast({
        title: 'Success',
        description: data.message || 'Test email sent successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveReviewSettings = async () => {
    setLoading(true);
    try {
      const settings = {
        google_review_url: googleReviewUrl,
        auto_review_requests: autoReviewRequests,
        review_request_delay_hours: reviewRequestDelay,
      };

      const response = await fetch('/api/settings/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reviews', settings }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save settings');

      toast({ title: 'Success', description: 'Review settings saved successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Communication Settings</h1>
          <p className="text-gray-600">Configure SMS and Email gateways</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Communication Settings</h1>
        <p className="text-gray-600">Configure SMS and Email gateways</p>
      </div>

      <Tabs defaultValue="sms" className="w-full">
        <TabsList>
          <TabsTrigger value="sms">SMS Configuration</TabsTrigger>
          <TabsTrigger value="email">Email Configuration</TabsTrigger>
          <TabsTrigger value="reviews">Google Reviews</TabsTrigger>
        </TabsList>

        {/* SMS Configuration */}
        <TabsContent value="sms">
          <Card>
            <CardHeader>
              <CardTitle>SMS Gateway Settings</CardTitle>
              <CardDescription>
                Configure your Indian SMS gateway provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable SMS</Label>
                  <p className="text-sm text-gray-500">
                    Turn on/off SMS communication
                  </p>
                </div>
                <Switch
                  checked={smsEnabled}
                  onCheckedChange={setSmsEnabled}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sms-gateway">SMS Gateway</Label>
                  <Select value={smsGateway} onValueChange={setSmsGateway}>
                    <SelectTrigger id="sms-gateway">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MSG91">MSG91</SelectItem>
                      <SelectItem value="TEXTLOCAL">TextLocal</SelectItem>
                      <SelectItem value="FAST2SMS">Fast2SMS</SelectItem>
                      <SelectItem value="TWILIO">Twilio India</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sms-sender-id">Sender ID</Label>
                  <Input
                    id="sms-sender-id"
                    placeholder="DRDEV"
                    value={smsSenderId}
                    onChange={(e) => setSmsSenderId(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Approved sender ID from gateway
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sms-api-key">API Key / Auth Key</Label>
                  <Input
                    id="sms-api-key"
                    type="password"
                    placeholder="Enter your API key"
                    value={smsApiKey}
                    onChange={(e) => setSmsApiKey(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sms-route">Route (for MSG91/TextLocal)</Label>
                  <Input
                    id="sms-route"
                    placeholder="4"
                    value={smsRoute}
                    onChange={(e) => setSmsRoute(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Route 4 = Transactional, Route 1 = Promotional
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Test SMS Connection</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="test-phone">Test Phone Number</Label>
                    <Input
                      id="test-phone"
                      placeholder="9876543210"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Enter a 10-digit Indian mobile number
                    </p>
                  </div>
                  <Button onClick={handleTestSMS} disabled={testing} variant="outline">
                    {testing ? 'Sending...' : 'Send Test SMS'}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">TRAI Compliance</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• SMS will only be sent between 9 AM - 9 PM IST</li>
                  <li>• DND registry will be checked before sending</li>
                  <li>• Patient consent is required for promotional messages</li>
                </ul>
              </div>

              <Button onClick={handleSaveSMSSettings} disabled={loading}>
                {loading ? 'Saving...' : 'Save SMS Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Configuration */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Email SMTP Settings</CardTitle>
              <CardDescription>
                Configure your email server (Hostinger, Gmail, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Email</Label>
                  <p className="text-sm text-gray-500">
                    Turn on/off email communication
                  </p>
                </div>
                <Switch
                  checked={emailEnabled}
                  onCheckedChange={setEmailEnabled}
                />
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">SMTP Server Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-host">SMTP Host</Label>
                    <Input
                      id="email-host"
                      placeholder="smtp.hostinger.com"
                      value={emailHost}
                      onChange={(e) => setEmailHost(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-port">SMTP Port</Label>
                    <Input
                      id="email-port"
                      placeholder="587"
                      value={emailPort}
                      onChange={(e) => setEmailPort(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-user">SMTP Username</Label>
                    <Input
                      id="email-user"
                      placeholder="info@drdevdental.com"
                      value={emailUser}
                      onChange={(e) => setEmailUser(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-password">SMTP Password</Label>
                    <Input
                      id="email-password"
                      type="password"
                      placeholder="Enter SMTP password"
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 mt-4">
                  <Switch
                    checked={emailSecure}
                    onCheckedChange={setEmailSecure}
                  />
                  <Label>Use SSL/TLS (for port 465)</Label>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Email Sender Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-from-name">From Name</Label>
                    <Input
                      id="email-from-name"
                      placeholder="Dr. Dev's Dental Hospital"
                      value={emailFromName}
                      onChange={(e) => setEmailFromName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-from-email">From Email</Label>
                    <Input
                      id="email-from-email"
                      type="email"
                      placeholder="info@drdevdental.com"
                      value={emailFromEmail}
                      onChange={(e) => setEmailFromEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-reply-to">Reply-To Email (Optional)</Label>
                    <Input
                      id="email-reply-to"
                      type="email"
                      placeholder="contact@drdevdental.com"
                      value={emailReplyTo}
                      onChange={(e) => setEmailReplyTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Test Email Connection</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="test-email">Test Email Address</Label>
                    <Input
                      id="test-email"
                      type="email"
                      placeholder="test@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Enter an email address to receive the test email
                    </p>
                  </div>
                  <Button onClick={handleTestEmail} disabled={testing} variant="outline">
                    {testing ? 'Sending...' : 'Send Test Email'}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Recommended Settings for Hostinger</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• SMTP Host: smtp.hostinger.com</li>
                  <li>• SMTP Port: 587 (STARTTLS) or 465 (SSL)</li>
                  <li>• Use your email and password for authentication</li>
                </ul>
              </div>

              <Button onClick={handleSaveEmailSettings} disabled={loading}>
                {loading ? 'Saving...' : 'Save Email Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Google Reviews Configuration */}
        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Google Reviews Settings</CardTitle>
              <CardDescription>
                Automatically request Google reviews from satisfied patients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="google-review-url">Google Review URL</Label>
                <Input
                  id="google-review-url"
                  placeholder="https://g.page/r/YOUR_PLACE_ID/review"
                  value={googleReviewUrl}
                  onChange={(e) => setGoogleReviewUrl(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Your Google Business review link. Find it in Google Business Profile &gt; Get more reviews.
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Request Reviews</Label>
                  <p className="text-sm text-gray-500">
                    Automatically send review requests after appointments
                  </p>
                </div>
                <Switch
                  checked={autoReviewRequests}
                  onCheckedChange={setAutoReviewRequests}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-delay">Review Request Delay (hours)</Label>
                <Input
                  id="review-delay"
                  type="number"
                  min="1"
                  max="48"
                  placeholder="2"
                  value={reviewRequestDelay}
                  onChange={(e) => setReviewRequestDelay(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Hours after appointment completion before sending the review request SMS
                </p>
              </div>

              <Separator />

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Review Gating</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• Review requests are only sent to patients who rated their satisfaction 4/5 or higher</li>
                  <li>• Patients must have submitted a survey response within the last 30 days</li>
                  <li>• Only one review request per patient per 30 days</li>
                  <li>• Patients who opted out of promotional messages will not receive requests</li>
                </ul>
              </div>

              <Button onClick={handleSaveReviewSettings} disabled={loading}>
                {loading ? 'Saving...' : 'Save Review Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
