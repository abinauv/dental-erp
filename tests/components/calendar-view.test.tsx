// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
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

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span data-testid="badge" className={className}>{children}</span>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="view-mode-select">
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as any, { onValueChange, value }) : child
      )}
    </div>
  ),
  SelectTrigger: ({ children, className }: any) => <div data-testid="select-trigger" className={className}>{children}</div>,
  SelectValue: () => <span data-testid="select-value" />,
  SelectContent: ({ children, onValueChange }: any) => (
    <div data-testid="select-content">
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as any, { onValueChange }) : child
      )}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange }: any) => (
    <div data-testid={`select-item-${value}`} onClick={() => onValueChange?.(value)} role="option">
      {children}
    </div>
  ),
}))

vi.mock('@/lib/appointment-utils', () => ({
  appointmentStatusConfig: {
    SCHEDULED: { label: 'Scheduled', bgColor: 'bg-blue-100' },
    CONFIRMED: { label: 'Confirmed', bgColor: 'bg-green-100' },
    CHECKED_IN: { label: 'Checked In', bgColor: 'bg-yellow-100' },
    COMPLETED: { label: 'Completed', bgColor: 'bg-emerald-100' },
    CANCELLED: { label: 'Cancelled', bgColor: 'bg-red-100' },
    NO_SHOW: { label: 'No Show', bgColor: 'bg-gray-100' },
  },
  formatTime: (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${ampm}`
  },
  getPatientName: (p: any) => `${p.firstName} ${p.lastName}`,
  getDoctorName: (d: any) => `Dr. ${d.firstName} ${d.lastName}`,
}))

import { CalendarView } from '@/components/appointments/calendar-view'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockAppointments = [
  {
    id: 'apt-1',
    appointmentNo: 'APT-001',
    scheduledDate: '2025-06-15',
    scheduledTime: '09:00',
    duration: 30,
    appointmentType: 'CHECKUP',
    status: 'SCHEDULED',
    patient: { firstName: 'John', lastName: 'Doe', phone: '9876543210' },
    doctor: { firstName: 'Sarah', lastName: 'Smith' },
  },
  {
    id: 'apt-2',
    appointmentNo: 'APT-002',
    scheduledDate: '2025-06-15',
    scheduledTime: '10:00',
    duration: 60,
    appointmentType: 'TREATMENT',
    status: 'CONFIRMED',
    patient: { firstName: 'Jane', lastName: 'Roe', phone: '9876543211' },
    doctor: { firstName: 'Mike', lastName: 'Jones' },
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalendarView', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = vi.fn()
    global.fetch = fetchMock
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ appointments: [] }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    expect(screen.getByText('Loading calendar...')).toBeInTheDocument()
  })

  it('renders Today button', async () => {
    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('renders view mode selector with Day/Week/Month', async () => {
    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    expect(screen.getByText('Day')).toBeInTheDocument()
    expect(screen.getByText('Week')).toBeInTheDocument()
    expect(screen.getByText('Month')).toBeInTheDocument()
  })

  it('defaults to week view', async () => {
    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    await waitFor(() => {
      // Week view shows day of week headers
      expect(screen.queryByText('Loading calendar...')).not.toBeInTheDocument()
    })
    // Fetch should include view=week
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('view=week')
    )
  })

  it('fetches appointments on mount', async () => {
    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/appointments')
      )
    })
  })

  it('renders navigation buttons (previous/next)', async () => {
    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    // ChevronLeft and ChevronRight are actual lucide icons, so they render but without test IDs
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(3) // prev, next, Today
  })

  it('switches to day view', async () => {
    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    await waitFor(() => {
      expect(screen.queryByText('Loading calendar...')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('select-item-day'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('view=day')
      )
    })
  })

  it('switches to month view', async () => {
    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    await waitFor(() => {
      expect(screen.queryByText('Loading calendar...')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('select-item-month'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('view=month')
      )
    })
  })

  it('renders status legend', async () => {
    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    await waitFor(() => {
      expect(screen.getByText('Scheduled')).toBeInTheDocument()
      expect(screen.getByText('Confirmed')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Cancelled')).toBeInTheDocument()
    })
  })

  it('renders month view with day-of-week headers', async () => {
    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    await waitFor(() => {
      expect(screen.queryByText('Loading calendar...')).not.toBeInTheDocument()
    })

    // Switch to month view
    fireEvent.click(screen.getByTestId('select-item-month'))

    await waitFor(() => {
      expect(screen.getByText('Sun')).toBeInTheDocument()
      expect(screen.getByText('Mon')).toBeInTheDocument()
      expect(screen.getByText('Tue')).toBeInTheDocument()
      expect(screen.getByText('Wed')).toBeInTheDocument()
      expect(screen.getByText('Thu')).toBeInTheDocument()
      expect(screen.getByText('Fri')).toBeInTheDocument()
      expect(screen.getByText('Sat')).toBeInTheDocument()
    })
  })

  it('renders appointments in week view', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ appointments: mockAppointments }),
    })

    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument()
    })
  })

  it('renders time slots in day view', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ appointments: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ appointments: mockAppointments }) })

    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    await waitFor(() => {
      expect(screen.queryByText('Loading calendar...')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('select-item-day'))

    await waitFor(() => {
      // Time slots formatted by our mock formatTime
      expect(screen.getAllByText(/AM|PM/).length).toBeGreaterThan(0)
    })
  })

  it('shows "+N more" for days with many appointments in month view', async () => {
    const manyAppointments = Array.from({ length: 5 }, (_, i) => ({
      ...mockAppointments[0],
      id: `apt-${i}`,
      scheduledTime: `0${9 + i}:00`.slice(-5),
      patient: { firstName: `Patient${i}`, lastName: 'Test', phone: '123' },
    }))

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ appointments: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ appointments: manyAppointments }) })

    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    await waitFor(() => {
      expect(screen.queryByText('Loading calendar...')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('select-item-month'))

    await waitFor(() => {
      expect(screen.getByText('+2 more')).toBeInTheDocument()
    })
  })

  it('navigates to appointment on click in day view', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ appointments: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ appointments: mockAppointments }) })

    render(<CalendarView initialDate={new Date('2025-06-15')} />)
    await waitFor(() => {
      expect(screen.queryByText('Loading calendar...')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('select-item-day'))

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('John Doe'))
    expect(mockPush).toHaveBeenCalledWith('/appointments/apt-1')
  })
})
