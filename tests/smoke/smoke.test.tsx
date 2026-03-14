// @ts-nocheck
/**
 * Smoke Tests (Section 1.5) — Verify that all major pages render without crashing.
 * These are lightweight component-level render tests (Vitest + RTL) rather than
 * full Playwright E2E tests, so they run fast and don't need a live server.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
}))

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({
    data: {
      user: { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'ADMIN', hospitalId: 'h1' },
    },
    status: 'authenticated',
  }),
  SessionProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn(), themes: ['light', 'dark'] }),
  ThemeProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: () => ({}),
    handleSubmit: (fn: any) => (e: any) => { e?.preventDefault?.(); fn({}) },
    formState: { errors: {}, isSubmitting: false },
    watch: () => '',
    setValue: vi.fn(),
    reset: vi.fn(),
    getValues: () => ({}),
    control: {},
  }),
  Controller: ({ render: renderProp }: any) => renderProp?.({ field: { value: '', onChange: vi.fn() }, fieldState: {} }) ?? null,
}))

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}))

// Mock recharts to avoid canvas/svg issues in jsdom
vi.mock('recharts', () => {
  const Noop = ({ children }: any) => <div data-testid="chart">{children}</div>
  return {
    ResponsiveContainer: Noop,
    LineChart: Noop,
    Line: () => null,
    BarChart: Noop,
    Bar: () => null,
    PieChart: Noop,
    Pie: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    AreaChart: Noop,
    Area: () => null,
  }
})

vi.mock('@/lib/chart-theme', () => ({
  CHART_COLORS: ['#000', '#111', '#222', '#333', '#444'],
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }),
}))

vi.mock('@/components/ai/ai-provider', () => ({
  useAI: () => ({
    messages: [],
    chatMessages: [],
    chatLoading: false,
    sendChat: vi.fn(),
    clearChat: vi.fn(),
    executeCommand: vi.fn(),
    insights: [],
    suggestions: [],
    loadInsights: vi.fn(),
    loadSuggestions: vi.fn(),
    dismissInsight: vi.fn(),
    generateInsights: vi.fn(),
    isLoading: false,
  }),
  AIProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/hooks/use-web-voice', () => ({
  useWebVoice: () => ({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    startListening: vi.fn(),
    stopListening: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    isSupported: false,
  }),
}))

vi.mock('@/components/ui/export-menu', () => ({
  ExportMenu: () => <button>Export</button>,
}))

vi.mock('@/components/ai/insights-panel', () => ({
  InsightsPanel: () => <div data-testid="insights-panel">Insights</div>,
}))

vi.mock('@/components/ai/voice-orb', () => ({
  VoiceOrb: () => <div data-testid="voice-orb" />,
}))

vi.mock('@/components/ai/audio-waveform', () => ({
  AudioWaveform: () => <div data-testid="audio-waveform" />,
}))

vi.mock('lucide-react', async (importOriginal) => {
  const icon = (name: string) =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement('svg', { ...props, ref, 'data-testid': `lucide-${name}` })
    )
  const actual = (await importOriginal()) as any
  const handler = { get: (_: any, p: string) => actual[p] || icon(p) }
  return new Proxy(actual, handler)
})

// URL-aware fetch mock — each page gets the right response shape
const responseLookup: Record<string, any> = {
  '/api/dashboard/stats': {
    overview: {
      totalPatients: 50, newPatientsThisMonth: 5, patientGrowth: 10,
      todayAppointments: 8, thisMonthAppointments: 120, appointmentGrowth: 5,
      pendingAppointments: 3, completedAppointmentsToday: 4,
      thisMonthRevenue: 50000, todayRevenue: 8000, revenueGrowth: 12,
      pendingPayments: 15000, totalRevenue: 500000,
    },
    charts: { last7DaysRevenue: [], last6MonthsRevenue: [], appointmentsByStatus: [], topProcedures: [] },
    recentActivity: { upcomingAppointments: [], lowStockItems: [] },
  },
  '/api/crm/dashboard': {
    memberships: { active: 0, total: 0, revenue: 0 },
    referrals: { total: 0, converted: 0, rewarded: 0, conversionRate: '0%' },
    loyalty: { pointsInCirculation: 0 },
    retention: { totalActive: 0, recentVisitors: 0, rate: '0%', atRisk: 0 },
  },
  '/api/video/consultations': {
    consultations: [],
    totalPages: 0,
    summary: { scheduled: 0, inProgress: 0, completed: 0, cancelled: 0 },
  },
  '/api/lab-orders': {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  },
  '/api/reports/analytics': {
    newPatients: 0, returningPatients: 0, totalPatients: 0, retentionRate: 0,
    demographics: { male: 0, female: 0, other: 0 },
    ageGroups: [], acquisitionSources: [],
    totalTreatments: 0, completedTreatments: 0, inProgressTreatments: 0,
    completionRate: 0, avgTreatmentDuration: 0, commonProcedures: [], proceduresByCategory: [],
    totalRevenue: 0, totalExpenses: 0, profitMargin: 0, avgBillValue: 0,
    collectionEfficiency: 0, revenueByMonth: [], paymentMethodBreakdown: [], outstandingAmount: 0,
    totalAppointments: 0, completedAppointments: 0, cancelledAppointments: 0,
    noShowCount: 0, noShowRate: 0, appointmentUtilization: 0, avgWaitTime: 0,
    staffProductivity: [], inventoryTurnover: 0, lowStockItems: 0,
  },
  '/api/prescriptions': {
    success: true, data: [], pagination: { page: 1, total: 0, pages: 0 },
  },
  '/api/medications': {
    success: true, data: [], pagination: { page: 1, total: 0, pages: 0 },
  },
  '/api/medications/categories': {
    success: true, data: [],
  },
  '/api/sterilization/instruments': { instruments: [] },
  '/api/sterilization/logs': { logs: [] },
  '/api/devices/status': {
    devices: [],
    summary: { total: 0, online: 0, offline: 0, error: 0, maintenance: 0 },
  },
  '/api/onboarding': {
    name: 'Test Clinic', onboardingCompleted: false,
    address: '', city: '', state: '', pincode: '', workingHours: '{}',
  },
  '/api/billing/reports': {
    summary: {
      totalBilled: 0, totalDiscounts: 0, invoiceCount: 0, totalCollected: 0,
      paymentCount: 0, totalOutstanding: 0, outstandingInvoices: 0,
      insuranceClaimed: 0, insuranceSettled: 0, insuranceClaimCount: 0,
    },
    breakdowns: { byPaymentMethod: [], byInvoiceStatus: [] },
    aging: { current: { amount: 0, count: 0 }, days1_30: { amount: 0, count: 0 }, days31_60: { amount: 0, count: 0 }, days61_90: { amount: 0, count: 0 }, over90: { amount: 0, count: 0 } },
    totals: { totalOutstanding: 0, totalOverdue: 0, totalCurrent: 0 },
    invoices: [], payments: [], total: 0, page: 1, limit: 10,
  },
  '/api/treatments': {
    treatments: [],
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  },
  '/api/staff': {
    staff: [],
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  },
  '/api/inventory/items': {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    stats: { totalItems: 0, lowStock: 0, expiringSoon: 0, totalValue: 0 },
  },
  '/api/inventory/categories': {
    data: [],
  },
}

// Default fallback for any unmatched URL
const defaultResponse = {
  patients: [], appointments: [], invoices: [], items: [], staff: [],
  data: [], total: 0, page: 1, limit: 10, doctors: [], consultations: [],
  instruments: [], logs: [], devices: [], medications: [], prescriptions: [],
  success: true,
  pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  totalPages: 0,
  summary: {
    totalBilled: 0, totalDiscounts: 0, invoiceCount: 0, totalCollected: 0,
    paymentCount: 0, totalOutstanding: 0, outstandingInvoices: 0,
    insuranceClaimed: 0, insuranceSettled: 0, insuranceClaimCount: 0,
    total: 0, online: 0, offline: 0, error: 0, maintenance: 0,
    scheduled: 0, inProgress: 0, completed: 0, cancelled: 0,
  },
}

const mockFetch = vi.fn().mockImplementation((url: string) => {
  // Find matching response by longest URL prefix match
  const urlPath = url.split('?')[0]
  const match = Object.keys(responseLookup)
    .filter((key) => urlPath.includes(key))
    .sort((a, b) => b.length - a.length)[0]
  const body = match ? responseLookup[match] : defaultResponse
  return Promise.resolve({
    ok: true,
    json: async () => ({ ...body }),
    text: async () => JSON.stringify(body),
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = mockFetch as any
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render a page and confirm no uncaught error */
async function smokeRender(Component: React.ComponentType) {
  const { container } = render(<Component />)
  // Wait for any useEffect-driven state updates
  await waitFor(() => {
    expect(container.innerHTML.length).toBeGreaterThan(0)
  })
  return container
}

