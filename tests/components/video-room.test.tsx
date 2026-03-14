// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span data-testid="badge" className={className}>{children}</span>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef((props: any, ref: any) => <textarea ref={ref} {...props} />),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className}>{children}</h3>,
}))

import VideoRoom from '@/components/video/video-room'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const defaultProps = {
  roomUrl: 'https://daily.co/room-123',
  roomName: 'room-123',
  token: 'test-token',
  provider: 'daily' as const,
  participantName: 'Dr. Smith',
  isDoctor: true,
  consultationId: 'cons-1',
}

const mockPatient = {
  id: 'p-1',
  patientId: 'PAT-001',
  firstName: 'John',
  lastName: 'Doe',
  phone: '9876543210',
  email: 'john@test.com',
  gender: 'MALE',
  medicalHistory: {
    hasAllergies: true,
    drugAllergies: 'Penicillin',
    hasDiabetes: true,
    hasHypertension: false,
    hasHeartDisease: false,
  },
}

const mockAppointment = {
  appointmentNo: 'APT-001',
  chiefComplaint: 'Tooth pain',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VideoRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock document.fullscreenElement
    Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true })
  })

  describe('Active call state', () => {
    it('renders LIVE badge', () => {
      render(<VideoRoom {...defaultProps} />)
      expect(screen.getByText('LIVE')).toBeInTheDocument()
    })

    it('renders timer showing 0:00', () => {
      render(<VideoRoom {...defaultProps} />)
      expect(screen.getByText('0:00')).toBeInTheDocument()
    })

    it('renders End Call button', () => {
      render(<VideoRoom {...defaultProps} />)
      expect(screen.getByText('End Call')).toBeInTheDocument()
    })

    it('renders video iframe with correct src (daily provider)', () => {
      render(<VideoRoom {...defaultProps} />)
      const iframe = document.querySelector('iframe')
      expect(iframe).toBeInTheDocument()
      expect(iframe.src).toContain('daily.co/room-123')
      expect(iframe.src).toContain('t=test-token')
    })

    it('renders video iframe for jitsi provider', () => {
      render(<VideoRoom {...defaultProps} provider="jitsi" roomUrl="https://meet.jit.si/room-123" />)
      const iframe = document.querySelector('iframe')
      expect(iframe.src).toContain('meet.jit.si/room-123')
    })

    it('shows Show/Hide Panel button for doctors', () => {
      render(<VideoRoom {...defaultProps} />)
      expect(screen.getByText('Hide Panel')).toBeInTheDocument()
    })

    it('does not show panel toggle for non-doctors', () => {
      render(<VideoRoom {...defaultProps} isDoctor={false} />)
      expect(screen.queryByText('Hide Panel')).not.toBeInTheDocument()
      expect(screen.queryByText('Show Panel')).not.toBeInTheDocument()
    })

    it('toggles panel visibility', () => {
      render(<VideoRoom {...defaultProps} />)
      expect(screen.getByText('Hide Panel')).toBeInTheDocument()
      fireEvent.click(screen.getByText('Hide Panel'))
      expect(screen.getByText('Show Panel')).toBeInTheDocument()
    })
  })

  describe('Doctor sidebar', () => {
    it('shows patient info card', () => {
      render(<VideoRoom {...defaultProps} patient={mockPatient} />)
      expect(screen.getByText('Patient Info')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('(PAT-001)')).toBeInTheDocument()
    })

    it('shows patient phone', () => {
      render(<VideoRoom {...defaultProps} patient={mockPatient} />)
      expect(screen.getByText('9876543210')).toBeInTheDocument()
    })

    it('shows patient gender', () => {
      render(<VideoRoom {...defaultProps} patient={mockPatient} />)
      expect(screen.getByText('male')).toBeInTheDocument()
    })

    it('shows medical alerts', () => {
      render(<VideoRoom {...defaultProps} patient={mockPatient} />)
      expect(screen.getByText('Medical Alerts')).toBeInTheDocument()
      expect(screen.getByText(/Penicillin/)).toBeInTheDocument()
      expect(screen.getByText('Diabetes')).toBeInTheDocument()
    })

    it('shows appointment info', () => {
      render(<VideoRoom {...defaultProps} appointment={mockAppointment} />)
      expect(screen.getByText('Appointment')).toBeInTheDocument()
      expect(screen.getByText('APT-001')).toBeInTheDocument()
      expect(screen.getByText('Tooth pain')).toBeInTheDocument()
    })

    it('shows consultation notes textarea', () => {
      render(<VideoRoom {...defaultProps} />)
      expect(screen.getByText('Consultation Notes')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Type notes during the consultation...')).toBeInTheDocument()
    })

    it('does not show sidebar for non-doctors', () => {
      render(<VideoRoom {...defaultProps} isDoctor={false} patient={mockPatient} />)
      expect(screen.queryByText('Patient Info')).not.toBeInTheDocument()
      expect(screen.queryByText('Consultation Notes')).not.toBeInTheDocument()
    })
  })

  describe('Call ended state', () => {
    it('shows Call Ended screen after ending', () => {
      render(<VideoRoom {...defaultProps} />)
      fireEvent.click(screen.getByText('End Call'))
      expect(screen.getByText('Call Ended')).toBeInTheDocument()
    })

    it('shows duration after ending', () => {
      render(<VideoRoom {...defaultProps} />)
      fireEvent.click(screen.getByText('End Call'))
      expect(screen.getByText(/Duration:/)).toBeInTheDocument()
    })

    it('calls onEnd callback with notes', () => {
      const onEnd = vi.fn()
      render(<VideoRoom {...defaultProps} onEnd={onEnd} />)
      fireEvent.click(screen.getByText('End Call'))
      expect(onEnd).toHaveBeenCalledWith('')
    })

    it('shows notes textarea after call ends (doctor only)', () => {
      render(<VideoRoom {...defaultProps} />)
      fireEvent.click(screen.getByText('End Call'))
      expect(screen.getByPlaceholderText('Add consultation notes...')).toBeInTheDocument()
      expect(screen.getByText('Save Notes & Close')).toBeInTheDocument()
    })

    it('does not show notes section for non-doctors', () => {
      render(<VideoRoom {...defaultProps} isDoctor={false} />)
      fireEvent.click(screen.getByText('End Call'))
      expect(screen.getByText('Call Ended')).toBeInTheDocument()
      expect(screen.queryByText('Save Notes & Close')).not.toBeInTheDocument()
    })

    it('allows editing notes and saving', () => {
      const onEnd = vi.fn()
      render(<VideoRoom {...defaultProps} onEnd={onEnd} />)
      fireEvent.click(screen.getByText('End Call'))

      const textarea = screen.getByPlaceholderText('Add consultation notes...')
      fireEvent.change(textarea, { target: { value: 'Patient has cavity in molar' } })
      fireEvent.click(screen.getByText('Save Notes & Close'))

      expect(onEnd).toHaveBeenCalledWith('Patient has cavity in molar')
    })
  })
})
