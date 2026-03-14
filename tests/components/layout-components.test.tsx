// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks — shared across all describe blocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

const mockNavItems = [
  {
    title: 'Dashboard',
    items: [
      { title: 'Overview', href: '/dashboard', icon: React.forwardRef((p: any, r: any) => <svg {...p} ref={r} data-testid="icon-overview" />) },
      { title: 'Patients', href: '/patients', icon: React.forwardRef((p: any, r: any) => <svg {...p} ref={r} data-testid="icon-patients" />) },
    ],
  },
  {
    title: 'Operations',
    items: [
      { title: 'Appointments', href: '/appointments', icon: React.forwardRef((p: any, r: any) => <svg {...p} ref={r} data-testid="icon-appts" />), badge: '3' },
    ],
  },
]

vi.mock('@/config/nav', () => ({
  getNavigationForRole: vi.fn(() => mockNavItems),
}))

vi.mock('lucide-react', async (importOriginal) => {
  const icon = (name: string) =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement('svg', { ...props, ref, 'data-testid': `lucide-${name}` })
    )
  const actual = await importOriginal() as any
  const handler = { get: (_: any, p: string) => actual[p] || icon(p) }
  return new Proxy(actual, handler)
})

vi.mock('@radix-ui/react-visually-hidden', () => ({
  Root: ({ children }: any) => <span data-testid="visually-hidden">{children}</span>,
}))

const mockToggleSidebar = vi.fn()
const mockSetMobileOpen = vi.fn()
let mockIsCollapsed = false
let mockMobileOpen = false

vi.mock('@/components/layout/sidebar-context', () => ({
  SidebarProvider: ({ children }: any) => <div data-testid="sidebar-provider">{children}</div>,
  useSidebar: () => ({
    isCollapsed: mockIsCollapsed,
    toggleSidebar: mockToggleSidebar,
    mobileOpen: mockMobileOpen,
    setMobileOpen: mockSetMobileOpen,
  }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({ default: (props: any) => <img {...props} /> }))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div role="tooltip">{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: React.forwardRef(({ children, onClick, className, ...rest }: any, ref: any) => (
    <button onClick={onClick} className={className} ref={ref} {...rest}>{children}</button>
  )),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dialog" data-open={String(!!open)}>{open ? children : null}</div>
  ),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef((props: any, ref: any) => <input {...props} ref={ref} data-testid="input" />),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children, open, onOpenChange }: any) => <div data-testid="dropdown">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <div role="menuitem" onClick={onClick}>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
}))

// Router mock
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard',
}))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { Sidebar } from '@/components/layout/sidebar'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { GlobalSearch } from '@/components/layout/global-search'
import { NotificationTray } from '@/components/layout/notification-tray'

