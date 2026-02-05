'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Download, FileText, Shield, HardDrive } from 'lucide-react';
import { format } from 'date-fns';

export default function SystemSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [backupStats, setBackupStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchBackupStats();
    fetchAuditLogs();
  }, []);

  const fetchBackupStats = async () => {
    try {
      const response = await fetch('/api/settings/backup', {
        method: 'POST',
      });
      const result = await response.json();

      if (result.success) {
        setBackupStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch backup stats:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch('/api/settings/audit-logs?limit=20');
      const result = await response.json();

      if (result.success) {
        setAuditLogs(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    }
  };

  const handleExportBackup = async (type: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/settings/backup?type=${type}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dental-erp-backup-${type}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Success',
          description: 'Backup downloaded successfully',
        });
      } else {
        throw new Error('Failed to export backup');
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
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="w-8 h-8" />
          System Settings
        </h1>
        <p className="text-gray-600">Backup, audit logs, and system management</p>
      </div>

      <Tabs defaultValue="backup" className="w-full">
        <TabsList>
          <TabsTrigger value="backup">
            <HardDrive className="w-4 h-4 mr-2" />
            Backup & Export
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="w-4 h-4 mr-2" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-6">
          {/* Database Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Database Statistics</CardTitle>
              <CardDescription>Current data in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {backupStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">{backupStats.patients}</p>
                    <p className="text-sm text-gray-600">Patients</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{backupStats.appointments}</p>
                    <p className="text-sm text-gray-600">Appointments</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-3xl font-bold text-purple-600">{backupStats.treatments}</p>
                    <p className="text-sm text-gray-600">Treatments</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-600">{backupStats.invoices}</p>
                    <p className="text-sm text-gray-600">Invoices</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-3xl font-bold text-red-600">{backupStats.payments}</p>
                    <p className="text-sm text-gray-600">Payments</p>
                  </div>
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <p className="text-3xl font-bold text-indigo-600">{backupStats.inventoryItems}</p>
                    <p className="text-sm text-gray-600">Inventory Items</p>
                  </div>
                  <div className="text-center p-4 bg-pink-50 rounded-lg">
                    <p className="text-3xl font-bold text-pink-600">{backupStats.staff}</p>
                    <p className="text-sm text-gray-600">Staff Members</p>
                  </div>
                  <div className="text-center p-4 bg-teal-50 rounded-lg">
                    <p className="text-3xl font-bold text-teal-600">{backupStats.labOrders}</p>
                    <p className="text-sm text-gray-600">Lab Orders</p>
                  </div>
                </div>
              ) : (
                <p>Loading statistics...</p>
              )}
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle>Data Export</CardTitle>
              <CardDescription>Download data backups in JSON format</CardDescription>
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
                  Full Database Backup
                </Button>

                <Button
                  onClick={() => handleExportBackup('patients')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Patients Only
                </Button>

                <Button
                  onClick={() => handleExportBackup('appointments')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Appointments Only
                </Button>

                <Button
                  onClick={() => handleExportBackup('treatments')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Treatments Only
                </Button>

                <Button
                  onClick={() => handleExportBackup('billing')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Billing Data
                </Button>

                <Button
                  onClick={() => handleExportBackup('inventory')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Inventory Data
                </Button>

                <Button
                  onClick={() => handleExportBackup('settings')}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Settings Only
                </Button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Backups should be stored securely and regularly.
                  Consider setting up automated backups using cron jobs or scheduled tasks.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Backup Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Backup Best Practices</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Take full backups daily, preferably at night when system usage is low</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Store backups in multiple locations (local + cloud storage)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Test backup restoration periodically to ensure data integrity</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Keep backups for at least 90 days for compliance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Encrypt backup files before storing them externally</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Audit Logs</CardTitle>
              <CardDescription>Track all system activities and changes</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-gray-500">No audit logs available</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{log.action}</span>
                          <span className="text-sm text-gray-500">
                            on {log.entityType}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          By: {log.user?.name || 'System'} ({log.user?.email || 'N/A'})
                        </p>
                        {log.ipAddress && (
                          <p className="text-xs text-gray-400 mt-1">
                            IP: {log.ipAddress}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm')}
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
  );
}
