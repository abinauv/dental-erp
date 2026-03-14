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
  usePathname: () => '/staff/new',
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

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select-root" data-value={value}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as any, { onValueChange }) : child
      )}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div data-testid="select-content">
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as any, { onValueChange }) : child
      )}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange }: any) => (
    <div data-testid={`select-item-${value}`} onClick={() => onValueChange?.(value)}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

import NewStaffPage from '@/app/(dashboard)/staff/new/page'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewStaffPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any) = vi.fn()
  })

  describe('Initial rendering', () => {
    it('renders the page heading', () => {
      render(<NewStaffPage />)
      expect(screen.getByText('Add New Staff')).toBeInTheDocument()
      expect(screen.getByText('Create a new staff member account')).toBeInTheDocument()
    })

    it('renders all form sections', () => {
      render(<NewStaffPage />)
      expect(screen.getByText('Account Information')).toBeInTheDocument()
      expect(screen.getByText('Contact Information')).toBeInTheDocument()
      expect(screen.getByText('Personal Details')).toBeInTheDocument()
      expect(screen.getByText('Professional Details')).toBeInTheDocument()
      expect(screen.getByText('Financial Details')).toBeInTheDocument()
      expect(screen.getByText('Emergency Contact')).toBeInTheDocument()
    })

    it('renders required fields with asterisks', () => {
      render(<NewStaffPage />)
      expect(screen.getByText('First Name *')).toBeInTheDocument()
      expect(screen.getByText('Last Name *')).toBeInTheDocument()
      expect(screen.getByText('Email *')).toBeInTheDocument()
      expect(screen.getByText('Password *')).toBeInTheDocument()
      expect(screen.getByText('Role *')).toBeInTheDocument()
      expect(screen.getByText('Phone Number *')).toBeInTheDocument()
    })

    it('renders role options', () => {
      render(<NewStaffPage />)
      expect(screen.getByTestId('select-item-ADMIN')).toBeInTheDocument()
      expect(screen.getByTestId('select-item-DOCTOR')).toBeInTheDocument()
      expect(screen.getByTestId('select-item-RECEPTIONIST')).toBeInTheDocument()
      expect(screen.getByTestId('select-item-LAB_TECH')).toBeInTheDocument()
      expect(screen.getByTestId('select-item-ACCOUNTANT')).toBeInTheDocument()
    })

    it('renders submit and cancel buttons', () => {
      render(<NewStaffPage />)
      expect(screen.getByText('Create Staff Member')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('has cancel link pointing to /staff', () => {
      render(<NewStaffPage />)
      const cancelLink = screen.getByText('Cancel').closest('a')
      expect(cancelLink).toHaveAttribute('href', '/staff')
    })

    it('has back button linking to /staff', () => {
      render(<NewStaffPage />)
      const links = screen.getAllByRole('link')
      const staffLink = links.find(l => l.getAttribute('href') === '/staff')
      expect(staffLink).toBeDefined()
    })
  })

  describe('Form fields', () => {
    it('renders all input fields', () => {
      render(<NewStaffPage />)
      expect(screen.getByPlaceholderText('Enter first name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter last name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('staff@yourclinic.com')).toBeInTheDocument()
      expect(screen.getByLabelText('Password *')).toBeInTheDocument()
      // Phone placeholder appears 3 times (phone, alternatePhone, emergencyPhone)
      expect(screen.getAllByPlaceholderText('+91 98765 43210').length).toBe(3)
    })

    it('renders optional professional fields', () => {
      render(<NewStaffPage />)
      expect(screen.getByPlaceholderText('BDS, MDS')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Orthodontics, Endodontics')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('TN/12345')).toBeInTheDocument()
    })

    it('renders financial fields', () => {
      render(<NewStaffPage />)
      expect(screen.getByPlaceholderText('50000')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('1234567890')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('HDFC0001234')).toBeInTheDocument()
    })

    it('renders document fields (Aadhar, PAN)', () => {
      render(<NewStaffPage />)
      expect(screen.getByPlaceholderText('1234 5678 9012')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('ABCDE1234F')).toBeInTheDocument()
    })

    it('renders emergency contact fields', () => {
      render(<NewStaffPage />)
      expect(screen.getByPlaceholderText('Full name')).toBeInTheDocument()
    })

    it('renders gender select with options', () => {
      render(<NewStaffPage />)
      expect(screen.getByTestId('select-item-MALE')).toBeInTheDocument()
      expect(screen.getByTestId('select-item-FEMALE')).toBeInTheDocument()
      expect(screen.getByTestId('select-item-OTHER')).toBeInTheDocument()
    })
  })

  describe('Password visibility toggle', () => {
    it('starts with password hidden', () => {
      render(<NewStaffPage />)
      const passwordInput = screen.getByLabelText('Password *')
      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('toggles password visibility on button click', async () => {
      render(<NewStaffPage />)
      const passwordInput = screen.getByLabelText('Password *')

      // Find the toggle button (it's the button right after the password input)
      const toggleButtons = screen.getAllByRole('button')
      const eyeToggle = toggleButtons.find(btn => {
        const svg = btn.querySelector('svg')
        return svg && btn.closest('.relative')
      })

      if (eyeToggle) {
        fireEvent.click(eyeToggle)
        expect(passwordInput).toHaveAttribute('type', 'text')

        fireEvent.click(eyeToggle)
        expect(passwordInput).toHaveAttribute('type', 'password')
      }
    })
  })

  describe('Form validation', () => {
    it('shows validation error when required fields are empty', async () => {
      const { container } = render(<NewStaffPage />)

      const form = container.querySelector('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Validation Error',
            description: 'Please fill in all required fields',
          })
        )
      })
    })

    it('shows error when only some required fields are filled', async () => {
      const { container } = render(<NewStaffPage />)

      fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'John' } })
      fireEvent.change(screen.getByPlaceholderText('Enter last name'), { target: { value: 'Doe' } })
      // email, phone, role, password still empty

      const form = container.querySelector('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            description: 'Please fill in all required fields',
          })
        )
      })
    })

    it('shows error when password is less than 6 characters', async () => {
      const { container } = render(<NewStaffPage />)

      fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'John' } })
      fireEvent.change(screen.getByPlaceholderText('Enter last name'), { target: { value: 'Doe' } })
      fireEvent.change(screen.getByPlaceholderText('staff@yourclinic.com'), { target: { value: 'john@test.com' } })
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: '123' } })
      // Select role
      fireEvent.click(screen.getByTestId('select-item-DOCTOR'))
      // Fill phone
      const phoneInputs = screen.getAllByPlaceholderText('+91 98765 43210')
      fireEvent.change(phoneInputs[0], { target: { value: '9876543210' } })

      fireEvent.submit(container.querySelector('form')!)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            description: 'Password must be at least 6 characters',
          })
        )
      })
    })

    it('does not submit when validation fails', async () => {
      const { container } = render(<NewStaffPage />)

      fireEvent.submit(container.querySelector('form')!)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled()
      })

      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('Successful submission', () => {
    it('calls API and redirects on success', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 's1', firstName: 'John', lastName: 'Doe' }),
      })

      const { container } = render(<NewStaffPage />)

      // Fill all required fields
      fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'John' } })
      fireEvent.change(screen.getByPlaceholderText('Enter last name'), { target: { value: 'Doe' } })
      fireEvent.change(screen.getByPlaceholderText('staff@yourclinic.com'), { target: { value: 'john@test.com' } })
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByTestId('select-item-DOCTOR'))
      const phoneInputs = screen.getAllByPlaceholderText('+91 98765 43210')
      fireEvent.change(phoneInputs[0], { target: { value: '9876543210' } })

      fireEvent.submit(container.querySelector('form')!)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/staff', expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }))
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Success',
            description: expect.stringContaining('John Doe'),
          })
        )
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/staff')
      })
    })

    it('sends form data including optional fields', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 's1', firstName: 'John', lastName: 'Doe' }),
      })

      const { container } = render(<NewStaffPage />)

      // Required fields
      fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'John' } })
      fireEvent.change(screen.getByPlaceholderText('Enter last name'), { target: { value: 'Doe' } })
      fireEvent.change(screen.getByPlaceholderText('staff@yourclinic.com'), { target: { value: 'john@test.com' } })
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByTestId('select-item-ADMIN'))
      const phoneInputs = screen.getAllByPlaceholderText('+91 98765 43210')
      fireEvent.change(phoneInputs[0], { target: { value: '9876543210' } })

      // Optional fields
      fireEvent.change(screen.getByPlaceholderText('BDS, MDS'), { target: { value: 'BDS' } })
      fireEvent.change(screen.getByPlaceholderText('50000'), { target: { value: '60000' } })

      fireEvent.submit(container.querySelector('form')!)

      await waitFor(() => {
        const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
        expect(callBody.firstName).toBe('John')
        expect(callBody.lastName).toBe('Doe')
        expect(callBody.email).toBe('john@test.com')
        expect(callBody.qualification).toBe('BDS')
        expect(callBody.salary).toBe('60000')
      })
    })
  })

  describe('Error handling', () => {
    it('shows error toast when API returns error', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Email already exists' }),
      })

      const { container } = render(<NewStaffPage />)

      // Fill required fields
      fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'John' } })
      fireEvent.change(screen.getByPlaceholderText('Enter last name'), { target: { value: 'Doe' } })
      fireEvent.change(screen.getByPlaceholderText('staff@yourclinic.com'), { target: { value: 'john@test.com' } })
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByTestId('select-item-DOCTOR'))
      const phoneInputs = screen.getAllByPlaceholderText('+91 98765 43210')
      fireEvent.change(phoneInputs[0], { target: { value: '9876543210' } })

      fireEvent.submit(container.querySelector('form')!)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Error',
            description: 'Email already exists',
          })
        )
      })
    })

    it('shows generic error when API throws', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      const { container } = render(<NewStaffPage />)

      fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'John' } })
      fireEvent.change(screen.getByPlaceholderText('Enter last name'), { target: { value: 'Doe' } })
      fireEvent.change(screen.getByPlaceholderText('staff@yourclinic.com'), { target: { value: 'john@test.com' } })
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByTestId('select-item-DOCTOR'))
      const phoneInputs = screen.getAllByPlaceholderText('+91 98765 43210')
      fireEvent.change(phoneInputs[0], { target: { value: '9876543210' } })

      fireEvent.submit(container.querySelector('form')!)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Error',
          })
        )
      })
    })

    it('does not redirect on API failure', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      })

      const { container } = render(<NewStaffPage />)

      fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'John' } })
      fireEvent.change(screen.getByPlaceholderText('Enter last name'), { target: { value: 'Doe' } })
      fireEvent.change(screen.getByPlaceholderText('staff@yourclinic.com'), { target: { value: 'john@test.com' } })
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByTestId('select-item-DOCTOR'))
      const phoneInputs = screen.getAllByPlaceholderText('+91 98765 43210')
      fireEvent.change(phoneInputs[0], { target: { value: '9876543210' } })

      fireEvent.submit(container.querySelector('form')!)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled()
      })

      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Loading state', () => {
    it('disables submit button while loading', async () => {
      ;(global.fetch as any).mockImplementation(() => new Promise(() => {})) // never resolves

      const { container } = render(<NewStaffPage />)

      fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'John' } })
      fireEvent.change(screen.getByPlaceholderText('Enter last name'), { target: { value: 'Doe' } })
      fireEvent.change(screen.getByPlaceholderText('staff@yourclinic.com'), { target: { value: 'john@test.com' } })
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByTestId('select-item-DOCTOR'))
      const phoneInputs = screen.getAllByPlaceholderText('+91 98765 43210')
      fireEvent.change(phoneInputs[0], { target: { value: '9876543210' } })

      fireEvent.submit(container.querySelector('form')!)

      await waitFor(() => {
        const submitBtn = screen.getByText('Create Staff Member').closest('button')
        expect(submitBtn).toBeDisabled()
      })
    })
  })
})