// ===================================================================
// Sidebar
// ===================================================================
describe('Sidebar', () => {
  beforeEach(() => {
    mockIsCollapsed = false
    mockMobileOpen = false
    vi.clearAllMocks()
  })

  it('renders hospital name when provided', () => {
    render(<Sidebar role="ADMIN" hospitalName="Test Clinic" />)
    expect(screen.getByText('Test Clinic')).toBeInTheDocument()
  })

  it('renders default name when hospitalName omitted', () => {
    render(<Sidebar role="ADMIN" />)
    expect(screen.getByText('Dental Clinic')).toBeInTheDocument()
  })

  it('renders all navigation items from config', () => {
    render(<Sidebar role="ADMIN" hospitalName="X" />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Patients')).toBeInTheDocument()
    expect(screen.getByText('Appointments')).toBeInTheDocument()
  })

  it('renders section titles', () => {
    render(<Sidebar role="ADMIN" hospitalName="X" />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Operations')).toBeInTheDocument()
  })

  it('renders navigation links with correct hrefs', () => {
    render(<Sidebar role="ADMIN" hospitalName="X" />)
    const links = screen.getAllByRole('link')
    const hrefs = links.map(l => l.getAttribute('href'))
    expect(hrefs).toContain('/dashboard')
    expect(hrefs).toContain('/patients')
    expect(hrefs).toContain('/appointments')
  })

  it('calls toggleSidebar on collapse button click', () => {
    render(<Sidebar role="ADMIN" hospitalName="X" />)
    // Find button with sr-only text "Collapse sidebar"
    const collapseBtn = screen.getByText('Collapse sidebar').closest('button')
    expect(collapseBtn).toBeInTheDocument()
    fireEvent.click(collapseBtn!)
    expect(mockToggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('shows expand button when collapsed', () => {
    mockIsCollapsed = true
    render(<Sidebar role="ADMIN" hospitalName="X" />)
    expect(screen.getAllByText('Expand sidebar').length).toBeGreaterThanOrEqual(1)
  })

  it('hides section titles when collapsed', () => {
    mockIsCollapsed = true
    render(<Sidebar role="ADMIN" hospitalName="X" />)
    // Section titles hidden when collapsed (not rendered)
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Operations')).not.toBeInTheDocument()
  })

  it('hides hospital name when collapsed', () => {
    mockIsCollapsed = true
    render(<Sidebar role="ADMIN" hospitalName="Test Clinic" />)
    expect(screen.queryByText('Test Clinic')).not.toBeInTheDocument()
  })

  it('shows badge on nav items', () => {
    render(<Sidebar role="ADMIN" hospitalName="X" />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders plan label when provided', () => {
    render(<Sidebar role="ADMIN" hospitalName="X" plan="PROFESSIONAL" />)
    expect(screen.getByText('Professional')).toBeInTheDocument()
  })

  it('renders Free Plan label', () => {
    render(<Sidebar role="ADMIN" hospitalName="X" plan="FREE" />)
    expect(screen.getByText('Free Plan')).toBeInTheDocument()
  })

  it('renders Enterprise plan label', () => {
    render(<Sidebar role="ADMIN" hospitalName="X" plan="ENTERPRISE" />)
    expect(screen.getByText('Enterprise')).toBeInTheDocument()
  })

  it('renders version in footer', () => {
    render(<Sidebar role="ADMIN" hospitalName="X" />)
    expect(screen.getByText('Dental ERP v1.0')).toBeInTheDocument()
  })

  it('shows short version when collapsed', () => {
    mockIsCollapsed = true
    render(<Sidebar role="ADMIN" hospitalName="X" />)
    expect(screen.getByText('v1.0')).toBeInTheDocument()
  })

  it('renders hospital logo image when provided', () => {
    render(<Sidebar role="ADMIN" hospitalName="X" hospitalLogo="/logo.png" />)
    const img = screen.getByAltText('X')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/logo.png')
  })

  it('renders initial letter when no logo', () => {
    render(<Sidebar role="ADMIN" hospitalName="Apex Dental" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })
})

// ===================================================================
// MobileSidebar
// ===================================================================
describe('MobileSidebar', () => {
  beforeEach(() => {
    mockIsCollapsed = false
    mockMobileOpen = true
    vi.clearAllMocks()
  })

  it('renders navigation items when open', () => {
    render(<MobileSidebar role="ADMIN" hospitalName="Test Clinic" />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Patients')).toBeInTheDocument()
    expect(screen.getByText('Appointments')).toBeInTheDocument()
  })

  it('shows hospital name', () => {
    render(<MobileSidebar role="ADMIN" hospitalName="Test Clinic" />)
    expect(screen.getByText('Test Clinic')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    mockMobileOpen = false
    const { container } = render(<MobileSidebar role="ADMIN" hospitalName="Test Clinic" />)
    expect(container.innerHTML).toBe('')
  })

  it('calls setMobileOpen(false) on close button click', () => {
    render(<MobileSidebar role="ADMIN" hospitalName="Test Clinic" />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(mockSetMobileOpen).toHaveBeenCalledWith(false)
  })

  it('closes on Escape key', () => {
    render(<MobileSidebar role="ADMIN" hospitalName="Test Clinic" />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mockSetMobileOpen).toHaveBeenCalledWith(false)
  })

  it('closes on backdrop click', () => {
    const { container } = render(<MobileSidebar role="ADMIN" hospitalName="Test Clinic" />)
    // Backdrop is the first child div inside the fixed overlay
    const backdrop = container.querySelector('.fixed.inset-0.bg-background\\/80')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(mockSetMobileOpen).toHaveBeenCalledWith(false)
    }
  })

  it('renders navigation links with correct hrefs', () => {
    render(<MobileSidebar role="ADMIN" hospitalName="Test Clinic" />)
    const links = screen.getAllByRole('link')
    const hrefs = links.map(l => l.getAttribute('href'))
    expect(hrefs).toContain('/dashboard')
    expect(hrefs).toContain('/patients')
    expect(hrefs).toContain('/appointments')
  })

  it('shows section titles', () => {
    render(<MobileSidebar role="ADMIN" hospitalName="Test Clinic" />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Operations')).toBeInTheDocument()
  })

  it('renders default name when hospitalName omitted', () => {
    render(<MobileSidebar role="ADMIN" />)
    expect(screen.getByText('Dental Clinic')).toBeInTheDocument()
  })
})

// ===================================================================
// GlobalSearch
// ===================================================================
describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ patients: [], appointments: [], invoices: [], staff: [], treatments: [] }),
    } as Response)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders search trigger buttons (desktop + mobile)', () => {
    render(<GlobalSearch />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('opens dialog on "/" keypress', async () => {
    render(<GlobalSearch />)
    await act(() => { fireEvent.keyDown(document, { key: '/' }) })
    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true')
  })

  it('does NOT open dialog when "/" pressed inside an input', async () => {
    const { container } = render(
      <div>
        <input data-testid="other-input" />
        <GlobalSearch />
      </div>
    )
    const otherInput = screen.getByTestId('other-input')
    otherInput.focus()
    fireEvent.keyDown(otherInput, { key: '/' })
    // Dialog should not open
    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'false')
  })

  it('opens dialog on trigger button click', async () => {
    render(<GlobalSearch />)
    const buttons = screen.getAllByRole('button')
    await act(() => { fireEvent.click(buttons[0]) })
    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true')
  })

  it('shows hint text when query is short', async () => {
    render(<GlobalSearch />)
    await act(() => { fireEvent.keyDown(document, { key: '/' }) })
    expect(screen.getByText(/Type at least 2 characters/)).toBeInTheDocument()
  })

  it('fetches search results after debounce', async () => {
    render(<GlobalSearch />)
    await act(() => { fireEvent.keyDown(document, { key: '/' }) })

    const input = screen.getByPlaceholderText(/Search patients/)
    await act(() => { fireEvent.change(input, { target: { value: 'John' } }) })

    // Advance past 300ms debounce
    await act(() => { vi.advanceTimersByTime(350) })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search?q=John')
    )
  })

  it('does not fetch when query is less than 2 chars', async () => {
    render(<GlobalSearch />)
    await act(() => { fireEvent.keyDown(document, { key: '/' }) })

    const input = screen.getByPlaceholderText(/Search patients/)
    await act(() => { fireEvent.change(input, { target: { value: 'J' } }) })
    await act(() => { vi.advanceTimersByTime(350) })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('displays grouped results', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        patients: [{ id: 'p1', label: 'John Doe', sublabel: '+91 9876543210', href: '/patients/p1' }],
        appointments: [],
        invoices: [],
        staff: [],
        treatments: [],
      }),
    } as Response)

    render(<GlobalSearch />)
    await act(() => { fireEvent.keyDown(document, { key: '/' }) })

    const input = screen.getByPlaceholderText(/Search patients/)
    await act(() => { fireEvent.change(input, { target: { value: 'John' } }) })
    await act(() => { vi.advanceTimersByTime(350) })

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Patients')).toBeInTheDocument()
      expect(screen.getByText('1 result')).toBeInTheDocument()
    })
  })

  it('shows no results message', async () => {
    render(<GlobalSearch />)
    await act(() => { fireEvent.keyDown(document, { key: '/' }) })

    const input = screen.getByPlaceholderText(/Search patients/)
    await act(() => { fireEvent.change(input, { target: { value: 'zzzzz' } }) })
    await act(() => { vi.advanceTimersByTime(350) })

    await waitFor(() => {
      expect(screen.getByText(/No results found/)).toBeInTheDocument()
    })
  })

  it('navigates on result click', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        patients: [{ id: 'p1', label: 'Jane', sublabel: 'test', href: '/patients/p1' }],
        appointments: [], invoices: [], staff: [], treatments: [],
      }),
    } as Response)

    render(<GlobalSearch />)
    await act(() => { fireEvent.keyDown(document, { key: '/' }) })
    const input = screen.getByPlaceholderText(/Search patients/)
    await act(() => { fireEvent.change(input, { target: { value: 'Jane' } }) })
    await act(() => { vi.advanceTimersByTime(350) })

    await waitFor(() => expect(screen.getByText('Jane')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Jane').closest('button')!)

    expect(mockPush).toHaveBeenCalledWith('/patients/p1')
  })

  it('supports keyboard navigation (ArrowDown, Enter)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        patients: [{ id: 'p1', label: 'Alice', sublabel: 's', href: '/patients/p1' }],
        appointments: [], invoices: [], staff: [], treatments: [],
      }),
    } as Response)

    render(<GlobalSearch />)
    await act(() => { fireEvent.keyDown(document, { key: '/' }) })
    const input = screen.getByPlaceholderText(/Search patients/)
    await act(() => { fireEvent.change(input, { target: { value: 'Alice' } }) })
    await act(() => { vi.advanceTimersByTime(350) })

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockPush).toHaveBeenCalledWith('/patients/p1')
  })
})

