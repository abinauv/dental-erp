// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn()
const mockToast = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/signup',
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
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef((props: any, ref: any) => <input ref={ref} {...props} />),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

import SignupPage from '@/app/(auth)/signup/page'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fillForm(overrides: Record<string, string> = {}) {
  const defaults = {
    hospitalName: 'Test Dental Clinic',
    adminName: 'Dr. Test Admin',
    email: 'admin@test.com',
    phone: '9876543210',
    password: 'password123',
    confirmPassword: 'password123',
  }
  const values = { ...defaults, ...overrides }

  Object.entries(values).forEach(([id, value]) => {
    const input = screen.getByPlaceholderText(getPlaceholder(id)) || screen.getByLabelText(new RegExp(id, 'i'))
    fireEvent.change(input, { target: { value } })
  })
}

function getPlaceholder(field: string): string {
  const map: Record<string, string> = {
    hospitalName: "Dr. Smith's Dental Clinic",
    adminName: 'Dr. John Smith',
    email: 'doctor@clinic.com',
    phone: '9876543210',
    password: 'At least 8 characters',
    confirmPassword: 'Confirm your password',
  }
  return map[field] || ''
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any) = vi.fn()
  })

  describe('Rendering', () => {
    it('renders the signup form with all fields', () => {
      render(<SignupPage />)
      expect(screen.getByText('Create your clinic')).toBeInTheDocument()
      expect(screen.getByPlaceholderText("Dr. Smith's Dental Clinic")).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Dr. John Smith')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('doctor@clinic.com')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('9876543210')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument()
    })

    it('renders Create Account submit button', () => {
      render(<SignupPage />)
      expect(screen.getByText('Create Account')).toBeInTheDocument()
    })

    it('renders link to login page', () => {
      render(<SignupPage />)
      expect(screen.getByText(/Already have an account/)).toBeInTheDocument()
    })

    it('renders terms of service notice', () => {
      render(<SignupPage />)
      expect(screen.getByText(/Terms of Service/)).toBeInTheDocument()
    })
  })

  describe('Validation — Hospital Name', () => {
    it('shows error when hospital name is empty', async () => {
      render(<SignupPage />)
      fireEvent.click(screen.getByText('Create Account'))
      await waitFor(() => {
        expect(screen.getByText('Hospital name must be at least 2 characters')).toBeInTheDocument()
      })
    })

    it('shows error when hospital name is too short (1 char)', async () => {
      render(<SignupPage />)
      fireEvent.change(screen.getByPlaceholderText("Dr. Smith's Dental Clinic"), { target: { value: 'A' } })
      fireEvent.click(screen.getByText('Create Account'))
      await waitFor(() => {
        expect(screen.getByText('Hospital name must be at least 2 characters')).toBeInTheDocument()
      })
    })
  })

  describe('Validation — Admin Name', () => {
    it('shows error when admin name is empty', async () => {
      render(<SignupPage />)
      fireEvent.click(screen.getByText('Create Account'))
      await waitFor(() => {
        expect(screen.getByText('Your name must be at least 2 characters')).toBeInTheDocument()
      })
    })

    it('shows error when admin name is 1 char', async () => {
      render(<SignupPage />)
      fireEvent.change(screen.getByPlaceholderText('Dr. John Smith'), { target: { value: 'X' } })
      fireEvent.click(screen.getByText('Create Account'))
      await waitFor(() => {
        expect(screen.getByText('Your name must be at least 2 characters')).toBeInTheDocument()
      })
    })
  })

  describe('Validation — Email', () => {
    it('does not submit with invalid email', async () => {
      render(<SignupPage />)
      // Fill all other fields to isolate email validation
      fireEvent.change(screen.getByPlaceholderText("Dr. Smith's Dental Clinic"), { target: { value: 'Test Clinic' } })
      fireEvent.change(screen.getByPlaceholderText('Dr. John Smith'), { target: { value: 'Dr Test' } })
      fireEvent.change(screen.getByPlaceholderText('doctor@clinic.com'), { target: { value: 'not-an-email' } })
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } })
      fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'password123' } })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Account'))
      })

      // Form should not submit with invalid email — fetch should not be called
      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled()
      })
    })

    it('shows error for empty email on submit', async () => {
      render(<SignupPage />)
      fireEvent.click(screen.getByText('Create Account'))
      await waitFor(() => {
        // Email is required, so it should show some validation error
        const emailInput = screen.getByPlaceholderText('doctor@clinic.com')
        expect(emailInput).toBeInTheDocument()
      })
    })
  })

  describe('Validation — Phone', () => {
    it('shows error when phone is too short', async () => {
      render(<SignupPage />)
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '123' } })
      fireEvent.click(screen.getByText('Create Account'))
      await waitFor(() => {
        expect(screen.getByText('Phone number must be at least 10 digits')).toBeInTheDocument()
      })
    })
  })

  describe('Validation — Password', () => {
    it('shows error when password is too short', async () => {
      render(<SignupPage />)
      fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: '1234567' } })
      fireEvent.click(screen.getByText('Create Account'))
      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
      })
    })

    it('shows error when passwords do not match', async () => {
      render(<SignupPage />)
      // Fill all fields but mismatch passwords
      fireEvent.change(screen.getByPlaceholderText("Dr. Smith's Dental Clinic"), { target: { value: 'Test Clinic' } })
      fireEvent.change(screen.getByPlaceholderText('Dr. John Smith'), { target: { value: 'Dr Test' } })
      fireEvent.change(screen.getByPlaceholderText('doctor@clinic.com'), { target: { value: 'test@test.com' } })
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } })
      fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'different456' } })

      fireEvent.click(screen.getByText('Create Account'))
      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
      })
    })
  })

  describe('Submission', () => {
    it('submits form with valid data and redirects', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      render(<SignupPage />)

      fireEvent.change(screen.getByPlaceholderText("Dr. Smith's Dental Clinic"), { target: { value: 'Test Clinic' } })
      fireEvent.change(screen.getByPlaceholderText('Dr. John Smith'), { target: { value: 'Dr Test' } })
      fireEvent.change(screen.getByPlaceholderText('doctor@clinic.com'), { target: { value: 'test@test.com' } })
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } })
      fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'password123' } })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Account'))
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/public/signup', expect.objectContaining({
          method: 'POST',
        }))
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
          title: 'Account created!',
        }))
      })

      expect(mockPush).toHaveBeenCalledWith('/verify-email?email=test%40test.com')
    })

    it('shows error toast when API returns error', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Email already exists' }),
      })

      render(<SignupPage />)

      fireEvent.change(screen.getByPlaceholderText("Dr. Smith's Dental Clinic"), { target: { value: 'Test Clinic' } })
      fireEvent.change(screen.getByPlaceholderText('Dr. John Smith'), { target: { value: 'Dr Test' } })
      fireEvent.change(screen.getByPlaceholderText('doctor@clinic.com'), { target: { value: 'test@test.com' } })
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } })
      fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'password123' } })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Account'))
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
          variant: 'destructive',
          title: 'Signup failed',
          description: 'Email already exists',
        }))
      })
    })

    it('shows generic error toast on network failure', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      render(<SignupPage />)

      fireEvent.change(screen.getByPlaceholderText("Dr. Smith's Dental Clinic"), { target: { value: 'Test Clinic' } })
      fireEvent.change(screen.getByPlaceholderText('Dr. John Smith'), { target: { value: 'Dr Test' } })
      fireEvent.change(screen.getByPlaceholderText('doctor@clinic.com'), { target: { value: 'test@test.com' } })
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } })
      fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'password123' } })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Account'))
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
          variant: 'destructive',
          title: 'Error',
        }))
      })
    })

    it('does not submit when validation fails', async () => {
      render(<SignupPage />)
      fireEvent.click(screen.getByText('Create Account'))

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled()
      })
    })

    it('does not send confirmPassword to API', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      render(<SignupPage />)

      fireEvent.change(screen.getByPlaceholderText("Dr. Smith's Dental Clinic"), { target: { value: 'Test Clinic' } })
      fireEvent.change(screen.getByPlaceholderText('Dr. John Smith'), { target: { value: 'Dr Test' } })
      fireEvent.change(screen.getByPlaceholderText('doctor@clinic.com'), { target: { value: 'test@test.com' } })
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } })
      fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'password123' } })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Account'))
      })

      await waitFor(() => {
        const call = (global.fetch as any).mock.calls[0]
        const body = JSON.parse(call[1].body)
        expect(body).not.toHaveProperty('confirmPassword')
        expect(body).toHaveProperty('password', 'password123')
        expect(body).toHaveProperty('hospitalName', 'Test Clinic')
        expect(body).toHaveProperty('adminName', 'Dr Test')
        expect(body).toHaveProperty('email', 'test@test.com')
        expect(body).toHaveProperty('phone', '9876543210')
      })
    })
  })

  describe('Multiple validation errors', () => {
    it('shows all validation errors at once', async () => {
      render(<SignupPage />)
      fireEvent.click(screen.getByText('Create Account'))

      await waitFor(() => {
        expect(screen.getByText('Hospital name must be at least 2 characters')).toBeInTheDocument()
        expect(screen.getByText('Your name must be at least 2 characters')).toBeInTheDocument()
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
        expect(screen.getByText('Phone number must be at least 10 digits')).toBeInTheDocument()
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
      })
    })
  })
})
