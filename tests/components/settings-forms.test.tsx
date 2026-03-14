// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn()
const mockToast = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/settings/clinic',
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

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

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, ...props }: any) => (
    <button disabled={disabled} {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef((props: any, ref: any) => <input ref={ref} {...props} />),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef((props: any, ref: any) => <textarea ref={ref} {...props} />),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      role="switch"
      checked={checked || false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clinicData = (overrides = {}) => ({
  success: true,
  data: {
    name: 'Demo Dental Clinic',
    tagline: 'Best dental care',
    phone: '9876543210',
    alternatePhone: '',
    email: 'dev@dental.com',
    website: 'https://demo-dental.com',
    address: '123 Main St',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    slug: 'dr-dev-dental',
    logo: null,
    registrationNo: 'REG001',
    gstNumber: '29ABCDE1234F1Z5',
    panNumber: 'ABCDE1234F',
    workingHours: null,
    bankName: 'HDFC Bank',
    bankAccountNo: '1234567890',
    bankIfsc: 'HDFC0001234',
    upiId: 'clinic@upi',
    patientPortalEnabled: false,
    ...overrides,
  },
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import ClinicSettingsPage from '@/app/(dashboard)/settings/clinic/page'

describe('ClinicSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any) = vi.fn()
  })

  describe('Loading state', () => {
    it('shows loading text while fetching', () => {
      ;(global.fetch as any).mockImplementation(() => new Promise(() => {}))
      render(<ClinicSettingsPage />)
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('calls /api/settings/clinic on mount', () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })
      render(<ClinicSettingsPage />)
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/clinic')
    })
  })

  describe('Initial rendering', () => {
    it('renders page heading after data loads', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clinic Information')).toBeInTheDocument()
      })
    })

    it('renders clinic form fields with fetched data', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Demo Dental Clinic')).toBeInTheDocument()
      })

      expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument()
      expect(screen.getByDisplayValue('dev@dental.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Chennai')).toBeInTheDocument()
      expect(screen.getByDisplayValue('REG001')).toBeInTheDocument()
    })

    it('shows error toast on fetch failure', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            description: 'Failed to load clinic information',
          })
        )
      })
    })
  })

  describe('Form sections', () => {
    it('renders clinic logo section', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clinic Logo')).toBeInTheDocument()
      })
    })

    it('renders clinic information heading', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clinic Information')).toBeInTheDocument()
      })
    })
  })

  describe('Form field rendering', () => {
    it('renders website field', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('https://demo-dental.com')).toBeInTheDocument()
      })
    })

    it('renders GST number field', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('29ABCDE1234F1Z5')).toBeInTheDocument()
      })
    })

    it('renders bank details fields', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('HDFC Bank')).toBeInTheDocument()
      })
      expect(screen.getByDisplayValue('1234567890')).toBeInTheDocument()
      expect(screen.getByDisplayValue('HDFC0001234')).toBeInTheDocument()
    })

    it('renders UPI ID field', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('clinic@upi')).toBeInTheDocument()
      })
    })

    it('renders tagline field', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Best dental care')).toBeInTheDocument()
      })
    })
  })

  describe('Working hours schedule', () => {
    it('renders day-of-week schedule fields', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Monday')).toBeInTheDocument()
      })

      expect(screen.getByText('Tuesday')).toBeInTheDocument()
      expect(screen.getByText('Wednesday')).toBeInTheDocument()
      expect(screen.getByText('Thursday')).toBeInTheDocument()
      expect(screen.getByText('Friday')).toBeInTheDocument()
      expect(screen.getByText('Saturday')).toBeInTheDocument()
      expect(screen.getByText('Sunday')).toBeInTheDocument()
    })
  })

  describe('Save functionality', () => {
    it('sends form data to API on save', async () => {
      ;(global.fetch as any).mockImplementation((url: string, opts?: any) => {
        if (opts?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(clinicData()),
        })
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Demo Dental Clinic')).toBeInTheDocument()
      })

      // Change the clinic name
      const nameInput = screen.getByDisplayValue('Demo Dental Clinic')
      fireEvent.change(nameInput, { target: { value: 'Updated Clinic' } })

      // Click save
      const saveButton = screen.getAllByRole('button').find(b => b.textContent?.includes('Save'))
      expect(saveButton).toBeDefined()
      fireEvent.click(saveButton!)

      await waitFor(() => {
        const postCalls = (global.fetch as any).mock.calls.filter(
          (c: any) => c[1]?.method === 'POST'
        )
        expect(postCalls.length).toBeGreaterThan(0)
      })
    })

    it('shows success toast on save', async () => {
      ;(global.fetch as any).mockImplementation((url: string, opts?: any) => {
        if (opts?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(clinicData()),
        })
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Demo Dental Clinic')).toBeInTheDocument()
      })

      const saveButton = screen.getAllByRole('button').find(b => b.textContent?.includes('Save'))
      fireEvent.click(saveButton!)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Success',
            description: 'Clinic information saved successfully',
          })
        )
      })
    })

    it('shows error toast on save failure', async () => {
      ;(global.fetch as any).mockImplementation((url: string, opts?: any) => {
        if (opts?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Save failed' }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(clinicData()),
        })
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Demo Dental Clinic')).toBeInTheDocument()
      })

      const saveButton = screen.getAllByRole('button').find(b => b.textContent?.includes('Save'))
      fireEvent.click(saveButton!)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        )
      })
    })
  })

  describe('Logo', () => {
    it('shows initial placeholder when no logo', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData({ logo: null })),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Clinic Logo')).toBeInTheDocument()
      })

      // Should have Upload Logo button
      const uploadButton = screen.getAllByRole('button').find(b => b.textContent?.match(/Upload|Change/i))
      expect(uploadButton).toBeDefined()
    })

    it('shows logo image when logo URL exists', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData({ logo: '/uploads/logo.png' })),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        const img = screen.getByAltText('Clinic logo')
        expect(img).toBeInTheDocument()
        expect(img).toHaveAttribute('src', '/uploads/logo.png')
      })
    })
  })

  describe('Patient portal toggle', () => {
    it('renders patient portal switch', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData({ patientPortalEnabled: false })),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getAllByText(/Patient Portal/i).length).toBeGreaterThan(0)
      })

      // Should have a switch for the toggle
      const switches = screen.getAllByRole('switch')
      expect(switches.length).toBeGreaterThan(0)
    })
  })

  describe('Field editing', () => {
    it('allows editing form fields', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(clinicData()),
      })

      render(<ClinicSettingsPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Demo Dental Clinic')).toBeInTheDocument()
      })

      const nameInput = screen.getByDisplayValue('Demo Dental Clinic')
      fireEvent.change(nameInput, { target: { value: 'New Clinic Name' } })
      expect(screen.getByDisplayValue('New Clinic Name')).toBeInTheDocument()

      const emailInput = screen.getByDisplayValue('dev@dental.com')
      fireEvent.change(emailInput, { target: { value: 'new@dental.com' } })
      expect(screen.getByDisplayValue('new@dental.com')).toBeInTheDocument()
    })
  })
})
