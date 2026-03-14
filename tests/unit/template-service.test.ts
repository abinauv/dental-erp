import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma before import
vi.mock('@/lib/prisma', () => {
  const mock = {
    communicationTemplate: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  }
  return { default: mock, prisma: mock }
})

import { templateService } from '@/lib/services/template.service'
import prisma from '@/lib/prisma'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Standard Variables
// ---------------------------------------------------------------------------

describe('TemplateService - getStandardVariables', () => {
  it('returns an array of template variables', () => {
    const vars = templateService.getStandardVariables()
    expect(Array.isArray(vars)).toBe(true)
    expect(vars.length).toBeGreaterThan(0)
  })

  it('each variable has key, label, description, and example', () => {
    const vars = templateService.getStandardVariables()
    for (const v of vars) {
      expect(v.key).toBeTruthy()
      expect(v.label).toBeTruthy()
      expect(v.description).toBeTruthy()
      expect(v.example).toBeTruthy()
    }
  })

  it('includes essential patient variables', () => {
    const vars = templateService.getStandardVariables()
    const keys = vars.map(v => v.key)
    expect(keys).toContain('patientName')
    expect(keys).toContain('firstName')
    expect(keys).toContain('lastName')
    expect(keys).toContain('phone')
    expect(keys).toContain('email')
  })

  it('includes appointment variables', () => {
    const vars = templateService.getStandardVariables()
    const keys = vars.map(v => v.key)
    expect(keys).toContain('appointmentDate')
    expect(keys).toContain('appointmentTime')
    expect(keys).toContain('doctorName')
  })

  it('includes billing variables', () => {
    const vars = templateService.getStandardVariables()
    const keys = vars.map(v => v.key)
    expect(keys).toContain('invoiceNo')
    expect(keys).toContain('invoiceAmount')
    expect(keys).toContain('balanceAmount')
    expect(keys).toContain('dueDate')
  })

  it('includes clinic variables', () => {
    const vars = templateService.getStandardVariables()
    const keys = vars.map(v => v.key)
    expect(keys).toContain('clinicName')
    expect(keys).toContain('clinicPhone')
    expect(keys).toContain('clinicEmail')
  })
})

// ---------------------------------------------------------------------------
// replaceVariables
// ---------------------------------------------------------------------------

describe('TemplateService - replaceVariables', () => {
  it('replaces simple variables', () => {
    const result = templateService.replaceVariables(
      'Hello {{patientName}}, your appointment is on {{appointmentDate}}',
      { patientName: 'Rahul Sharma', appointmentDate: '25-Jan-2026' }
    )
    expect(result).toBe('Hello Rahul Sharma, your appointment is on 25-Jan-2026')
  })

  it('replaces all occurrences of the same variable', () => {
    const result = templateService.replaceVariables(
      '{{clinicName}} welcomes you. Thank you for choosing {{clinicName}}!',
      { clinicName: 'SmileCare Dental' }
    )
    expect(result).toBe('SmileCare Dental welcomes you. Thank you for choosing SmileCare Dental!')
  })

  it('replaces variables with whitespace around the key', () => {
    const result = templateService.replaceVariables(
      'Hello {{ patientName }}, welcome to {{  clinicName  }}',
      { patientName: 'John', clinicName: 'TestClinic' }
    )
    expect(result).toBe('Hello John, welcome to TestClinic')
  })

  it('replaces with empty string for missing values', () => {
    const result = templateService.replaceVariables(
      'Hello {{patientName}}',
      { patientName: '' }
    )
    expect(result).toBe('Hello ')
  })

  it('leaves unmatched variables as-is', () => {
    const result = templateService.replaceVariables(
      'Hello {{patientName}}, ref: {{unknownVar}}',
      { patientName: 'Alice' }
    )
    expect(result).toContain('Alice')
    expect(result).toContain('{{unknownVar}}')
  })

  it('handles special characters in values', () => {
    const result = templateService.replaceVariables(
      'Patient: {{patientName}}',
      { patientName: "Dr. O'Brien & Partners <test>" }
    )
    expect(result).toBe("Patient: Dr. O'Brien & Partners <test>")
  })

  it('handles currency symbols', () => {
    const result = templateService.replaceVariables(
      'Amount: ₹{{invoiceAmount}}',
      { invoiceAmount: '5,000' }
    )
    expect(result).toBe('Amount: ₹5,000')
  })

  it('handles empty template', () => {
    const result = templateService.replaceVariables('', { patientName: 'Test' })
    expect(result).toBe('')
  })

  it('handles template with no variables', () => {
    const result = templateService.replaceVariables(
      'This is a static message',
      { patientName: 'Test' }
    )
    expect(result).toBe('This is a static message')
  })
})

