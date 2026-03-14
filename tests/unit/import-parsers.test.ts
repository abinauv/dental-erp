import { describe, it, expect, vi } from 'vitest'
import { parseFile } from '@/lib/import/parsers'

// ---------------------------------------------------------------------------
// parseFile — dispatcher
// ---------------------------------------------------------------------------

describe('parseFile — dispatcher', () => {
  it('throws for unsupported file type', async () => {
    await expect(parseFile(Buffer.from(''), 'doc')).rejects.toThrow('Unsupported file type')
  })

  it('throws for txt file type', async () => {
    await expect(parseFile(Buffer.from(''), 'txt')).rejects.toThrow('Unsupported file type')
  })
})

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

describe('parseFile — CSV', () => {
  it('parses a simple CSV with headers and data', async () => {
    const csv = 'Name,Age,City\nAlice,30,Delhi\nBob,25,Mumbai'
    const result = await parseFile(Buffer.from(csv), 'csv')

    expect(result.columns).toEqual(['Name', 'Age', 'City'])
    expect(result.rows).toHaveLength(2)
    expect(result.totalRows).toBe(2)
    expect(result.rows[0].Name).toBe('Alice')
    expect(result.rows[0].Age).toBe('30')
    expect(result.rows[0].City).toBe('Delhi')
    expect(result.rows[1].Name).toBe('Bob')
  })

  it('throws for empty CSV', async () => {
    await expect(parseFile(Buffer.from(''), 'csv')).rejects.toThrow()
  })

  it('throws for CSV with only headers', async () => {
    const csv = 'Name,Age,City'
    await expect(parseFile(Buffer.from(csv), 'csv')).rejects.toThrow('no data rows')
  })

  it('handles CSV with quoted values', async () => {
    const csv = 'Name,Description\nAlice,"A, B, C"\nBob,"He said ""hello"""'
    const result = await parseFile(Buffer.from(csv), 'csv')

    expect(result.columns).toEqual(['Name', 'Description'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].Description).toBe('A, B, C')
  })

  it('handles CSV with numeric values', async () => {
    const csv = 'Item,Price,Qty\nWidget,1500.50,10\nGadget,2999,5'
    const result = await parseFile(Buffer.from(csv), 'csv')

    expect(result.rows[0].Price).toBe('1500.5')
    expect(result.rows[0].Qty).toBe('10')
  })

  it('skips empty rows', async () => {
    const csv = 'Name,Age\nAlice,30\n\n\nBob,25'
    const result = await parseFile(Buffer.from(csv), 'csv')

    // Empty rows should be skipped
    expect(result.rows.length).toBeGreaterThanOrEqual(2)
    const names = result.rows.map(r => r.Name).filter(Boolean)
    expect(names).toContain('Alice')
    expect(names).toContain('Bob')
  })

  it('handles CSV with many columns', async () => {
    const headers = Array.from({ length: 20 }, (_, i) => `Col${i}`).join(',')
    const values = Array.from({ length: 20 }, (_, i) => `val${i}`).join(',')
    const csv = `${headers}\n${values}`
    const result = await parseFile(Buffer.from(csv), 'csv')

    expect(result.columns).toHaveLength(20)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].Col0).toBe('val0')
    expect(result.rows[0].Col19).toBe('val19')
  })

  it('handles CSV with many rows', async () => {
    const header = 'ID,Name'
    const rows = Array.from({ length: 100 }, (_, i) => `${i},Patient${i}`).join('\n')
    const csv = `${header}\n${rows}`
    const result = await parseFile(Buffer.from(csv), 'csv')

    expect(result.totalRows).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// Excel parsing
// ---------------------------------------------------------------------------

describe('parseFile — Excel', () => {
  it('parses an Excel buffer', async () => {
    // Create a minimal Excel file using ExcelJS
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Data')
    sheet.addRow(['Name', 'Age', 'City'])
    sheet.addRow(['Alice', 30, 'Delhi'])
    sheet.addRow(['Bob', 25, 'Mumbai'])

    const buffer = await workbook.xlsx.writeBuffer()
    const result = await parseFile(Buffer.from(buffer as ArrayBuffer), 'xlsx')

    expect(result.columns).toEqual(['Name', 'Age', 'City'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].Name).toBe('Alice')
    expect(result.rows[0].Age).toBe('30')
    expect(result.rows[1].City).toBe('Mumbai')
  })

  it('handles Excel with date values', async () => {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Data')
    sheet.addRow(['Name', 'DOB'])
    sheet.addRow(['Alice', new Date('2000-06-15')])

    const buffer = await workbook.xlsx.writeBuffer()
    const result = await parseFile(Buffer.from(buffer as ArrayBuffer), 'xlsx')

    expect(result.rows[0].DOB).toBe('2000-06-15')
  })

  it('throws for empty Excel file', async () => {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Empty')

    const buffer = await workbook.xlsx.writeBuffer()
    await expect(parseFile(Buffer.from(buffer as ArrayBuffer), 'xlsx')).rejects.toThrow('no data rows')
  })

  it('handles Excel with null cells', async () => {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Data')
    sheet.addRow(['Name', 'Phone', 'Email'])
    sheet.addRow(['Alice', null, 'alice@test.com'])

    const buffer = await workbook.xlsx.writeBuffer()
    const result = await parseFile(Buffer.from(buffer as ArrayBuffer), 'xlsx')

    expect(result.rows[0].Name).toBe('Alice')
    expect(result.rows[0].Phone).toBe('')
    expect(result.rows[0].Email).toBe('alice@test.com')
  })
})
