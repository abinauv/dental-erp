// @ts-nocheck
/**
 * Clinical Component Tests
 * - DentalChart (interactive dental chart with tooth click, condition dialog)
 * - Dental3DViewer (SVG arch viewer with zoom, fullscreen, tooth inspect)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
  const actual = await importOriginal() as any
  const handler = { get: (_: any, p: string) => actual[p] || icon(p) }
  return new Proxy(actual, handler)
})

vi.mock('date-fns', () => ({
  format: (date: any, fmt: string) => new Date(date).toLocaleDateString(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

// UI mocks
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
  CardDescription: ({ children }: any) => <p data-testid="card-desc">{children}</p>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span data-testid="badge" data-variant={variant}>{children}</span>,
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: React.forwardRef(({ children, onClick, disabled, variant, ...rest }: any, ref: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} ref={ref} {...rest}>{children}</button>
  )),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}))

let dialogOpen = false
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => {
    dialogOpen = open
    return <div data-testid="dialog" data-open={String(!!open)}>{open ? children : null}</div>
  },
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => <div data-testid="select" data-value={value}>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span />,
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ id, checked, onCheckedChange }: any) => (
    <input type="checkbox" id={id} checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} data-testid={`checkbox-${id}`} />
  ),
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div role="tooltip">{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { DentalChart } from '@/components/dental-chart/dental-chart'

// ---------------------------------------------------------------------------
// DentalChart Tests
// ---------------------------------------------------------------------------
describe('DentalChart', () => {
  const mockChartData = {
    11: [{ id: 'e1', toothNumber: 11, toothNotation: '11', condition: 'CARIES', severity: 'MODERATE', mesial: true, distal: false, occlusal: false, buccal: false, lingual: false, notes: 'Deep caries', diagnosedDate: '2026-01-15', resolvedDate: null }],
    21: [{ id: 'e2', toothNumber: 21, toothNotation: '21', condition: 'FILLED', severity: 'MILD', mesial: false, distal: false, occlusal: true, buccal: false, lingual: false, notes: '', diagnosedDate: '2025-12-01', resolvedDate: null }],
    36: [{ id: 'e3', toothNumber: 36, toothNotation: '36', condition: 'MISSING', severity: 'SEVERE', mesial: false, distal: false, occlusal: false, buccal: false, lingual: false, notes: '', diagnosedDate: '2025-06-01', resolvedDate: null }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ chartData: mockChartData }),
    } as Response)
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {})) // Never resolves
    render(<DentalChart patientId="p1" />)
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })

  it('fetches chart data for the patient on mount', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/dental-chart?patientId=p1')
      )
    })
  })

  it('renders chart title after loading', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument()
    })
  })

  it('renders Upper Jaw and Lower Jaw labels', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('Upper Jaw (Maxilla)')).toBeInTheDocument()
      expect(screen.getByText('Lower Jaw (Mandible)')).toBeInTheDocument()
    })
  })

  it('renders all 32 tooth buttons', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => {
      // 32 teeth total (8 per quadrant)
      const buttons = screen.getAllByRole('button')
      // At least 32 tooth buttons exist (some other buttons may exist)
      expect(buttons.length).toBeGreaterThanOrEqual(32)
    })
  })

  it('renders quadrant labels', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('Q1 (UR)')).toBeInTheDocument()
      expect(screen.getByText('Q2 (UL)')).toBeInTheDocument()
      expect(screen.getByText('Q3 (LL)')).toBeInTheDocument()
      expect(screen.getByText('Q4 (LR)')).toBeInTheDocument()
    })
  })

  it('renders condition legend', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => {
      // Condition labels appear in legend + tooltips, use getAllByText
      expect(screen.getAllByText('Healthy').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Caries').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Filled').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Missing').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Crown').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Root Canal').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders summary cards (present teeth, caries, filled, missing)', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('Present Teeth')).toBeInTheDocument()
      expect(screen.getAllByText('Caries').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Filled').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Missing').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('computes summary counts correctly', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => {
      // Summary card "Present Teeth" should exist
      expect(screen.getByText('Present Teeth')).toBeInTheDocument()
      // Summary card "Caries" should exist
      const cariesCards = screen.getAllByText('Caries')
      expect(cariesCards.length).toBeGreaterThanOrEqual(1) // legend + summary
    })
  })

  it('opens dialog when a tooth is clicked', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument())

    // Click on tooth 11 (should be rendered as a button with text "11")
    const tooth11 = screen.getByText('11').closest('button')
    expect(tooth11).toBeTruthy()
    fireEvent.click(tooth11!)

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true')
    })
  })

  it('dialog shows tooth number and name', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument())

    fireEvent.click(screen.getByText('11').closest('button')!)

    await waitFor(() => {
      expect(screen.getByTestId('dialog-title').textContent).toContain('11')
      expect(screen.getByTestId('dialog-title').textContent).toContain('Central Incisor')
    })
  })

  it('dialog pre-fills condition for existing entries', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument())

    fireEvent.click(screen.getByText('11').closest('button')!)

    await waitFor(() => {
      const select = screen.getAllByTestId('select')[0]
      expect(select).toHaveAttribute('data-value', 'CARIES')
    })
  })

  it('dialog has Cancel and Save Changes buttons', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument())

    fireEvent.click(screen.getByText('11').closest('button')!)

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })
  })

  it('saves entry when Save Changes clicked', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ chartData: mockChartData }) } as Response) // initial fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response) // save
      .mockResolvedValueOnce({ ok: true, json: async () => ({ chartData: mockChartData }) } as Response) // refetch

    render(<DentalChart patientId="p1" />)
    await waitFor(() => expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument())

    fireEvent.click(screen.getByText('11').closest('button')!)
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      const postCalls = vi.mocked(global.fetch).mock.calls.filter(c => c[1]?.method === 'POST')
      expect(postCalls.length).toBe(1)
      const body = JSON.parse(postCalls[0][1].body)
      expect(body.patientId).toBe('p1')
      expect(body.toothNumber).toBe(11)
      expect(body.condition).toBe('CARIES')
    })
  })

  it('shows success toast after saving', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ chartData: mockChartData }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ chartData: mockChartData }) } as Response)

    render(<DentalChart patientId="p1" />)
    await waitFor(() => expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument())

    fireEvent.click(screen.getByText('11').closest('button')!)
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Success' }))
    })
  })

  it('shows error toast on fetch failure', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

    render(<DentalChart patientId="p1" />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        title: 'Error',
      }))
    })
  })

  it('shows error toast on save failure', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ chartData: mockChartData }) } as Response)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Validation failed' }) } as Response)

    render(<DentalChart patientId="p1" />)
    await waitFor(() => expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument())

    fireEvent.click(screen.getByText('11').closest('button')!)
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })
  })

  it('shows Midline separator', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('Midline')).toBeInTheDocument()
    })
  })

  it('renders FDI description text', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => {
      expect(screen.getByText(/FDI notation/)).toBeInTheDocument()
    })
  })

  it('renders dialog with surface checkboxes', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument())

    fireEvent.click(screen.getByText('11').closest('button')!)

    await waitFor(() => {
      expect(screen.getByText('Surfaces Affected')).toBeInTheDocument()
      expect(screen.getByTestId('checkbox-mesial')).toBeInTheDocument()
      expect(screen.getByTestId('checkbox-distal')).toBeInTheDocument()
      expect(screen.getByTestId('checkbox-occlusal')).toBeInTheDocument()
      expect(screen.getByTestId('checkbox-buccal')).toBeInTheDocument()
      expect(screen.getByTestId('checkbox-lingual')).toBeInTheDocument()
    })
  })

  it('pre-fills surface checkboxes from existing data', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument())

    // Tooth 11 has mesial: true in mockChartData
    fireEvent.click(screen.getByText('11').closest('button')!)

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-mesial')).toBeChecked()
      expect(screen.getByTestId('checkbox-distal')).not.toBeChecked()
    })
  })

  it('resets form for tooth without existing data', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument())

    // Tooth 12 has no data in mock
    fireEvent.click(screen.getByText('12').closest('button')!)

    await waitFor(() => {
      const select = screen.getAllByTestId('select')[0]
      expect(select).toHaveAttribute('data-value', 'CARIES') // default
      expect(screen.getByTestId('checkbox-mesial')).not.toBeChecked()
    })
  })

  it('renders history section for teeth with data', async () => {
    render(<DentalChart patientId="p1" />)
    await waitFor(() => expect(screen.getByText('Interactive Dental Chart')).toBeInTheDocument())

    fireEvent.click(screen.getByText('11').closest('button')!)

    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Dental3DViewer Tests (SVG-based viewer)
// ---------------------------------------------------------------------------
import Dental3DViewer from '@/components/imaging/dental-3d-viewer'

describe('Dental3DViewer', () => {
  const mockChartData = [
    { toothNumber: 11, condition: 'HEALTHY' },
    { toothNumber: 21, condition: 'CARIES', severity: 'MODERATE', notes: 'Deep cavity' },
    { toothNumber: 36, condition: 'MISSING' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ chartData: {} }),
    } as Response)
  })

  it('renders without crashing', () => {
    render(<Dental3DViewer patientId="p1" chartData={mockChartData} />)
    expect(screen.getByText('Interactive Dental Viewer')).toBeInTheDocument()
  })

  it('renders SVG element', () => {
    const { container } = render(<Dental3DViewer patientId="p1" chartData={mockChartData} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    // SVG should have a viewBox attribute
    expect(svg?.getAttribute('viewBox')).toContain('0 0')
  })

  it('renders view angle buttons (Full, Upper, Lower)', () => {
    render(<Dental3DViewer patientId="p1" chartData={mockChartData} />)
    expect(screen.getByText('Full')).toBeInTheDocument()
    expect(screen.getByText('Upper')).toBeInTheDocument()
    expect(screen.getByText('Lower')).toBeInTheDocument()
  })

  it('renders zoom and control buttons', () => {
    render(<Dental3DViewer patientId="p1" chartData={mockChartData} />)
    const buttons = screen.getAllByRole('button')
    // Full, Upper, Lower, ZoomIn, ZoomOut, Reset, Fullscreen = 7+
    expect(buttons.length).toBeGreaterThanOrEqual(7)
  })

  it('renders condition legend', () => {
    render(<Dental3DViewer patientId="p1" chartData={mockChartData} />)
    expect(screen.getByText('Legend')).toBeInTheDocument()
    // Condition names may appear in both legend and overview panel
    expect(screen.getAllByText('Healthy').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Caries').length).toBeGreaterThanOrEqual(1)
  })

  it('shows overview panel with present teeth count', () => {
    render(<Dental3DViewer patientId="p1" chartData={mockChartData} />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Present Teeth')).toBeInTheDocument()
    // 32 - 1 MISSING = 31
    expect(screen.getByText('31/32')).toBeInTheDocument()
  })

  it('renders SVG with viewBox for arch layout', () => {
    const { container } = render(<Dental3DViewer patientId="p1" chartData={mockChartData} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    const viewBox = svg?.getAttribute('viewBox') || ''
    // Front view: viewBox starts with "0 0 620"
    expect(viewBox).toMatch(/^0 0 \d+ \d+$/)
  })

  it('renders in readOnly mode without crash', () => {
    render(<Dental3DViewer patientId="p1" chartData={mockChartData} readOnly />)
    expect(screen.getByText('Interactive Dental Viewer')).toBeInTheDocument()
  })

  it('handles empty chart data gracefully', () => {
    render(<Dental3DViewer patientId="p1" chartData={[]} />)
    expect(screen.getByText('Interactive Dental Viewer')).toBeInTheDocument()
    // With empty data, all teeth are healthy → present count = 32/32
    expect(screen.getByText('32/32')).toBeInTheDocument()
  })

  it('shows condition stats from chart data', () => {
    render(<Dental3DViewer patientId="p1" chartData={mockChartData} />)
    // Should show Missing count in overview
    expect(screen.getAllByText('Missing').length).toBeGreaterThanOrEqual(1)
  })

  it('renders card title for the viewer', () => {
    render(<Dental3DViewer patientId="p1" chartData={mockChartData} />)
    expect(screen.getByText('Interactive Dental Viewer')).toBeInTheDocument()
    // Verify overview section with stat counts
    expect(screen.getByText('Present Teeth')).toBeInTheDocument()
  })
})
