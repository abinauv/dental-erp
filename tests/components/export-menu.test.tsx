// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

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
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div data-testid="dropdown-item" role="menuitem" onClick={onClick}>{children}</div>
  ),
}))

const mockDownloadCSV = vi.fn()
const mockDownloadExcel = vi.fn()
vi.mock('@/lib/export-utils', () => ({
  downloadCSV: (...args: any[]) => mockDownloadCSV(...args),
  downloadExcel: (...args: any[]) => mockDownloadExcel(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

import { ExportMenu } from '@/components/ui/export-menu'

describe('ExportMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDownloadExcel.mockResolvedValue(undefined)
  })

  it('renders Export button', () => {
    render(<ExportMenu getData={() => []} filename="test" />)
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('renders CSV and Excel options', () => {
    render(<ExportMenu getData={() => []} filename="test" />)
    expect(screen.getByText('Export as CSV')).toBeInTheDocument()
    expect(screen.getByText('Export as Excel')).toBeInTheDocument()
  })

  it('calls downloadCSV when CSV option clicked', async () => {
    const data = [{ name: 'Test', value: 1 }]
    render(<ExportMenu getData={() => data} filename="report" />)
    fireEvent.click(screen.getByText('Export as CSV'))

    await waitFor(() => {
      expect(mockDownloadCSV).toHaveBeenCalledWith(data, 'report')
    })
  })

  it('calls downloadExcel when Excel option clicked', async () => {
    const data = [{ name: 'Test', value: 1 }]
    render(<ExportMenu getData={() => data} filename="report" sheetName="Sheet1" />)
    fireEvent.click(screen.getByText('Export as Excel'))

    await waitFor(() => {
      expect(mockDownloadExcel).toHaveBeenCalledWith(data, 'report', 'Sheet1')
    })
  })

  it('shows success toast after export', async () => {
    const data = [{ name: 'A' }, { name: 'B' }]
    render(<ExportMenu getData={() => data} filename="test" />)
    fireEvent.click(screen.getByText('Export as CSV'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Exported', description: '2 rows exported as CSV' })
      )
    })
  })

  it('shows "No data" toast when getData returns empty', async () => {
    render(<ExportMenu getData={() => []} filename="test" />)
    fireEvent.click(screen.getByText('Export as CSV'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'No data' })
      )
    })
  })

  it('shows error toast on export failure', async () => {
    render(
      <ExportMenu
        getData={() => { throw new Error('fail') }}
        filename="test"
      />
    )
    fireEvent.click(screen.getByText('Export as CSV'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Export failed' })
      )
    })
  })

  it('handles async getData', async () => {
    const data = [{ id: 1 }]
    const asyncGetData = () => Promise.resolve(data)
    render(<ExportMenu getData={asyncGetData} filename="async-report" />)
    fireEvent.click(screen.getByText('Export as CSV'))

    await waitFor(() => {
      expect(mockDownloadCSV).toHaveBeenCalledWith(data, 'async-report')
    })
  })

  it('uses default sheetName "Data"', async () => {
    const data = [{ id: 1 }]
    render(<ExportMenu getData={() => data} filename="report" />)
    fireEvent.click(screen.getByText('Export as Excel'))

    await waitFor(() => {
      expect(mockDownloadExcel).toHaveBeenCalledWith(data, 'report', 'Data')
    })
  })
})
