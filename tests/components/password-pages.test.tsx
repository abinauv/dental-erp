// @ts-nocheck
// Forgot password, reset password, change password, and the login link.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

const h = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
  signOut: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  toast: vi.fn(),
  params: new URLSearchParams(),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    requestPasswordReset: h.requestPasswordReset,
    resetPassword: h.resetPassword,
    changePassword: h.changePassword,
  },
  signIn: { email: vi.fn() },
  signOut: h.signOut,
  oidcEnabled: false,
  signInWithOidc: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, refresh: h.refresh, back: h.back, replace: vi.fn() }),
  useSearchParams: () => h.params,
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }))

import ForgotPasswordPage from '@/app/(auth)/forgot-password/page'
import ResetPasswordPage from '@/app/(auth)/reset-password/page'
import ChangePasswordPage from '@/app/(auth)/change-password/page'
import LoginPage from '@/app/(auth)/login/page'

const policy = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
}
function policyApi(status = 200, body = { passwordPolicy: policy }) {
  global.fetch = vi.fn(async () => ({ ok: status < 400, status, json: async () => body }))
}
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  vi.clearAllMocks()
  h.params = new URLSearchParams()
  policyApi()
})

describe('login', () => {
  it('links to forgot password', () => {
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password'
    )
  })
})

describe('/forgot-password', () => {
  it('asks for a link and says the same thing whether or not the email exists', async () => {
    h.requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null })
    render(<ForgotPasswordPage />)
    type('Email', 'asha@clinic.test')
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(h.requestPasswordReset).toHaveBeenCalledWith({
      email: 'asha@clinic.test',
      redirectTo: '/reset-password',
    })
    expect(screen.getByText(/If asha@clinic.test has an account/)).toBeInTheDocument()
  })

  it('checks the address first, and explains a rate limit', async () => {
    render(<ForgotPasswordPage />)
    type('Email', 'not-an-email')
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.')
    expect(h.requestPasswordReset).not.toHaveBeenCalled()

    h.requestPasswordReset.mockResolvedValue({ error: { status: 429 } })
    type('Email', 'asha@clinic.test')
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests')
  })
})

describe('/reset-password', () => {
  it('sets a new password that meets the clinic’s rules', async () => {
    h.params = new URLSearchParams('token=tok123')
    h.resetPassword.mockResolvedValue({ data: { status: true }, error: null })
    render(<ResetPasswordPage />)

    await screen.findByText('Choose a new password')
    expect(global.fetch).toHaveBeenCalledWith('/api/password-policy?resetToken=tok123')
    expect(screen.getByText('Be at least 10 characters')).toBeInTheDocument()
    expect(screen.queryByText('Include a symbol')).not.toBeInTheDocument()

    type('New password', 'short1A')
    type('Confirm new password', 'short1A')
    fireEvent.click(screen.getByRole('button', { name: 'Set New Password' }))
    expect(screen.getByRole('alert')).toHaveTextContent("doesn't meet the rules")
    expect(h.resetPassword).not.toHaveBeenCalled()

    type('New password', 'Longer-pass-1')
    type('Confirm new password', 'Longer-pass-2')
    fireEvent.click(screen.getByRole('button', { name: 'Set New Password' }))
    expect(screen.getByRole('alert')).toHaveTextContent("don't match")

    type('Confirm new password', 'Longer-pass-1')
    fireEvent.click(screen.getByRole('button', { name: 'Set New Password' }))
    expect(await screen.findByText('Password changed')).toBeInTheDocument()
    expect(h.resetPassword).toHaveBeenCalledWith({ newPassword: 'Longer-pass-1', token: 'tok123' })
  })

  it('says an expired or used link doesn’t work, before and after submitting', async () => {
    h.params = new URLSearchParams('error=INVALID_TOKEN')
    const { unmount } = render(<ResetPasswordPage />)
    expect(await screen.findByText("This link doesn't work")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a New Link' })).toHaveAttribute(
      'href',
      '/forgot-password'
    )
    unmount()

    policyApi(404, { code: 'INVALID_TOKEN' })
    h.params = new URLSearchParams('token=old')
    render(<ResetPasswordPage />)
    expect(await screen.findByText("This link doesn't work")).toBeInTheDocument()
  })
})

describe('/change-password', () => {
  it('when required: explains why, changes it, and goes on to the dashboard', async () => {
    policyApi(200, { passwordPolicy: policy, mustChangePassword: true })
    h.changePassword.mockResolvedValue({ data: {}, error: null })
    render(<ChangePasswordPage />)

    expect(await screen.findByText('Choose your own password')).toBeInTheDocument()
    await screen.findByLabelText('Current password')
    type('Current password', 'Temp-from-admin1')
    type('New password', 'My-own-pass-1')
    type('Confirm new password', 'My-own-pass-1')
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }))

    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/dashboard'))
    expect(h.changePassword).toHaveBeenCalledWith({
      currentPassword: 'Temp-from-admin1',
      newPassword: 'My-own-pass-1',
      revokeOtherSessions: true,
    })
    expect(screen.getByRole('button', { name: 'Sign out instead' })).toBeInTheDocument()
  })

  it('explains a wrong current password, an unchanged one, and the clinic’s rules', async () => {
    render(<ChangePasswordPage />)
    await screen.findByLabelText('Current password')
    expect(screen.getByText('Change your password')).toBeInTheDocument()
    type('Current password', 'whatever')
    type('New password', 'My-own-pass-1')
    type('Confirm new password', 'My-own-pass-1')

    for (const [failure, message] of [
      [{ code: 'INVALID_PASSWORD', status: 400 }, 'Your current password is incorrect.'],
      [{ code: 'PASSWORD_UNCHANGED', status: 400 }, 'different from your current one'],
      [{ code: 'PASSWORD_POLICY', status: 400 }, "doesn't meet the rules"],
      [{ status: 429 }, 'Too many attempts'],
    ]) {
      h.changePassword.mockResolvedValueOnce({ error: failure })
      fireEvent.click(screen.getByRole('button', { name: 'Change Password' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
    }
    expect(h.push).not.toHaveBeenCalled()
  })
})
