'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Calendar,
  Receipt,
  MessageSquare,
  Database,
  Settings as SettingsIcon,
  Users,
  Shield,
  Link2,
  Sun,
  Moon,
  Monitor,
  Upload,
  BookOpen,
} from 'lucide-react';

const settingsCategories = [
  {
    title: 'Setup Guide',
    description: 'Step-by-step instructions to set up everything — start here!',
    icon: BookOpen,
    href: '/settings/setup-guide',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    title: 'Clinic Information',
    description: 'Manage clinic details, contact information, and branding',
    icon: Building2,
    href: '/settings/clinic',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    title: 'Appointment Settings',
    description: 'Configure time slots, working hours, and holiday calendar',
    icon: Calendar,
    href: '/settings/appointments',
    color: 'text-green-600 bg-green-50',
  },
  {
    title: 'Billing Settings',
    description: 'Set up tax rates, invoice format, and payment terms',
    icon: Receipt,
    href: '/settings/billing',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    title: 'Communication Settings',
    description: 'Configure SMS gateways, email SMTP, and notifications',
    icon: MessageSquare,
    href: '/settings/communications',
    color: 'text-orange-600 bg-orange-50',
  },
  {
    title: 'Procedure Settings',
    description: 'Manage dental procedures and default pricing',
    icon: SettingsIcon,
    href: '/settings/procedures',
    color: 'text-pink-600 bg-pink-50',
  },
  {
    title: 'User Management',
    description: 'Manage staff accounts, roles, and permissions',
    icon: Users,
    href: '/staff',
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    title: 'System Settings',
    description: 'Backup, export data, and view audit logs',
    icon: Database,
    href: '/settings/system',
    color: 'text-red-600 bg-red-50',
  },
  {
    title: 'Security Settings',
    description: 'Password policies, session timeout, and security logs',
    icon: Shield,
    href: '/settings/security',
    color: 'text-teal-600 bg-teal-50',
  },
  {
    title: 'Integrations',
    description: 'Connect Google Calendar and other external services',
    icon: Link2,
    href: '/settings/integrations',
    color: 'text-cyan-600 bg-cyan-50',
  },
  {
    title: 'Data Import',
    description: 'Import data from CSV, Excel, or PDF files from your previous ERP',
    icon: Upload,
    href: '/settings/import',
    color: 'text-emerald-600 bg-emerald-50',
  },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-8 h-8" />
          Settings & Configuration
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage all system settings and configurations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCategories.map((category) => (
          <Link key={category.href} href={category.href}>
            <Card className="h-full card-interactive">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${category.color} mb-3`}>
                  <category.icon className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl">{category.title}</CardTitle>
                <CardDescription className="text-sm">
                  {category.description}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {/* Appearance */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="w-5 h-5" />
              Appearance
            </CardTitle>
            <CardDescription>Choose how the application looks for you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {([
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ] as const).map((opt) => (
                <Button
                  key={opt.value}
                  variant={theme === opt.value ? "default" : "outline"}
                  className="flex items-center gap-2"
                  onClick={() => setTheme(opt.value)}
                >
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Info */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version:</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Database:</span>
              <span className="font-medium">MySQL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environment:</span>
              <span className="font-medium">Production</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Regular backups are crucial for data safety</p>
            <p>• Review audit logs periodically for security</p>
            <p>• Keep clinic information updated</p>
            <p>• Configure SMS/Email for automated reminders</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
