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
  Button: ({ children, onClick, disabled, type, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} type={type} {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ id, checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked || false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      data-testid={`checkbox-${id}`}
    />
  ),
}))

// Mock canvas context
const mockCtx = {
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  closePath: vi.fn(),
  clearRect: vi.fn(),
  fillText: vi.fn(),
  scale: vi.fn(),
  drawImage: vi.fn(),
  putImageData: vi.fn(),
  getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
  strokeStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
  fillStyle: '',
  font: '',
}

// Mock HTMLCanvasElement.getContext and toDataURL
const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx)
  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mockSignature')
})

import { SignaturePad } from '@/components/forms/signature-pad'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SignaturePad', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })
  })

  it('renders canvas element', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} />)
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders Undo button (disabled initially)', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} />)
    const undoBtn = screen.getByText('Undo')
    expect(undoBtn.closest('button')).toBeDisabled()
  })

  it('renders Clear button (disabled initially)', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} />)
    const clearBtn = screen.getByText('Clear')
    expect(clearBtn.closest('button')).toBeDisabled()
  })

  it('renders agreement checkbox', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} />)
    expect(screen.getByTestId('checkbox-agree')).toBeInTheDocument()
  })

  it('renders default agreement label', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} />)
    expect(screen.getByText('I agree to the terms and conditions above')).toBeInTheDocument()
  })

  it('renders custom label', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} label="I authorize treatment" />)
    expect(screen.getByText('I authorize treatment')).toBeInTheDocument()
  })

  it('shows signed date', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} />)
    expect(screen.getByText(/Signed on:/)).toBeInTheDocument()
  })

  it('renders unchecked agreement by default', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} />)
    const checkbox = screen.getByTestId('checkbox-agree')
    expect(checkbox).not.toBeChecked()
  })

  it('draws placeholder text on init', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} />)
    expect(mockCtx.fillText).toHaveBeenCalledWith('Sign here', 20, expect.any(Number))
  })

  it('sets canvas dimensions from props', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} width={600} height={300} />)
    const canvas = document.querySelector('canvas')
    expect(canvas.style.width).toBe('600px')
    expect(canvas.style.height).toBe('300px')
  })

  it('uses default dimensions when not provided', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} />)
    const canvas = document.querySelector('canvas')
    expect(canvas.style.width).toBe('500px')
    expect(canvas.style.height).toBe('200px')
  })

  it('handles mouse events on canvas', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} />)
    const canvas = document.querySelector('canvas')

    // Simulate drawing
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 })
    expect(mockCtx.beginPath).toHaveBeenCalled()
    expect(mockCtx.moveTo).toHaveBeenCalled()

    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 })
    expect(mockCtx.lineTo).toHaveBeenCalled()

    fireEvent.mouseUp(canvas)
    expect(mockCtx.closePath).toHaveBeenCalled()
  })

  it('clears canvas when Clear clicked', () => {
    render(<SignaturePad onSignatureChange={mockOnChange} />)
    const canvas = document.querySelector('canvas')

    // Draw something first
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 })
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 })
    fireEvent.mouseUp(canvas)

    // Clear should be enabled now
    fireEvent.click(screen.getByText('Clear'))
    expect(mockCtx.clearRect).toHaveBeenCalled()
    expect(mockOnChange).toHaveBeenCalledWith(null)
  })
})
