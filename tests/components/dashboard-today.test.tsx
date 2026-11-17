// @ts-nocheck
// The dashboard's "Today's appointments" card: the subtitle counts today's
// appointments still to be seen, not every booking from tomorrow on.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard',
}))

// Charts and AI insights have their own tests; they need a canvas and the AI
// provider, which this check doesn't.
vi.mock('recharts', () => {
  const Noop = ({ children }) => <div>{children}</div>
  const names =
    'LineChart Line BarChart Bar PieChart Pie Cell XAxis YAxis CartesianGrid Tooltip Legend ResponsiveContainer'
  return Object.fromEntries(names.split(' ').map((name) => [name, Noop]))
})
vi.mock('@/components/ai/insights-panel', () => ({ InsightsPanel: () => null }))

import DashboardPage from '@/app/(dashboard)/dashboard/page'

const stats = {
  overview: {
    totalPatients: 50,
    newPatientsThisMonth: 5,
    patientGrowth: 10,
    todayAppointments: 9,
    thisMonthAppointments: 120,
    appointmentGrowth: 5,
    // Booked from tomorrow on: not part of today's card.
    pendingAppointments: 37,
    completedAppointmentsToday: 4,
    pendingAppointmentsToday: 3,
    thisMonthRevenue: 50000,
    todayRevenue: 8000,
    revenueGrowth: 12,
    pendingPayments: 15000,
    totalRevenue: 500000,
  },
  charts: {
    last7DaysRevenue: [],
    last6MonthsRevenue: [],
    appointmentsByStatus: [],
    topProcedures: [],
  },
  recentActivity: { upcomingAppointments: [], lowStockItems: [] },
}

describe("dashboard: today's appointments", () => {
  it('shows completed and still-to-be-seen counts for today', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: stats }),
    }))
    render(<DashboardPage />)
    expect(await screen.findByText('4 completed, 3 pending')).toBeInTheDocument()
    expect(screen.queryByText(/37 pending/)).not.toBeInTheDocument()
  })
})
