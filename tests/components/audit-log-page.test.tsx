// @ts-nocheck
// Reports → Audit Log: who changed which record, and what changed.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/reports/audit-log',
}))

import AuditLogPage from '@/app/(dashboard)/reports/audit-log/page'

const base = {
  entityId: 'x',
  details: null,
  ipAddress: null,
  createdAt: '2026-11-18T10:00:00.000Z',
}
const entries = [
  {
    ...base,
    id: 'l1',
    action: 'UPDATE',
    entityType: 'Appointment',
    entityLabel: 'APT-0042',
    oldValues: { status: 'SCHEDULED', scheduledDate: '2026-11-20T00:00:00.000Z' },
    newValues: { status: 'CANCELLED', scheduledDate: '2026-11-21T00:00:00.000Z' },
    source: 'web',
    ipAddress: '203.0.113.9',
    user: { name: 'Priya Kumar', email: 'p@x', role: 'DOCTOR' },
  },
  {
    ...base,
    id: 'l2',
    action: 'UPDATE',
    entityType: 'User',
    entityLabel: 'Ravi',
    oldValues: { password: '[hidden]', mustChangePassword: true },
    newValues: { password: '[hidden]', mustChangePassword: false },
    source: 'mobile',
    user: { name: 'Ravi', email: 'r@x', role: 'RECEPTIONIST' },
  },
  {
    ...base,
    id: 'l3',
    action: 'CREATE',
    entityType: 'Appointment',
    entityLabel: 'APT-0043',
    oldValues: null,
    newValues: {
      status: 'SCHEDULED',
      scheduledTime: '10:30',
      duration: 30,
      notes: null,
      chairNumber: 2,
    },
    source: 'patient-portal',
    user: null,
  },
  {
    ...base,
    id: 'l4',
    action: 'DELETE',
    entityType: 'Appointment',
    entityLabel: null,
    oldValues: null,
    newValues: { $count: 80 },
    source: null,
    user: null,
  },
  {
    ...base,
    id: 'l5',
    action: 'AI_INTERACTION',
    entityType: 'AIConversation',
    entityLabel: null,
    oldValues: null,
    newValues: null,
    details: 'Asked for a treatment summary',
    source: null,
    user: { name: 'Priya Kumar', email: 'p@x', role: 'DOCTOR' },
  },
  {
    ...base,
    id: 'l6',
    action: 'LOGIN',
    entityType: 'User',
    entityLabel: 'Meena Iyer',
    oldValues: null,
    newValues: null,
    source: 'web',
    user: { name: 'Meena Iyer', email: 'm@x', role: 'ACCOUNTANT' },
  },
]

describe('audit log page', () => {
  it('shows who changed which record, and each field’s old and new value', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: entries,
        pagination: { page: 1, limit: 30, total: 6, totalPages: 1 },
      }),
    }))
    render(<AuditLogPage />)

    expect(await screen.findByText('APT-0042')).toBeInTheDocument()
    expect(screen.getByText('Status: SCHEDULED → CANCELLED')).toBeInTheDocument()
    // A date column reads as that day, wherever the viewer is.
    expect(screen.getByText(/^Scheduled date: 20 Nov 2026 → 21 Nov 2026$/)).toBeInTheDocument()

    // Secrets are only said to have changed; a flag reads as yes/no.
    expect(screen.getByText('Password: hidden → hidden')).toBeInTheDocument()
    expect(screen.getByText('Must change password: Yes → No')).toBeInTheDocument()
    expect(screen.getByText('Mobile app')).toBeInTheDocument()

    // Changes from the patient portal and from the system.
    expect(screen.getByText('Patient portal')).toBeInTheDocument()
    expect(screen.getAllByText('System').length).toBeGreaterThan(0)
    expect(screen.getByText('80 records')).toBeInTheDocument()
    expect(screen.getByText('Asked for a treatment summary')).toBeInTheDocument()

    // A staff sign-in names the person once.
    expect(screen.getAllByText('Meena Iyer')).toHaveLength(1)

    // A creation lists its first fields, the rest on request.
    expect(screen.getByText('Status: SCHEDULED')).toBeInTheDocument()
    expect(screen.queryByText('Chair number: 2')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Show all 5 fields'))
    expect(screen.getByText('Chair number: 2')).toBeInTheDocument()
    expect(screen.getByText('Notes: empty')).toBeInTheDocument()
  })
})
