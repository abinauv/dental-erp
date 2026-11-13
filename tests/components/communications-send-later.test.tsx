// @ts-nocheck
// "Send later" on the Communications page's SMS and Email forms.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import CommunicationsPage from '@/app/(dashboard)/communications/page'

const posted = () => {
  const [url, init] = global.fetch.mock.calls[0]
  return { url, body: JSON.parse(init.body) }
}

beforeEach(() => {
  toast.mockClear()
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }))
})

afterEach(() => vi.useRealTimers())

function fillSms() {
  fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '9876543210' } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'See you soon' } })
}

describe('Communications: Send later', () => {
  it('sends an SMS now when no time is set', async () => {
    render(<CommunicationsPage />)
    fillSms()
    fireEvent.click(screen.getByRole('button', { name: /Send SMS/ }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(posted()).toEqual({
      url: '/api/communications/sms',
      body: { phone: '9876543210', message: 'See you soon' },
    })
  })

  it('schedules an SMS for the chosen local time', async () => {
    render(<CommunicationsPage />)
    fillSms()
    fireEvent.change(screen.getByLabelText('Send later (optional)'), {
      target: { value: '2099-03-01T10:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Schedule SMS/ }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(posted().body).toEqual({
      phone: '9876543210',
      message: 'See you soon',
      scheduledFor: new Date('2099-03-01T10:30').toISOString(),
    })
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.stringMatching(/^SMS scheduled for /) })
      )
    )
    // The form is cleared, so the button reads "Send SMS" again.
    expect(screen.getByRole('button', { name: /Send SMS/ })).toBeInTheDocument()
  })

  it('refuses a time that has already passed', async () => {
    render(<CommunicationsPage />)
    fillSms()
    fireEvent.change(screen.getByLabelText('Send later (optional)'), {
      target: { value: '2001-01-01T09:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Schedule SMS/ }))

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: expect.stringMatching(/time in the future/),
      })
    )
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('schedules an email', async () => {
    render(<CommunicationsPage />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Email/ }))
    fireEvent.change(await screen.findByLabelText('To (Email Address)'), {
      target: { value: 'p@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Checkup' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Due soon' } })
    fireEvent.change(screen.getByLabelText('Send later (optional)'), {
      target: { value: '2099-03-01T08:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Schedule Email/ }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(posted()).toEqual({
      url: '/api/communications/email',
      body: {
        to: 'p@example.com',
        subject: 'Checkup',
        body: 'Due soon',
        scheduledFor: new Date('2099-03-01T08:00').toISOString(),
      },
    })
  })
})
