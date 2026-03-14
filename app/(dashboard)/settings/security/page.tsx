'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Shield, Lock, Clock, UserX, AlertTriangle } from 'lucide-react';
import { AuditMonitor } from "@/components/ai/audit-monitor";
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

export default function SecuritySettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password Policy
  const [passwordMinLength, setPasswordMinLength] = useState(8);
  const [passwordRequireUppercase, setPasswordRequireUppercase] = useState(true);
  const [passwordRequireLowercase, setPasswordRequireLowercase] = useState(true);
  const [passwordRequireNumbers, setPasswordRequireNumbers] = useState(true);
  const [passwordRequireSpecialChars, setPasswordRequireSpecialChars] = useState(true);
  const [passwordExpiryDays, setPasswordExpiryDays] = useState(90);

  // Session Management
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(60);

  // Login Security
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(5);
  const [lockoutDurationMinutes, setLockoutDurationMinutes] = useState(30);

  // Two-Factor Authentication
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);

  // IP Management
  const [allowedIPs, setAllowedIPs] = useState('');
  const [blockedIPs, setBlockedIPs] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/security');

      if (!response.ok) throw new Error('Failed to load settings');

      const data = await response.json();
      const settings = data.data || {};

      // Load password policy settings
      if (settings.passwordMinLength !== undefined) setPasswordMinLength(settings.passwordMinLength);
      if (settings.passwordRequireUppercase !== undefined) setPasswordRequireUppercase(settings.passwordRequireUppercase);
      if (settings.passwordRequireLowercase !== undefined) setPasswordRequireLowercase(settings.passwordRequireLowercase);
      if (settings.passwordRequireNumbers !== undefined) setPasswordRequireNumbers(settings.passwordRequireNumbers);
      if (settings.passwordRequireSpecialChars !== undefined) setPasswordRequireSpecialChars(settings.passwordRequireSpecialChars);
      if (settings.passwordExpiryDays !== undefined) setPasswordExpiryDays(settings.passwordExpiryDays);

      // Load session settings
      if (settings.sessionTimeoutMinutes !== undefined) setSessionTimeoutMinutes(settings.sessionTimeoutMinutes);

      // Load login security settings
      if (settings.maxLoginAttempts !== undefined) setMaxLoginAttempts(settings.maxLoginAttempts);
      if (settings.lockoutDurationMinutes !== undefined) setLockoutDurationMinutes(settings.lockoutDurationMinutes);

      // Load 2FA settings
      if (settings.requireTwoFactor !== undefined) setRequireTwoFactor(settings.requireTwoFactor);

      // Load IP management settings
      if (settings.allowedIPs !== undefined) setAllowedIPs(settings.allowedIPs);
      if (settings.blockedIPs !== undefined) setBlockedIPs(settings.blockedIPs);

    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load security settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passwordMinLength,
          passwordRequireUppercase,
          passwordRequireLowercase,
          passwordRequireNumbers,
          passwordRequireSpecialChars,
          passwordExpiryDays,
          sessionTimeoutMinutes,
          maxLoginAttempts,
          lockoutDurationMinutes,
          requireTwoFactor,
          allowedIPs,
          blockedIPs,
        }),
      });

      if (!response.ok) throw new Error('Failed to save settings');

      toast({
        title: 'Success',
        description: 'Security settings saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save security settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Security Settings</h1>
          <p className="text-muted-foreground">Configure security policies and access controls</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="w-8 h-8" />
          Security Settings
        </h1>
        <p className="text-muted-foreground">Configure security policies and access controls</p>
      </div>

      <div className="space-y-6">
        {/* Password Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Password Policy
            </CardTitle>
            <CardDescription>
              Configure password requirements for all users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Minimum Password Length</Label>
              <Input
                type="number"
                value={passwordMinLength}
                onChange={(e) => setPasswordMinLength(parseInt(e.target.value) || 8)}
                min="6"
                max="32"
              />
              <p className="text-sm text-muted-foreground">
                Minimum: 6 characters, Maximum: 32 characters
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Uppercase Letters</Label>
                  <p className="text-sm text-muted-foreground">At least one uppercase letter (A-Z)</p>
                </div>
                <Switch
                  checked={passwordRequireUppercase}
                  onCheckedChange={setPasswordRequireUppercase}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Lowercase Letters</Label>
                  <p className="text-sm text-muted-foreground">At least one lowercase letter (a-z)</p>
                </div>
                <Switch
                  checked={passwordRequireLowercase}
                  onCheckedChange={setPasswordRequireLowercase}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Numbers</Label>
                  <p className="text-sm text-muted-foreground">At least one number (0-9)</p>
                </div>
                <Switch
                  checked={passwordRequireNumbers}
                  onCheckedChange={setPasswordRequireNumbers}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Special Characters</Label>
                  <p className="text-sm text-muted-foreground">At least one special character (!@#$%)</p>
                </div>
                <Switch
                  checked={passwordRequireSpecialChars}
                  onCheckedChange={setPasswordRequireSpecialChars}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Password Expiry (days)</Label>
              <Input
                type="number"
                value={passwordExpiryDays}
                onChange={(e) => setPasswordExpiryDays(parseInt(e.target.value) || 90)}
                min="0"
                max="365"
              />
              <p className="text-sm text-muted-foreground">
                Set to 0 to disable password expiry
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Session Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Session Management
            </CardTitle>
            <CardDescription>
              Configure user session timeout and security
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Session Timeout (minutes)</Label>
              <Input
                type="number"
                value={sessionTimeoutMinutes}
                onChange={(e) => setSessionTimeoutMinutes(parseInt(e.target.value) || 60)}
                min="5"
                max="1440"
              />
              <p className="text-sm text-muted-foreground">
                Users will be logged out after this period of inactivity
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Login Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5" />
              Login Security
            </CardTitle>
            <CardDescription>
              Protect against brute force attacks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Maximum Login Attempts</Label>
                <Input
                  type="number"
                  value={maxLoginAttempts}
                  onChange={(e) => setMaxLoginAttempts(parseInt(e.target.value) || 5)}
                  min="1"
                  max="10"
                />
                <p className="text-sm text-muted-foreground">
                  Account will be locked after this many failed attempts
                </p>
              </div>

              <div className="space-y-2">
                <Label>Lockout Duration (minutes)</Label>
                <Input
                  type="number"
                  value={lockoutDurationMinutes}
                  onChange={(e) => setLockoutDurationMinutes(parseInt(e.target.value) || 30)}
                  min="1"
                  max="1440"
                />
                <p className="text-sm text-muted-foreground">
                  How long the account remains locked
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Add an extra layer of security to user accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>Require Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Force all users to enable 2FA for their accounts
                </p>
              </div>
              <Switch
                checked={requireTwoFactor}
                onCheckedChange={setRequireTwoFactor}
              />
            </div>
          </CardContent>
        </Card>

        {/* IP Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              IP Address Management
            </CardTitle>
            <CardDescription>
              Control access based on IP addresses (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Allowed IP Addresses</Label>
              <Textarea
                value={allowedIPs}
                onChange={(e) => setAllowedIPs(e.target.value)}
                placeholder="192.168.1.100&#10;10.0.0.0/24"
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                Enter one IP address or CIDR range per line. Leave empty to allow all IPs.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Blocked IP Addresses</Label>
              <Textarea
                value={blockedIPs}
                onChange={(e) => setBlockedIPs(e.target.value)}
                placeholder="192.168.1.200&#10;203.0.113.0/24"
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                Enter one IP address or CIDR range per line. These IPs will be denied access.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log Intelligence */}
        <Card>
          <CardContent className="pt-6">
            <AuditMonitor />
          </CardContent>
        </Card>

        {/* Security Warning */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="w-5 h-5" />
              Important Security Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-yellow-700 space-y-2">
            <p>• Changes to security settings affect all users immediately</p>
            <p>• Stricter password policies may require users to reset their passwords</p>
            <p>• Be careful with IP restrictions to avoid locking yourself out</p>
            <p>• Always test security changes in a non-production environment first</p>
            <p>• Enabling 2FA is highly recommended for admin accounts</p>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving} size="lg">
            {saving ? 'Saving...' : 'Save Security Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
