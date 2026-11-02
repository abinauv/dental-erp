'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Languages,
} from 'lucide-react'

const settingsCategories = [
  {
    key: 'setupGuide',
    icon: BookOpen,
    href: '/settings/setup-guide',
    color: 'text-amber-600 bg-amber-50',
  },
  { key: 'clinic', icon: Building2, href: '/settings/clinic', color: 'text-blue-600 bg-blue-50' },
  {
    key: 'appointments',
    icon: Calendar,
    href: '/settings/appointments',
    color: 'text-green-600 bg-green-50',
  },
  {
    key: 'billing',
    icon: Receipt,
    href: '/settings/billing',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    key: 'communications',
    icon: MessageSquare,
    href: '/settings/communications',
    color: 'text-orange-600 bg-orange-50',
  },
  {
    key: 'procedures',
    icon: SettingsIcon,
    href: '/settings/procedures',
    color: 'text-pink-600 bg-pink-50',
  },
  { key: 'users', icon: Users, href: '/staff', color: 'text-indigo-600 bg-indigo-50' },
  { key: 'system', icon: Database, href: '/settings/system', color: 'text-red-600 bg-red-50' },
  { key: 'security', icon: Shield, href: '/settings/security', color: 'text-teal-600 bg-teal-50' },
  {
    key: 'integrations',
    icon: Link2,
    href: '/settings/integrations',
    color: 'text-cyan-600 bg-cyan-50',
  },
  {
    key: 'import',
    icon: Upload,
    href: '/settings/import',
    color: 'text-emerald-600 bg-emerald-50',
  },
  { key: 'profile', icon: Languages, href: '/settings/profile', color: 'text-sky-600 bg-sky-50' },
]

export default function SettingsPage() {
  const t = useTranslations('settings.home')
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-8 h-8" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCategories.map((category) => (
          <Link key={category.href} href={category.href}>
            <Card className="h-full card-interactive">
              <CardHeader>
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${category.color} mb-3`}
                >
                  <category.icon className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl">{t(`cat.${category.key}.title`)}</CardTitle>
                <CardDescription className="text-sm">
                  {t(`cat.${category.key}.desc`)}
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
              {t('appearance')}
            </CardTitle>
            <CardDescription>{t('appearanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {(
                [
                  { value: 'light', label: t('light'), icon: Sun },
                  { value: 'dark', label: t('dark'), icon: Moon },
                  { value: 'system', label: t('system'), icon: Monitor },
                ] as const
              ).map((opt) => (
                <Button
                  key={opt.value}
                  variant={theme === opt.value ? 'default' : 'outline'}
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
            <CardTitle>{t('systemInformation')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('version')}</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('database')}</span>
              <span className="font-medium">MySQL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('environment')}</span>
              <span className="font-medium">{t('environmentProduction')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('quickTips')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• {t('tip1')}</p>
            <p>• {t('tip2')}</p>
            <p>• {t('tip3')}</p>
            <p>• {t('tip4')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