// ===================================================================
// NotificationTray
// ===================================================================
describe('NotificationTray', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: [], unreadCount: 0 }),
    } as Response)
  })

  it('renders bell button with sr-only label', async () => {
    render(<NotificationTray />)
    // "Notifications" appears as sr-only + dropdown label
    expect(screen.getAllByText('Notifications').length).toBeGreaterThanOrEqual(1)
  })

  it('fetches notifications on mount', async () => {
    render(<NotificationTray />)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications')
      )
    })
  })

  it('shows notification titles after fetch', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [
          { id: 'n1', title: 'New Appointment', message: 'Dr Smith at 3 PM', type: 'APPOINTMENT', isRead: false, createdAt: new Date().toISOString() },
        ],
        unreadCount: 1,
      }),
    } as Response)

    render(<NotificationTray />)
    await waitFor(() => {
      expect(screen.getByText('New Appointment')).toBeInTheDocument()
      expect(screen.getByText('Dr Smith at 3 PM')).toBeInTheDocument()
    })
  })

  it('shows "Mark all read" button when there are unread notifications', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [
          { id: 'n1', title: 'Alert', message: 'msg', type: 'INFO', isRead: false, createdAt: new Date().toISOString() },
        ],
        unreadCount: 1,
      }),
    } as Response)

    render(<NotificationTray />)
    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument()
    })
  })

  it('shows empty state when no notifications', async () => {
    render(<NotificationTray />)
    await waitFor(() => {
      expect(screen.getByText('No notifications yet')).toBeInTheDocument()
    })
  })

  it('handles fetch error gracefully without crashing', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
    render(<NotificationTray />)
    // Should not throw — renders the bell button
    expect(screen.getAllByText('Notifications').length).toBeGreaterThanOrEqual(1)
  })

  it('calls mark-as-read API when clicking unread notification', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notifications: [
            { id: 'n1', title: 'Test', message: 'msg', type: 'INFO', isRead: false, createdAt: new Date().toISOString() },
          ],
          unreadCount: 1,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unreadCount: 0 }),
      } as Response)

    render(<NotificationTray />)
    await waitFor(() => expect(screen.getByText('Test')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Test').closest('button')!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/notifications', expect.objectContaining({
        method: 'PUT',
      }))
    })
  })

  it('calls mark-all-read API when clicking Mark all read', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notifications: [
            { id: 'n1', title: 'A', message: 'm', type: 'INFO', isRead: false, createdAt: new Date().toISOString() },
          ],
          unreadCount: 1,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unreadCount: 0 }),
      } as Response)

    render(<NotificationTray />)
    await waitFor(() => expect(screen.getByText('Mark all read')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Mark all read'))

    await waitFor(() => {
      const putCalls = vi.mocked(global.fetch).mock.calls.filter(c => c[1]?.method === 'PUT')
      expect(putCalls.length).toBeGreaterThan(0)
      const body = JSON.parse(putCalls[0][1].body)
      expect(body.all).toBe(true)
    })
  })

  it('shows unread count badge', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [
          { id: 'n1', title: 'X', message: 'Y', type: 'SYSTEM', isRead: false, createdAt: new Date().toISOString() },
        ],
        unreadCount: 5,
      }),
    } as Response)

    render(<NotificationTray />)
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })
  })

  it('shows 9+ for unreadCount > 9', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [],
        unreadCount: 15,
      }),
    } as Response)

    render(<NotificationTray />)
    await waitFor(() => {
      expect(screen.getByText('9+')).toBeInTheDocument()
    })
  })
})
