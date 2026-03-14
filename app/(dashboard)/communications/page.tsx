'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Mail, FileText, MessageCircle, Send } from 'lucide-react';

export default function CommunicationsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // SMS State
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');

  // Email State
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const handleSendSMS = async () => {
    if (!smsPhone || !smsMessage) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/communications/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: smsPhone,
          message: smsMessage,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'SMS sent successfully',
        });
        setSmsPhone('');
        setSmsMessage('');
      } else {
        throw new Error(data.error || 'Failed to send SMS');
      }
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

  const handleSendEmail = async () => {
    if (!emailTo || !emailSubject || !emailBody) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/communications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Email sent successfully',
        });
        setEmailTo('');
        setEmailSubject('');
        setEmailBody('');
      } else {
        throw new Error(data.error || 'Failed to send email');
      }
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

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Communication Center</h1>
        <p className="text-muted-foreground">Manage SMS, Email, Templates, and Patient Feedback</p>
      </div>

      <Tabs defaultValue="sms" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sms">
            <MessageSquare className="w-4 h-4 mr-2" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="w-4 h-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="surveys">
            <MessageCircle className="w-4 h-4 mr-2" />
            Surveys
          </TabsTrigger>
        </TabsList>

        {/* SMS Tab */}
        <TabsContent value="sms">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Send SMS</CardTitle>
                <CardDescription>Send individual or bulk SMS messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="sms-phone">Phone Number</Label>
                  <Input
                    id="sms-phone"
                    placeholder="10-digit mobile number"
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="sms-message">Message</Label>
                  <Textarea
                    id="sms-message"
                    placeholder="Type your message here (max 500 characters)"
                    rows={5}
                    maxLength={500}
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {smsMessage.length}/500 characters
                  </p>
                </div>

                <Button onClick={handleSendSMS} disabled={loading} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Send SMS
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SMS History</CardTitle>
                <CardDescription>Recent SMS communications</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  SMS history will be displayed here
                </p>
                {/* SMS history table/list will go here */}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Email</CardTitle>
                <CardDescription>Compose and send emails to patients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="email-to">To (Email Address)</Label>
                  <Input
                    id="email-to"
                    type="email"
                    placeholder="patient@example.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="email-subject">Subject</Label>
                  <Input
                    id="email-subject"
                    placeholder="Email subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="email-body">Message</Label>
                  <Textarea
                    id="email-body"
                    placeholder="Type your email message here"
                    rows={8}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                </div>

                <Button onClick={handleSendEmail} disabled={loading} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email History</CardTitle>
                <CardDescription>Recent email communications</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Email history will be displayed here
                </p>
                {/* Email history table/list will go here */}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Communication Templates</CardTitle>
              <CardDescription>
                Manage SMS and Email templates for automated communications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">Available Templates</h3>
                    <p className="text-sm text-muted-foreground">
                      Create and manage reusable message templates
                    </p>
                  </div>
                  <Button>
                    Create Template
                  </Button>
                </div>

                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    Template list will be displayed here
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Surveys Tab */}
        <TabsContent value="surveys">
          <Card>
            <CardHeader>
              <CardTitle>Patient Surveys & Feedback</CardTitle>
              <CardDescription>
                Create and manage patient satisfaction surveys
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">Active Surveys</h3>
                    <p className="text-sm text-muted-foreground">
                      Collect feedback from patients
                    </p>
                  </div>
                  <Button>
                    Create Survey
                  </Button>
                </div>

                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    Survey list will be displayed here
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
