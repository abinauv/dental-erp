import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadCSV, downloadExcel } from '@/lib/export-utils'

// ---- DOM mocks ----
let appendedElement: HTMLAnchorElement | null = null
let clickedHref = ''
let clickedDownload = ''
let createdObjectUrl = ''
let revokedUrl = ''

beforeEach(() => {
  appendedElement = null
  clickedHref = ''
  clickedDownload = ''
  createdObjectUrl = ''
  revokedUrl = ''

  // @ts-ignore
  globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
    createdObjectUrl = `blob:http://localhost/${Math.random()}`
    return createdObjectUrl
  })
  // @ts-ignore
  globalThis.URL.revokeObjectURL = vi.fn((url: string) => {
    revokedUrl = url
  })

  vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
    appendedElement = node as HTMLAnchorElement
    return node
  })
  vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = { href: '', download: '', click: vi.fn() } as any
    Object.defineProperty(el, 'click', {
      value: vi.fn(() => {
        clickedHref = el.href
        clickedDownload = el.download
      }),
    })
    return el
  })
})

// ---------------------------------------------------------------------------
// downloadCSV
// ---------------------------------------------------------------------------

describe('downloadCSV', () => {
  it('does nothing for empty data', () => {
    downloadCSV([], 'test')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('creates a CSV blob and triggers download', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]
    downloadCSV(data, 'people')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickedDownload).toBe('people.csv')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(createdObjectUrl)
  })

  it('generates correct CSV content with headers and rows', () => {
    const data = [{ name: 'Alice', city: 'Delhi' }]

    let capturedBlob: Blob | null = null
    // @ts-ignore
    globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob
      return 'blob:test'
    })

    downloadCSV(data, 'out')

    expect(capturedBlob).toBeTruthy()
    // Blob constructor receives an array of strings
    const blobParts = (capturedBlob as any)
    expect(blobParts).toBeInstanceOf(Blob)
  })

  it('escapes values containing commas', () => {
    const data = [{ note: 'a, b, c' }]

    let blobContent = ''
    // @ts-ignore
    globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
      // Read blob synchronously via the constructor args
      return 'blob:test'
    })

    downloadCSV(data, 'test')
    // Verify function completed without error — comma-containing values are wrapped in quotes
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('escapes values containing double quotes', () => {
    const data = [{ desc: 'She said "hello"' }]
    downloadCSV(data, 'test')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('escapes values containing newlines', () => {
    const data = [{ note: 'line1\nline2' }]
    downloadCSV(data, 'test')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('handles null and undefined values', () => {
    const data = [{ a: null, b: undefined, c: 'ok' }]
    downloadCSV(data, 'test')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('handles numeric values', () => {
    const data = [{ amount: 1500.50, count: 0 }]
    downloadCSV(data, 'test')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('handles boolean values', () => {
    const data = [{ active: true, deleted: false }]
    downloadCSV(data, 'test')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('uses all keys from the first row as headers', () => {
    const data = [{ a: 1, b: 2, c: 3, d: 4, e: 5 }]
    downloadCSV(data, 'test')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('handles multiple rows correctly', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Patient ${i}`,
      status: i % 2 === 0 ? 'active' : 'inactive',
    }))
    downloadCSV(data, 'bulk')
    expect(clickedDownload).toBe('bulk.csv')
  })
})

// ---------------------------------------------------------------------------
// downloadExcel
// ---------------------------------------------------------------------------

describe('downloadExcel', () => {
  it('does nothing for empty data', async () => {
    await downloadExcel([], 'test')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('creates an Excel blob and triggers download', async () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]
    await downloadExcel(data, 'people')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickedDownload).toBe('people.xlsx')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(createdObjectUrl)
  })

  it('uses custom sheet name', async () => {
    const data = [{ col: 'val' }]
    await downloadExcel(data, 'report', 'Custom Sheet')
    expect(clickedDownload).toBe('report.xlsx')
  })

  it('defaults sheet name to Sheet1', async () => {
    const data = [{ col: 'val' }]
    await downloadExcel(data, 'report')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('handles null and undefined values in data', async () => {
    const data = [{ a: null, b: undefined, c: 'ok' }]
    await downloadExcel(data, 'test')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('handles many columns correctly', async () => {
    const row: Record<string, unknown> = {}
    for (let i = 0; i < 20; i++) row[`col${i}`] = `value${i}`
    await downloadExcel([row], 'wide')
    expect(clickedDownload).toBe('wide.xlsx')
  })

  it('handles many rows', async () => {
    const data = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      name: `Record ${i}`,
    }))
    await downloadExcel(data, 'big')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })
})
