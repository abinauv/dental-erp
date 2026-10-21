'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Database, Download, FileText, Shield, HardDrive } from 'lucide-react'
import { format } from 'date-fns'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

export default function SystemSettingsPage() {
  const t = useTranslations('settings.system')
  const fmt = useClinicFormatters()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [backupStats, setBackupStats] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  useEffect(() => {
    fetchBackupStats()
    fetchAuditLogs()
  }, [])

  const fetchBackupStats = async () => {
    try {
      const response = await fetch('/api/settings/backup', {
        method: 'POST',
      })
      const result = await response.json()

      if (result.success) {
        setBackupStats(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch backup stats:', error)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch('/api/settings/audit-logs?limit=20')
      const result = await response.json()

      if (result.success) {
        setAuditLogs(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    }
  }

  const handleExportBackup = async (type: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/settings/backup?type=${type}`)

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `dental-erp-backup-${type}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast({
          title: t('success'),
          description: t('backupSuccess'),
        })
      } else {
        throw new Error(t('exportFailed'))
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="w-8 h-8" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="backup" className="w-full">
        <TabsList>
          <TabsTrigger value="backup">
            <HardDrive className="w-4 h-4 mr-2" />
            {t('backupTab')}
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="w-4 h-4 mr-2" />
            {t('auditTab')}
          </TabsTrigger>
        </TabsList>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-6">
          {/* Database Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dbStats')}</CardTitle>
              <CardDescription>{t('dbStatsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {backupStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">{backupStats.patients}</p>
                    <p className="text-sm text-muted-foreground">{t('patients')}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{backupStats.appointments}</p>
                    <p className="text-sm text-muted-foreground">{t('appointments')}</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-3xl font-bold text-purple-600">{backupStats.treatments}</p>
                    <p className="text-sm text-muted-foreground">{t('treatments')}</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-600">{backupStats.invoices}</p>
                    <p className="text-sm text-muted-foreground">{t('invoices')}</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-3xl font-bold text-red-600">{backupStats.payments}</p>
                    <p className="text-sm text-muted-foreground">{t('payments')}</p>
                  </div>
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <p className="text-3xl font-bold text-indigo-600">
                      {backupStats.inventoryItems}
                    </p>
                    <p className="text-sm text-muted-foreground">{t('inventoryItems')}</p>
                  </div>
                  <div className="text-center p-4 bg-pink-50 rounded-lg">
                    <p className="text-3xl font-bold text-pink-600">{backupStats.staff}</p>
                    <p className="text-sm text-muted-foreground">{t('staffMembers')}</p>
                  </div>
                  <div className="text-center p-4 bg-teal-50 rounded-lg">
                    <p className="text-3xl font-bold text-teal-600">{backupStats.labOrders}</p>
                    <p className="text-sm text-muted-foreground">{t('labOrders')}</p>
                  </div>
                </div>
              ) : (
                <p>{t('loadingStats')}</p>
              )}
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dataExport')}</CardTitle>
              <CardDescription>{t('dataExportDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  onClick={() => handleExportBackup('full')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('fullBackup')}
                </Button>

                <Button
                  onClick={() => handleExportBackup('patients')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('patientsOnly')}
                </Button>

                <Button
                  onClick={() => handleExportBackup('appointments')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('appointmentsOnly')}
                </Button>

                <Button
                  onClick={() => handleExportBackup('treatments')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('treatmentsOnly')}
                </Button>

                <Button
                  onClick={() => handleExportBackup('billing')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('billingData')}
                </Button>

                <Button
                  onClick={() => handleExportBackup('inventory')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('inventoryData')}
                </Button>

                <Button
                  onClick={() => handleExportBackup('settings')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('settingsOnly')}
                </Button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-yellow-800">
                  <strong>{t('importantLabel')}</strong> {t('importantNote')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Backup Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>{t('bestPractices')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>{t('practice1')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>{t('practice2')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>{t('practice3')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>{t('practice4')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>{t('practice5')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('auditTitle')}</CardTitle>
              <CardDescription>{t('auditDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noAuditLogs')}</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{log.action}</span>
                          <span className="text-sm text-muted-foreground">
                            {t('onEntity', { entityType: log.entityType })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('byUser', {
                            name: log.user?.name || t('systemUser'),
                            email: log.user?.email || t('naValue'),
                          })}
                        </p>
                        {log.ipAddress && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('ipLabel', { ip: log.ipAddress })}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fmt.formatDateTime(log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
