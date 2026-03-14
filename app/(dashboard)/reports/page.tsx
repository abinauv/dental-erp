"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart3,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  DollarSign,
  Calendar,
  Clock,
  UserCheck,
  FileText,
  Stethoscope,
  Package,
} from "lucide-react"
import { format } from "date-fns"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
} from "recharts"

import { ReportBuilder } from "@/components/ai/report-builder"

// Chart colors
const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B6B']

// Date range presets
const dateRangePresets = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This Week", value: "this_week" },
  { label: "Last Week", value: "last_week" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "This Quarter", value: "this_quarter" },
  { label: "Last Quarter", value: "last_quarter" },
  { label: "This Year", value: "this_year" },
  { label: "Last Year", value: "last_year" },
  { label: "Custom Range", value: "custom" },
]

interface PatientAnalytics {
  newPatients: number
  returningPatients: number
  totalPatients: number
  retentionRate: number
  demographics: {
    male: number
    female: number
    other: number
  }
  ageGroups: {
    label: string
    count: number
  }[]
  acquisitionSources: {
    source: string
    count: number
    percentage: number
  }[]
}

interface ClinicalAnalytics {
  totalTreatments: number
  completedTreatments: number
  inProgressTreatments: number
  completionRate: number
  avgTreatmentDuration: number
  commonProcedures: {
    name: string
    code: string
    count: number
    successRate: number
  }[]
  proceduresByCategory: {
    category: string
    count: number
    percentage: number
  }[]
}

interface FinancialAnalytics {
  totalRevenue: number
  totalExpenses: number
  profitMargin: number
  avgBillValue: number
  collectionEfficiency: number
  revenueByMonth: {
    month: string
    revenue: number
    expenses: number
    profit: number
  }[]
  paymentMethodBreakdown: {
    method: string
    amount: number
    percentage: number
  }[]
  outstandingAmount: number
}

interface OperationalAnalytics {
  totalAppointments: number
  completedAppointments: number
  cancelledAppointments: number
  noShowCount: number
  noShowRate: number
  appointmentUtilization: number
  avgWaitTime: number
  staffProductivity: {
    staffId: string
    name: string
    role: string
    appointmentsHandled: number
    treatmentsCompleted: number
    revenue: number
  }[]
  inventoryTurnover: number
  lowStockItems: number
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [datePreset, setDatePreset] = useState("this_month")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [activeTab, setActiveTab] = useState("patient")

  // Analytics data state
  const [patientAnalytics, setPatientAnalytics] = useState<PatientAnalytics | null>(null)
  const [clinicalAnalytics, setClinicalAnalytics] = useState<ClinicalAnalytics | null>(null)
  const [financialAnalytics, setFinancialAnalytics] = useState<FinancialAnalytics | null>(null)
  const [operationalAnalytics, setOperationalAnalytics] = useState<OperationalAnalytics | null>(null)

