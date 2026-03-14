'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Receipt, TrendingUp, TrendingDown, AlertCircle, ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { InsightsPanel } from "@/components/ai/insights-panel";
import { CHART_COLORS } from "@/lib/chart-theme";

interface DashboardStats {
  overview: {
    totalPatients: number;
    newPatientsThisMonth: number;
    patientGrowth: number;
    todayAppointments: number;
    thisMonthAppointments: number;
    appointmentGrowth: number;
    pendingAppointments: number;
    completedAppointmentsToday: number;
    thisMonthRevenue: number;
    todayRevenue: number;
    revenueGrowth: number;
    pendingPayments: number;
    totalRevenue: number;
  };
  charts: {
    last7DaysRevenue: Array<{ date: string; revenue: number }>;
    last6MonthsRevenue: Array<{ month: string; revenue: number }>;
    appointmentsByStatus: Array<{ status: string; count: number }>;
    topProcedures: Array<{ name: string; count: number; revenue: number }>;
  };
  recentActivity: {
    upcomingAppointments: Array<{
      id: string;
      patientName: string;
      doctorName: string;
      date: string;
      type: string;
      status: string;
    }>;
    lowStockItems: Array<{
      id: string;
      name: string;
      currentStock: number;
      minimumStock: number;
      unit: string;
    }>;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/stats');

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard statistics');
      }

      const data = await response.json();
      setStats(data.data);
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    if (growth < 0) return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    return null;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Loading your practice data...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-red-600">Failed to load dashboard data</p>
        </div>
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p>{error || 'An error occurred'}</p>
            </div>
            <Button onClick={fetchDashboardStats} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening at your dental practice today.
        </p>
      </div>

      {/* AI Insights */}
      <InsightsPanel />

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Patients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.totalPatients.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getGrowthIcon(stats.overview.patientGrowth)}
              <span className={getGrowthColor(stats.overview.patientGrowth)}>
                {stats.overview.patientGrowth > 0 ? '+' : ''}
                {stats.overview.patientGrowth.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">from last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Today's Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.todayAppointments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.overview.completedAppointmentsToday} completed, {stats.overview.pendingAppointments} pending
            </p>
          </CardContent>
        </Card>

        {/* This Month Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.overview.thisMonthRevenue)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getGrowthIcon(stats.overview.revenueGrowth)}
              <span className={getGrowthColor(stats.overview.revenueGrowth)}>
                {stats.overview.revenueGrowth > 0 ? '+' : ''}
                {stats.overview.revenueGrowth.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">from last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Pending Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.overview.pendingPayments)}</div>
            <p className="text-xs text-muted-foreground">
              Outstanding receivables
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Activity */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Last 7 days revenue trend</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {stats.charts.last7DaysRevenue && stats.charts.last7DaysRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={stats.charts.last7DaysRevenue.map((item: any) => ({
                    date: format(new Date(item.date), 'MMM dd'),
                    revenue: Number(item.revenue),
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''}
                    labelStyle={{ color: 'inherit' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                    name="Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No revenue data available</p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>Next 5 scheduled appointments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentActivity.upcomingAppointments && stats.recentActivity.upcomingAppointments.length > 0 ? (
                stats.recentActivity.upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="flex items-start gap-3 text-sm">
                    <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">{apt.patientName}</p>
                      <p className="text-muted-foreground text-xs">
                        {format(new Date(apt.date), 'MMM dd, yyyy HH:mm')} • {apt.doctorName}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No upcoming appointments</p>
              )}
            </div>
            <Link href="/appointments">
              <Button variant="outline" className="w-full mt-4">
                View All Appointments
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Appointment Status Chart */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appointments by Status</CardTitle>
            <CardDescription>This month's appointment distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.charts.appointmentsByStatus && stats.charts.appointmentsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.charts.appointmentsByStatus.map((item: any) => ({
                      name: item.status,
                      value: item.count,
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.charts.appointmentsByStatus.map((_: unknown, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No appointment data available</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue Trend</CardTitle>
            <CardDescription>Last 6 months revenue comparison</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.charts.last6MonthsRevenue && stats.charts.last6MonthsRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={stats.charts.last6MonthsRevenue.map((item: any) => ({
                    month: item.month,
                    revenue: Number(item.revenue),
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No revenue data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Top Procedures */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Top Procedures</CardTitle>
            <CardDescription>Most common procedures this month</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.charts.topProcedures && stats.charts.topProcedures.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={stats.charts.topProcedures.map((proc: any) => ({
                    name: proc.name.length > 20 ? proc.name.substring(0, 20) + '...' : proc.name,
                    count: Number(proc.count),
                    revenue: Number(proc.revenue),
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--chart-1))" />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-2))" />
                  <Tooltip
                    formatter={(value: number | undefined, name: string | undefined) => {
                      if (value === undefined) return '';
                      if (name === 'revenue') return formatCurrency(value);
                      return value;
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Count" />
                  <Bar yAxisId="right" dataKey="revenue" fill="#82ca9d" name="Revenue (₹)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No procedure data available</p>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>Items below minimum stock level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentActivity.lowStockItems && stats.recentActivity.lowStockItems.length > 0 ? (
                stats.recentActivity.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Min: {item.minimumStock} {item.unit}
                      </p>
                    </div>
                    <div className="text-red-600 font-medium">
                      {item.currentStock} {item.unit}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">All items in stock</p>
              )}
            </div>
            <Link href="/inventory">
              <Button variant="outline" className="w-full mt-4">
                View Inventory
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks you can do right now</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Link
            href="/patients/new"
            className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Add Patient</p>
              <p className="text-sm text-muted-foreground">Register new</p>
            </div>
          </Link>
          <Link
            href="/appointments/new"
            className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Book Appointment</p>
              <p className="text-sm text-muted-foreground">Schedule visit</p>
            </div>
          </Link>
          <Link
            href="/billing"
            className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Create Invoice</p>
              <p className="text-sm text-muted-foreground">Bill patient</p>
            </div>
          </Link>
          <Link
            href="/reports"
            className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">View Reports</p>
              <p className="text-sm text-muted-foreground">Analytics</p>
            </div>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
