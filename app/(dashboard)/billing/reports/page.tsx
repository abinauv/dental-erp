'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart3,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Stethoscope,
  Calendar,
  Clock,
  AlertCircle,
  IndianRupee,
  CreditCard,
  Banknote,
} from 'lucide-react'
import { dateRangePresets } from '@/lib/billing-utils'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { downloadExcel } from '@/lib/export-utils'
import { useToast } from '@/hooks/use-toast'

interface OutstandingInvoice {
  id: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string | null
  totalAmount: string | number
  balanceAmount: string | number
  status: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
  }
}

interface AgingData {
  current: { amount: number; count: number }
  days1_30: { amount: number; count: number }
  days31_60: { amount: number; count: number }
  days61_90: { amount: number; count: number }
  over90: { amount: number; count: number }
}

interface ProcedureRevenue {
  procedureId: string
  code: string
  name: string
  category: string
  totalRevenue: number
  count: number
  avgRevenue: number
}

interface DoctorRevenue {
  doctorId: string
  name: string
  specialization: string | null
  totalRevenue: number
  treatmentCount: number
  avgPerTreatment: number
  topProcedures: Array<{ name: string; count: number }>
}

export default function FinancialReportsPage() {
  const t = useTranslations('billing.reports')
  const tMethods = useTranslations('billing.paymentMethods')
  const { toast } = useToast()
  const { formatDate, formatCurrency: fc } = useClinicFormatters()
  const formatCurrency = (amount: Parameters<typeof fc>[0]) =>
    fc(amount, { minimumFractionDigits: 2 })
  const [loading, setLoading] = useState(true)
  const [datePreset, setDatePreset] = useState('this_month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeTab, setActiveTab] = useState('outstanding')

  // Report data
  const [outstandingData, setOutstandingData] = useState<{
    invoices: OutstandingInvoice[]
    aging: AgingData
    totals: { totalOutstanding: number; invoiceCount: number }
  } | null>(null)

  const [procedureData, setProcedureData] = useState<{
    byProcedure: ProcedureRevenue[]
    totals: { totalRevenue: number; totalTreatments: number }
  } | null>(null)

  const [doctorData, setDoctorData] = useState<{
    byDoctor: DoctorRevenue[]
    totals: { totalRevenue: number; totalTreatments: number; doctorCount: number }
  } | null>(null)

  const [dailyData, setDailyData] = useState<{
    dailyData: Array<{
      date: string
      cash: number
      card: number
      upi: number
      bankTransfer: number
      total: number
      count: number
    }>
    totals: { totalCollection: number; totalPayments: number }
  } | null>(null)

  const fetchReport = async (type: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ type })

      if (dateFrom && dateTo) {
        params.append('dateFrom', dateFrom)
        params.append('dateTo', dateTo)
      } else {
        params.append('preset', datePreset)
      }

      const response = await fetch(`/api/billing/reports?${params}`)
      if (!response.ok) throw new Error('Failed to fetch report')
      const data = await response.json()

      switch (type) {
        case 'outstanding':
          setOutstandingData(data)
          break
        case 'procedure_revenue':
          setProcedureData(data)
          break
        case 'doctor_revenue':
          setDoctorData(data)
          break
        case 'daily_collection':
          setDailyData(data)
          break
      }
    } catch (error) {
      console.error(`Error fetching ${type} report:`, error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(activeTab)
  }, [activeTab, datePreset, dateFrom, dateTo])

  const handleExport = async () => {
    // Export the currently-active tab's loaded data as .xlsx. Amounts are kept
    // as raw numbers so the spreadsheet can total/sort them.
    let rows: Record<string, unknown>[] = []
    let filename = 'report'

    if (activeTab === 'outstanding') {
      rows = (outstandingData?.invoices ?? []).map((i) => ({
        Invoice: i.invoiceNo,
        Patient: `${i.patient.firstName} ${i.patient.lastName}`,
        'Patient ID': i.patient.patientId,
        Phone: i.patient.phone,
        'Invoice Date': i.invoiceDate ? formatDate(i.invoiceDate) : '',
        'Due Date': i.dueDate ? formatDate(i.dueDate) : '',
        Total: Number(i.totalAmount),
        Balance: Number(i.balanceAmount),
        Status: i.status,
      }))
      filename = 'outstanding-invoices'
    } else if (activeTab === 'procedure_revenue') {
      rows = (procedureData?.byProcedure ?? []).map((p) => ({
        Code: p.code,
        Procedure: p.name,
        Category: p.category,
        'Total Revenue': p.totalRevenue,
        Count: p.count,
        'Avg Revenue': p.avgRevenue,
      }))
      filename = 'procedure-revenue'
    } else if (activeTab === 'doctor_revenue') {
      rows = (doctorData?.byDoctor ?? []).map((d) => ({
        Doctor: d.name,
        Specialization: d.specialization ?? '',
        'Total Revenue': d.totalRevenue,
        Treatments: d.treatmentCount,
        'Avg per Treatment': d.avgPerTreatment,
      }))
      filename = 'doctor-revenue'
    } else if (activeTab === 'daily_collection') {
      rows = (dailyData?.dailyData ?? []).map((d) => ({
        Date: d.date,
        Cash: d.cash,
        Card: d.card,
        UPI: d.upi,
        'Bank Transfer': d.bankTransfer,
        Total: d.total,
        Payments: d.count,
      }))
      filename = 'daily-collection'
    }

    if (rows.length === 0) {
      toast({ title: t('exportEmpty'), variant: 'destructive' })
      return
    }

    await downloadExcel(rows, `${filename}-${new Date().toISOString().slice(0, 10)}`, filename)
    toast({ title: t('exportSuccess') })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={datePreset}
            onValueChange={(v) => {
              setDatePreset(v)
              setDateFrom('')
              setDateTo('')
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('selectPeriod')} />
            </SelectTrigger>
            <SelectContent>
              {dateRangePresets.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {datePreset === 'custom' && (
            <>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
              />
            </>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t('export')}
          </Button>
        </div>
      </div>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="outstanding" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('tabOutstanding')}
          </TabsTrigger>
          <TabsTrigger value="procedure_revenue" className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            {t('tabByProcedure')}
          </TabsTrigger>
          <TabsTrigger value="doctor_revenue" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('tabByDoctor')}
          </TabsTrigger>
          <TabsTrigger value="daily_collection" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('tabDaily')}
          </TabsTrigger>
        </TabsList>

        {/* Outstanding Report */}
        <TabsContent value="outstanding" className="space-y-6">
          {/* Aging Summary */}
          <div className="grid gap-4 md:grid-cols-5">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))
            ) : outstandingData ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-600">
                      {t('current')}
                    </CardTitle>
                    <CardDescription>{t('notYetDue')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(outstandingData.aging.current.amount)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('invoices', { count: outstandingData.aging.current.count })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-yellow-600">
                      {t('days1_30')}
                    </CardTitle>
                    <CardDescription>{t('overdue')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(outstandingData.aging.days1_30.amount)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('invoices', { count: outstandingData.aging.days1_30.count })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-orange-600">
                      {t('days31_60')}
                    </CardTitle>
                    <CardDescription>{t('overdue')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(outstandingData.aging.days31_60.amount)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('invoices', { count: outstandingData.aging.days31_60.count })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-500">
                      {t('days61_90')}
                    </CardTitle>
                    <CardDescription>{t('overdue')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(outstandingData.aging.days61_90.amount)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('invoices', { count: outstandingData.aging.days61_90.count })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-700">
                      {t('days90')}
                    </CardTitle>
                    <CardDescription>{t('critical')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(outstandingData.aging.over90.amount)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('invoices', { count: outstandingData.aging.over90.count })}
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>

          {/* Outstanding Invoices Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t('outstandingInvoices')}</CardTitle>
              <CardDescription>
                {t('outstandingTotal', {
                  amount: formatCurrency(outstandingData?.totals.totalOutstanding || 0),
                  count: outstandingData?.totals.invoiceCount || 0,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('cols.invoice')}</TableHead>
                    <TableHead>{t('cols.patient')}</TableHead>
                    <TableHead>{t('cols.invoiceDate')}</TableHead>
                    <TableHead>{t('cols.dueDate')}</TableHead>
                    <TableHead className="text-right">{t('cols.total')}</TableHead>
                    <TableHead className="text-right">{t('cols.balance')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : outstandingData?.invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {t('noOutstanding')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    outstandingData?.invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoiceNo}</TableCell>
                        <TableCell>
                          {invoice.patient.firstName} {invoice.patient.lastName}
                        </TableCell>
                        <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                        <TableCell>{invoice.dueDate ? formatDate(invoice.dueDate) : '-'}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(invoice.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(invoice.balanceAmount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Procedure Revenue Report */}
        <TabsContent value="procedure_revenue" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('totalRevenue')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-2xl font-bold">
                    {formatCurrency(procedureData?.totals.totalRevenue || 0)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('totalTreatments')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-2xl font-bold">
                    {procedureData?.totals.totalTreatments || 0}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('revenueByProcedure')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('procCols.procedure')}</TableHead>
                    <TableHead>{t('procCols.category')}</TableHead>
                    <TableHead className="text-center">{t('procCols.count')}</TableHead>
                    <TableHead className="text-right">{t('procCols.avgRevenue')}</TableHead>
                    <TableHead className="text-right">{t('procCols.totalRevenue')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : procedureData?.byProcedure.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        {t('noProcedure')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    procedureData?.byProcedure.map((proc) => (
                      <TableRow key={proc.procedureId}>
                        <TableCell>
                          <div className="font-medium">{proc.name}</div>
                          <div className="text-sm text-muted-foreground">{proc.code}</div>
                        </TableCell>
                        <TableCell>{proc.category}</TableCell>
                        <TableCell className="text-center">{proc.count}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(proc.avgRevenue)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(proc.totalRevenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Doctor Revenue Report */}
        <TabsContent value="doctor_revenue" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('totalRevenue')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-2xl font-bold">
                    {formatCurrency(doctorData?.totals.totalRevenue || 0)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('totalTreatments')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-2xl font-bold">
                    {doctorData?.totals.totalTreatments || 0}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('activeDoctors')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-2xl font-bold">{doctorData?.totals.doctorCount || 0}</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('revenueByDoctor')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('docCols.doctor')}</TableHead>
                    <TableHead className="text-center">{t('docCols.treatments')}</TableHead>
                    <TableHead className="text-right">{t('docCols.avgPerTreatment')}</TableHead>
                    <TableHead className="text-right">{t('docCols.totalRevenue')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : doctorData?.byDoctor.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t('noDoctor')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    doctorData?.byDoctor.map((doc) => (
                      <TableRow key={doc.doctorId}>
                        <TableCell>
                          <div className="font-medium">Dr. {doc.name}</div>
                          {doc.specialization && (
                            <div className="text-sm text-muted-foreground">
                              {doc.specialization}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{doc.treatmentCount}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(doc.avgPerTreatment)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(doc.totalRevenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Collection Report */}
        <TabsContent value="daily_collection" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('totalCollection')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(dailyData?.totals.totalCollection || 0)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('totalPayments')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-2xl font-bold">{dailyData?.totals.totalPayments || 0}</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('dailyBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Banknote className="h-4 w-4" />
                        {tMethods('CASH')}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <CreditCard className="h-4 w-4" />
                        {tMethods('CARD')}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">{tMethods('UPI')}</TableHead>
                    <TableHead className="text-right">{tMethods('BANK_TRANSFER')}</TableHead>
                    <TableHead className="text-right">{t('total')}</TableHead>
                    <TableHead className="text-center">{t('count')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-12" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : dailyData?.dailyData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        {t('noCollection')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    dailyData?.dailyData.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="font-medium">{formatDate(day.date)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(day.cash)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(day.card)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(day.upi)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(day.bankTransfer)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(day.total)}
                        </TableCell>
                        <TableCell className="text-center">{day.count}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