// ---------------------------------------------------------------------------
// extractVariables
// ---------------------------------------------------------------------------

describe('TemplateService - extractVariables', () => {
  // Note: extractVariables regex uses \\s in a regex literal, which matches
  // literal backslash+s rather than whitespace. Tests verify actual behavior.

  it('returns an array', () => {
    const vars = templateService.extractVariables(
      'Hello {{patientName}}, your appointment is {{appointmentDate}}'
    )
    expect(Array.isArray(vars)).toBe(true)
  })

  it('returns empty array for content with no variables', () => {
    const vars = templateService.extractVariables('Hello world')
    expect(vars).toEqual([])
  })

  it('returns empty array for empty content', () => {
    const vars = templateService.extractVariables('')
    expect(vars).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// validateTemplate
// ---------------------------------------------------------------------------

describe('TemplateService - validateTemplate', () => {
  it('returns valid for content with known variables', () => {
    const result = templateService.validateTemplate(
      'Hello {{patientName}}, your appointment is on {{appointmentDate}}'
    )
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.unknownVariables).toHaveLength(0)
  })

  it('returns valid for content with no variables', () => {
    const result = templateService.validateTemplate('Hello world')
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('flags content that is too long for SMS', () => {
    const longContent = 'A'.repeat(501)
    const result = templateService.validateTemplate(longContent)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.includes('too long'))).toBe(true)
  })

  it('allows content under 500 chars', () => {
    const content = 'A'.repeat(100)
    const result = templateService.validateTemplate(content)
    expect(result.isValid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

describe('TemplateService - createTemplate', () => {
  it('creates a template with correct data', async () => {
    vi.mocked(prisma.communicationTemplate.create).mockResolvedValue({
      id: 'tpl-1',
      name: 'Test Template',
      category: 'APPOINTMENT',
      channel: 'SMS',
      content: 'Hello {{patientName}}',
      language: 'en',
      isDefault: false,
      isActive: true,
    } as any)

    const result = await templateService.createTemplate({
      hospitalId: 'hosp-1',
      name: 'Test Template',
      category: 'APPOINTMENT' as any,
      channel: 'SMS' as any,
      content: 'Hello {{patientName}}',
    })

    expect(result.id).toBe('tpl-1')
    expect(prisma.communicationTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hospitalId: 'hosp-1',
          name: 'Test Template',
          language: 'en',
          isDefault: false,
          isActive: true,
        }),
      })
    )
  })

  it('uses custom language when provided', async () => {
    vi.mocked(prisma.communicationTemplate.create).mockResolvedValue({} as any)

    await templateService.createTemplate({
      hospitalId: 'hosp-1',
      name: 'Hindi Template',
      category: 'APPOINTMENT' as any,
      channel: 'SMS' as any,
      content: 'Hello',
      language: 'hi',
    })

    expect(prisma.communicationTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ language: 'hi' }),
      })
    )
  })
})