  const fetchAnalytics = async (type: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ type })

      if (dateFrom && dateTo) {
        params.append("dateFrom", dateFrom)
        params.append("dateTo", dateTo)
      } else {
        params.append("preset", datePreset)
      }

      const response = await fetch(`/api/reports/analytics?${params}`)
      if (!response.ok) throw new Error("Failed to fetch analytics")
      const data = await response.json()

      switch (type) {
        case "patient":
          setPatientAnalytics(data)
          break
        case "clinical":
          setClinicalAnalytics(data)
          break
        case "financial":
          setFinancialAnalytics(data)
          break
        case "operational":
          setOperationalAnalytics(data)
          break
      }
    } catch (error) {
      console.error(`Error fetching ${type} analytics:`, error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics(activeTab)
  }, [activeTab, datePreset, dateFrom, dateTo])

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const params = new URLSearchParams({
        type: activeTab,
        format,
      })

      if (dateFrom && dateTo) {
        params.append("dateFrom", dateFrom)
        params.append("dateTo", dateTo)
      } else {
        params.append("preset", datePreset)
      }

      const response = await fetch(`/api/reports/export?${params}`)
      if (!response.ok) throw new Error("Failed to export report")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeTab}_analytics_${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export report')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive analytics and insights for your dental practice
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={datePreset}
            onValueChange={(v) => {
              setDatePreset(v)
              if (v !== "custom") {
                setDateFrom("")
                setDateTo("")
              }
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {dateRangePresets.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {datePreset === "custom" && (
            <>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
                placeholder="From"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
                placeholder="To"
              />
            </>
          )}
          <Select onValueChange={(value) => handleExport(value as 'pdf' | 'excel')}>
            <SelectTrigger className="w-[140px]">
              <Download className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">Export as PDF</SelectItem>
              <SelectItem value="excel">Export as Excel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* AI Report Builder */}
      <Card>
        <CardContent className="pt-6">
          <ReportBuilder />
        </CardContent>
      </Card>

      {/* Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="patient" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Patient Analytics
          </TabsTrigger>
          <TabsTrigger value="clinical" className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Clinical Analytics
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Financial Analytics
          </TabsTrigger>
          <TabsTrigger value="operational" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Operational Analytics
          </TabsTrigger>
        </TabsList>

        {/* Patient Analytics Tab */}
        <TabsContent value="patient" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Patients</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{patientAnalytics?.newPatients || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {patientAnalytics ? formatPercentage((patientAnalytics.newPatients / patientAnalytics.totalPatients) * 100) : '0%'} of total
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Returning Patients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{patientAnalytics?.returningPatients || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {patientAnalytics ? formatPercentage((patientAnalytics.returningPatients / patientAnalytics.totalPatients) * 100) : '0%'} of total
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{patientAnalytics?.totalPatients || 0}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-green-600">
                      {formatPercentage(patientAnalytics?.retentionRate || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Patients with repeat visits
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Demographics Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Gender Distribution</CardTitle>
                <CardDescription>Patient demographics breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <>
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Male</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-32 bg-blue-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600"
                            style={{ width: `${((patientAnalytics?.demographics.male || 0) / (patientAnalytics?.totalPatients || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{patientAnalytics?.demographics.male || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Female</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-32 bg-pink-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-pink-600"
                            style={{ width: `${((patientAnalytics?.demographics.female || 0) / (patientAnalytics?.totalPatients || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{patientAnalytics?.demographics.female || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Other</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-muted-foreground"
                            style={{ width: `${((patientAnalytics?.demographics.other || 0) / (patientAnalytics?.totalPatients || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{patientAnalytics?.demographics.other || 0}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Patient Acquisition Sources */}
            <Card>
              <CardHeader>
                <CardTitle>Acquisition Sources</CardTitle>
                <CardDescription>How patients found your practice</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </>
                ) : patientAnalytics?.acquisitionSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No acquisition data available
                  </p>
                ) : (
                  patientAnalytics?.acquisitionSources.map((source) => (
                    <div key={source.source} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{source.source || 'Unknown'}</span>
                        <span className="text-muted-foreground">
                          {source.count} ({formatPercentage(source.percentage)})
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${source.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Age Groups */}
          <Card>
            <CardHeader>
              <CardTitle>Age Distribution</CardTitle>
              <CardDescription>Patients by age group</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : patientAnalytics?.ageGroups && patientAnalytics.ageGroups.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={patientAnalytics.ageGroups}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8884D8" name="Patients" radius={[4, 4, 0, 0]}>
                      {patientAnalytics.ageGroups.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No age data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clinical Analytics Tab */}
        <TabsContent value="clinical" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Treatments</CardTitle>
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{clinicalAnalytics?.totalTreatments || 0}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-green-600">
                      {clinicalAnalytics?.completedTreatments || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPercentage(clinicalAnalytics?.completionRate || 0)} completion rate
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Activity className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold text-orange-600">
                    {clinicalAnalytics?.inProgressTreatments || 0}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {clinicalAnalytics?.avgTreatmentDuration || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">minutes per treatment</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Most Common Procedures */}
            <Card>
              <CardHeader>
                <CardTitle>Most Common Procedures</CardTitle>
                <CardDescription>Top procedures by frequency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </>
                ) : clinicalAnalytics?.commonProcedures.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No procedure data available
                  </p>
                ) : (
                  clinicalAnalytics?.commonProcedures.map((proc, index) => (
                    <div key={proc.code} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{proc.name}</div>
                          <div className="text-xs text-muted-foreground">{proc.code}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{proc.count}</div>
                        <div className="text-xs text-green-600">
                          {formatPercentage(proc.successRate)} success
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Procedures by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Procedures by Category</CardTitle>
                <CardDescription>Treatment distribution by type</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : clinicalAnalytics?.proceduresByCategory && clinicalAnalytics.proceduresByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={clinicalAnalytics.proceduresByCategory.map(cat => ({
                          name: cat.category,
                          value: cat.count,
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {clinicalAnalytics.proceduresByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No category data available
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financial Analytics Tab */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(financialAnalytics?.totalRevenue || 0)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <DollarSign className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(financialAnalytics?.totalExpenses || 0)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {formatPercentage(financialAnalytics?.profitMargin || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">Net margin</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Bill Value</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">
                    {formatCurrency(financialAnalytics?.avgBillValue || 0)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Collection Efficiency</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-green-600">
                      {formatPercentage(financialAnalytics?.collectionEfficiency || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Outstanding: {formatCurrency(financialAnalytics?.outstandingAmount || 0)}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Method Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method Breakdown</CardTitle>
              <CardDescription>Revenue by payment method</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : financialAnalytics?.paymentMethodBreakdown && financialAnalytics.paymentMethodBreakdown.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={financialAnalytics.paymentMethodBreakdown.map(m => ({
                          name: m.method,
                          value: m.amount,
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {financialAnalytics.paymentMethodBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-4">
                    {financialAnalytics.paymentMethodBreakdown.map((method, index) => (
                      <div key={method.method} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span className="font-medium">{method.method}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(method.amount)}</div>
                          <div className="text-xs text-muted-foreground">{formatPercentage(method.percentage)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No payment data available</p>
              )}
            </CardContent>
          </Card>

          {/* Revenue Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
              <CardDescription>Monthly revenue, expenses, and profit</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : financialAnalytics?.revenueByMonth && financialAnalytics.revenueByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={financialAnalytics.revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#00C49F" name="Revenue" />
                    <Bar dataKey="expenses" fill="#FF6B6B" name="Expenses" />
                    <Line type="monotone" dataKey="profit" stroke="#8884D8" strokeWidth={3} name="Profit" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No revenue data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operational Analytics Tab */}
        <TabsContent value="operational" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{operationalAnalytics?.totalAppointments || 0}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-green-600">
                      {operationalAnalytics?.completedAppointments || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPercentage(operationalAnalytics?.appointmentUtilization || 0)} utilization
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">No-Show Rate</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-red-600">
                      {formatPercentage(operationalAnalytics?.noShowRate || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {operationalAnalytics?.noShowCount || 0} appointments
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Wait Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {operationalAnalytics?.avgWaitTime || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">minutes</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Staff Productivity */}
          <Card>
            <CardHeader>
              <CardTitle>Staff Productivity</CardTitle>
              <CardDescription>Performance metrics by staff member</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {operationalAnalytics?.staffProductivity.map((staff) => (
                    <div key={staff.staffId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{staff.name}</div>
                        <div className="text-sm text-muted-foreground">{staff.role}</div>
                      </div>
                      <div className="flex gap-8 text-center">
                        <div>
                          <div className="text-sm text-muted-foreground">Appointments</div>
                          <div className="text-xl font-bold">{staff.appointmentsHandled}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Treatments</div>
                          <div className="text-xl font-bold">{staff.treatmentsCompleted}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Revenue</div>
                          <div className="text-xl font-bold text-green-600">{formatCurrency(staff.revenue)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inventory Metrics */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Turnover</CardTitle>
                <CardDescription>How quickly inventory is being used</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="space-y-2">
                    <div className="text-3xl font-bold">
                      {operationalAnalytics?.inventoryTurnover?.toFixed(2) || '0.00'}x
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Average turnover rate per period
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Low Stock Alert</CardTitle>
                <CardDescription>Items requiring reorder</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-orange-600">
                      {operationalAnalytics?.lowStockItems || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Items below reorder level
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