// ---------------------------------------------------------------------------
// 1.5 Smoke Tests
// ---------------------------------------------------------------------------

describe('Smoke Tests — Pages render without crashing', () => {
  it('Login page loads', async () => {
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    const container = await smokeRender(LoginPage)
    // Should have a form or card
    expect(container.querySelector('form, [class*="card"], input')).toBeTruthy()
  })

  it('Dashboard loads after auth', async () => {
    const { default: DashboardPage } = await import('@/app/(dashboard)/dashboard/page')
    const container = await smokeRender(DashboardPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Patients list loads', async () => {
    const { default: PatientsPage } = await import('@/app/(dashboard)/patients/page')
    const container = await smokeRender(PatientsPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Appointments list loads', async () => {
    const { default: AppointmentsPage } = await import('@/app/(dashboard)/appointments/page')
    const container = await smokeRender(AppointmentsPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Billing page loads', async () => {
    const { default: BillingPage } = await import('@/app/(dashboard)/billing/page')
    const container = await smokeRender(BillingPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Inventory page loads', async () => {
    const { default: InventoryPage } = await import('@/app/(dashboard)/inventory/page')
    const container = await smokeRender(InventoryPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Settings page loads', async () => {
    const { default: SettingsPage } = await import('@/app/(dashboard)/settings/page')
    const container = await smokeRender(SettingsPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('AI chat page loads', async () => {
    const { default: ChatPage } = await import('@/app/(dashboard)/chat/page')
    const container = await smokeRender(ChatPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Patient portal login page loads', async () => {
    const { default: PortalLoginPage } = await import('@/app/portal/login/page')
    const container = await smokeRender(PortalLoginPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Staff page loads', async () => {
    const { default: StaffPage } = await import('@/app/(dashboard)/staff/page')
    const container = await smokeRender(StaffPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Treatments page loads', async () => {
    const { default: TreatmentsPage } = await import('@/app/(dashboard)/treatments/page')
    const container = await smokeRender(TreatmentsPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Lab page loads', async () => {
    const { default: LabPage } = await import('@/app/(dashboard)/lab/page')
    const container = await smokeRender(LabPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Reports page loads', async () => {
    const { default: ReportsPage } = await import('@/app/(dashboard)/reports/page')
    const container = await smokeRender(ReportsPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Communications page loads', async () => {
    const { default: CommunicationsPage } = await import('@/app/(dashboard)/communications/page')
    const container = await smokeRender(CommunicationsPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Prescriptions page loads', async () => {
    const { default: PrescriptionsPage } = await import('@/app/(dashboard)/prescriptions/page')
    const container = await smokeRender(PrescriptionsPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Medications page loads', async () => {
    const { default: MedicationsPage } = await import('@/app/(dashboard)/medications/page')
    const container = await smokeRender(MedicationsPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('CRM page loads', async () => {
    const { default: CRMPage } = await import('@/app/(dashboard)/crm/page')
    const container = await smokeRender(CRMPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Sterilization page loads', async () => {
    const { default: SterilizationPage } = await import('@/app/(dashboard)/sterilization/page')
    const container = await smokeRender(SterilizationPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Devices page loads', async () => {
    const { default: DevicesPage } = await import('@/app/(dashboard)/devices/page')
    const container = await smokeRender(DevicesPage)
    expect(container.innerHTML).toBeTruthy()
  })

  it('Video page loads', async () => {
    const { default: VideoPage } = await import('@/app/(dashboard)/video/page')
    const container = await smokeRender(VideoPage)
    expect(container.innerHTML).toBeTruthy()
  })
})