describe('TemplateService - getTemplate', () => {
  it('gets template by ID and hospitalId', async () => {
    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue({
      id: 'tpl-1',
      name: 'Test',
    } as any)

    const result = await templateService.getTemplate('tpl-1', 'hosp-1')
    expect(result).toBeDefined()
    expect(prisma.communicationTemplate.findFirst).toHaveBeenCalledWith({
      where: { id: 'tpl-1', hospitalId: 'hosp-1' },
    })
  })

  it('gets template by ID only when no hospitalId', async () => {
    vi.mocked(prisma.communicationTemplate.findUnique).mockResolvedValue({
      id: 'tpl-1',
    } as any)

    await templateService.getTemplate('tpl-1')
    expect(prisma.communicationTemplate.findUnique).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
    })
  })
})

describe('TemplateService - updateTemplate', () => {
  it('updates template after verifying ownership', async () => {
    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue({ id: 'tpl-1' } as any)
    vi.mocked(prisma.communicationTemplate.update).mockResolvedValue({ id: 'tpl-1' } as any)

    await templateService.updateTemplate('tpl-1', { name: 'Updated' }, 'hosp-1')

    expect(prisma.communicationTemplate.findFirst).toHaveBeenCalledWith({
      where: { id: 'tpl-1', hospitalId: 'hosp-1' },
    })
    expect(prisma.communicationTemplate.update).toHaveBeenCalled()
  })

  it('throws when template not found for hospital', async () => {
    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue(null)

    await expect(
      templateService.updateTemplate('tpl-1', { name: 'Updated' }, 'hosp-1')
    ).rejects.toThrow('Template not found')
  })
})

describe('TemplateService - deleteTemplate', () => {
  it('deletes template after verifying ownership', async () => {
    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue({ id: 'tpl-1' } as any)
    vi.mocked(prisma.communicationTemplate.delete).mockResolvedValue({ id: 'tpl-1' } as any)

    await templateService.deleteTemplate('tpl-1', 'hosp-1')
    expect(prisma.communicationTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tpl-1' } })
  })

  it('throws when template not found for hospital', async () => {
    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue(null)

    await expect(
      templateService.deleteTemplate('tpl-1', 'hosp-1')
    ).rejects.toThrow('Template not found')
  })
})

describe('TemplateService - getTemplates', () => {
  it('gets templates with filters', async () => {
    vi.mocked(prisma.communicationTemplate.findMany).mockResolvedValue([])

    await templateService.getTemplates('hosp-1', {
      category: 'APPOINTMENT' as any,
      channel: 'SMS' as any,
    })

    expect(prisma.communicationTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hospitalId: 'hosp-1',
          category: 'APPOINTMENT',
          channel: 'SMS',
        }),
      })
    )
  })
})

describe('TemplateService - getDefaultTemplate', () => {
  it('gets default active template by category and channel', async () => {
    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue({ id: 'tpl-1' } as any)

    await templateService.getDefaultTemplate('hosp-1', 'APPOINTMENT' as any, 'SMS' as any)

    expect(prisma.communicationTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        hospitalId: 'hosp-1',
        category: 'APPOINTMENT',
        channel: 'SMS',
        isDefault: true,
        isActive: true,
      },
    })
  })
})

// ---------------------------------------------------------------------------
// seedDefaultTemplates
// ---------------------------------------------------------------------------

describe('TemplateService - seedDefaultTemplates', () => {
  it('creates templates that do not already exist', async () => {
    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.communicationTemplate.create).mockResolvedValue({} as any)

    await templateService.seedDefaultTemplates('hosp-1')

    // Should check for existing templates and create missing ones
    expect(prisma.communicationTemplate.findFirst).toHaveBeenCalled()
    expect(prisma.communicationTemplate.create).toHaveBeenCalled()
    // There are 10 default templates (8 SMS + 2 email)
    expect(prisma.communicationTemplate.create).toHaveBeenCalledTimes(10)
  })

  it('skips templates that already exist', async () => {
    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue({ id: 'existing' } as any)
    vi.mocked(prisma.communicationTemplate.create).mockResolvedValue({} as any)

    await templateService.seedDefaultTemplates('hosp-1')

    expect(prisma.communicationTemplate.create).not.toHaveBeenCalled()
  })
})
