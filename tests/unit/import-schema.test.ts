import { describe, it, expect } from 'vitest'
import {
  ENTITY_SCHEMAS,
  GENDER_ALIASES,
  BLOOD_GROUP_ALIASES,
  APPOINTMENT_TYPE_ALIASES,
  APPOINTMENT_STATUS_ALIASES,
  TREATMENT_STATUS_ALIASES,
  INVOICE_STATUS_ALIASES,
  PAYMENT_METHOD_ALIASES,
  PAYMENT_STATUS_ALIASES,
  resolveEnum,
  parseDate,
  coerceValue,
} from '@/lib/import/schema-definitions'
import type { FieldDefinition } from '@/lib/import/schema-definitions'

// ---------------------------------------------------------------------------
// ENTITY_SCHEMAS — structure validation
// ---------------------------------------------------------------------------

describe('ENTITY_SCHEMAS', () => {
  const expectedEntities = ['patients', 'staff', 'appointments', 'treatments', 'invoices', 'payments', 'inventory']

  it('has all 7 entity types', () => {
    expect(Object.keys(ENTITY_SCHEMAS).sort()).toEqual(expectedEntities.sort())
  })

  it.each(expectedEntities)('entity "%s" has required properties', (entity) => {
    const schema = ENTITY_SCHEMAS[entity]
    expect(schema.entityType).toBe(entity)
    expect(schema.prismaModel).toBeTruthy()
    expect(schema.label).toBeTruthy()
    expect(schema.description).toBeTruthy()
    expect(schema.uniqueKey.length).toBeGreaterThan(0)
    expect(Array.isArray(schema.fields)).toBe(true)
    expect(schema.fields.length).toBeGreaterThan(0)
  })

  it.each(expectedEntities)('entity "%s" has auto-generate config', (entity) => {
    const schema = ENTITY_SCHEMAS[entity]
    expect(schema.autoGenerateId).toBeTruthy()
    expect(schema.autoGeneratePrefix).toBeTruthy()
  })

  it('patients has required fields firstName, lastName, phone', () => {
    const required = ENTITY_SCHEMAS.patients.fields
      .filter(f => f.required)
      .map(f => f.name)
    expect(required).toContain('firstName')
    expect(required).toContain('lastName')
    expect(required).toContain('phone')
  })

  it('staff has required fields firstName, lastName, phone, email', () => {
    const required = ENTITY_SCHEMAS.staff.fields
      .filter(f => f.required)
      .map(f => f.name)
    expect(required).toContain('firstName')
    expect(required).toContain('lastName')
    expect(required).toContain('phone')
    expect(required).toContain('email')
  })

  it('each field has name, type, required, and description', () => {
    for (const entity of expectedEntities) {
      for (const field of ENTITY_SCHEMAS[entity].fields) {
        expect(field.name).toBeTruthy()
        expect(field.type).toBeTruthy()
        expect(typeof field.required).toBe('boolean')
        expect(field.description).toBeTruthy()
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Enum Aliases
// ---------------------------------------------------------------------------

describe('Enum Aliases', () => {
  it('GENDER_ALIASES maps common variants to uppercase', () => {
    expect(GENDER_ALIASES['M']).toBe('MALE')
    expect(GENDER_ALIASES['F']).toBe('FEMALE')
    expect(GENDER_ALIASES['Male']).toBe('MALE')
    expect(GENDER_ALIASES['female']).toBe('FEMALE')
    expect(GENDER_ALIASES['O']).toBe('OTHER')
  })

  it('BLOOD_GROUP_ALIASES maps common formats', () => {
    expect(BLOOD_GROUP_ALIASES['A+']).toBe('A_POSITIVE')
    expect(BLOOD_GROUP_ALIASES['O-']).toBe('O_NEGATIVE')
    expect(BLOOD_GROUP_ALIASES['AB+ve']).toBe('AB_POSITIVE')
    expect(BLOOD_GROUP_ALIASES['b+']).toBe('B_POSITIVE')
  })

  it('APPOINTMENT_TYPE_ALIASES maps common names', () => {
    expect(APPOINTMENT_TYPE_ALIASES['Follow Up']).toBe('FOLLOW_UP')
    expect(APPOINTMENT_TYPE_ALIASES['Follow-Up']).toBe('FOLLOW_UP')
    expect(APPOINTMENT_TYPE_ALIASES['Check Up']).toBe('CHECK_UP')
    expect(APPOINTMENT_TYPE_ALIASES['consultation']).toBe('CONSULTATION')
  })

  it('PAYMENT_METHOD_ALIASES maps various payment types', () => {
    expect(PAYMENT_METHOD_ALIASES['Cash']).toBe('CASH')
    expect(PAYMENT_METHOD_ALIASES['Credit Card']).toBe('CARD')
    expect(PAYMENT_METHOD_ALIASES['NEFT']).toBe('BANK_TRANSFER')
    expect(PAYMENT_METHOD_ALIASES['upi']).toBe('UPI')
  })
})

// ---------------------------------------------------------------------------
// resolveEnum
// ---------------------------------------------------------------------------

describe('resolveEnum', () => {
  const enumValues = ['MALE', 'FEMALE', 'OTHER']

  it('returns exact match', () => {
    expect(resolveEnum('MALE', enumValues)).toBe('MALE')
  })

  it('returns alias match', () => {
    expect(resolveEnum('M', enumValues, GENDER_ALIASES)).toBe('MALE')
    expect(resolveEnum('f', enumValues, GENDER_ALIASES)).toBe('FEMALE')
  })

  it('returns case-insensitive match', () => {
    expect(resolveEnum('male', enumValues)).toBe('MALE')
    expect(resolveEnum('Female', enumValues)).toBe('FEMALE')
  })

  it('returns null for empty string', () => {
    expect(resolveEnum('', enumValues)).toBeNull()
  })

  it('returns null for unknown value', () => {
    expect(resolveEnum('UNKNOWN', enumValues)).toBeNull()
  })

  it('trims whitespace', () => {
    expect(resolveEnum('  MALE  ', enumValues)).toBe('MALE')
  })

  it('handles hyphenated to underscore conversion', () => {
    const statuses = ['FOLLOW_UP', 'CHECK_UP', 'IN_PROGRESS']
    expect(resolveEnum('FOLLOW-UP', statuses)).toBe('FOLLOW_UP')
    expect(resolveEnum('IN-PROGRESS', statuses)).toBe('IN_PROGRESS')
  })
})

// ---------------------------------------------------------------------------
// parseDate
// ---------------------------------------------------------------------------

describe('parseDate', () => {
  it('parses ISO format (YYYY-MM-DD)', () => {
    const d = parseDate('2025-02-17')
    expect(d).toBeTruthy()
    expect(d!.getFullYear()).toBe(2025)
    expect(d!.getMonth()).toBe(1) // 0-indexed
    expect(d!.getDate()).toBe(17)
  })

  it('parses DD/MM/YYYY (Indian format)', () => {
    const d = parseDate('17/02/2025')
    expect(d).toBeTruthy()
    expect(d!.getFullYear()).toBe(2025)
    expect(d!.getMonth()).toBe(1)
    expect(d!.getDate()).toBe(17)
  })

  it('parses DD-MM-YYYY', () => {
    const d = parseDate('17-02-2025')
    expect(d).toBeTruthy()
    expect(d!.getDate()).toBe(17)
  })

  it('parses DD MMM YYYY (e.g., 17 Feb 2025)', () => {
    const d = parseDate('17 Feb 2025')
    expect(d).toBeTruthy()
    expect(d!.getFullYear()).toBe(2025)
  })

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull()
  })

  it('returns null for invalid date', () => {
    expect(parseDate('not-a-date')).toBeNull()
  })

  it('returns null for null-like value', () => {
    expect(parseDate('')).toBeNull()
  })

  it('handles single-digit day/month', () => {
    const d = parseDate('1/2/2025')
    expect(d).toBeTruthy()
    expect(d!.getDate()).toBe(1)
    expect(d!.getMonth()).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// coerceValue
// ---------------------------------------------------------------------------

describe('coerceValue', () => {
  // String type
  it('coerces string values', () => {
    const field: FieldDefinition = { name: 'name', type: 'string', required: false, description: 'test' }
    expect(coerceValue('Hello', field)).toEqual({ value: 'Hello' })
  })

  it('trims whitespace from strings', () => {
    const field: FieldDefinition = { name: 'name', type: 'string', required: false, description: 'test' }
    expect(coerceValue('  Hello  ', field)).toEqual({ value: 'Hello' })
  })

  it('returns error for required empty field', () => {
    const field: FieldDefinition = { name: 'name', type: 'string', required: true, description: 'test' }
    const result = coerceValue('', field)
    expect(result.error).toBeTruthy()
    expect(result.value).toBeNull()
  })

  it('returns null for optional empty field', () => {
    const field: FieldDefinition = { name: 'name', type: 'string', required: false, description: 'test' }
    expect(coerceValue('', field)).toEqual({ value: null })
  })

  // Integer type
  it('coerces integer values', () => {
    const field: FieldDefinition = { name: 'age', type: 'integer', required: false, description: 'test' }
    expect(coerceValue('25', field)).toEqual({ value: 25 })
  })

  it('handles comma-separated integers', () => {
    const field: FieldDefinition = { name: 'count', type: 'integer', required: false, description: 'test' }
    expect(coerceValue('1,000', field)).toEqual({ value: 1000 })
  })

  it('returns error for non-numeric integer', () => {
    const field: FieldDefinition = { name: 'age', type: 'integer', required: false, description: 'test' }
    const result = coerceValue('abc', field)
    expect(result.error).toBeTruthy()
  })

  // Decimal type
  it('coerces decimal values', () => {
    const field: FieldDefinition = { name: 'amount', type: 'decimal', required: false, description: 'test' }
    expect(coerceValue('1500.50', field)).toEqual({ value: 1500.50 })
  })

  it('strips currency symbols from decimals', () => {
    const field: FieldDefinition = { name: 'amount', type: 'decimal', required: false, description: 'test' }
    const result = coerceValue('₹1,500.50', field)
    expect(result.value).toBe(1500.50)
  })

  it('rounds decimals to 2 places', () => {
    const field: FieldDefinition = { name: 'amount', type: 'decimal', required: false, description: 'test' }
    const result = coerceValue('99.999', field)
    expect(result.value).toBe(100)
  })

  // Date type
  it('coerces date values', () => {
    const field: FieldDefinition = { name: 'dob', type: 'date', required: false, description: 'test' }
    const result = coerceValue('2025-02-17', field)
    expect(result.value).toBeInstanceOf(Date)
  })

  it('returns error for invalid date', () => {
    const field: FieldDefinition = { name: 'dob', type: 'date', required: false, description: 'test' }
    const result = coerceValue('not-a-date', field)
    expect(result.error).toBeTruthy()
  })

  // Boolean type
  it('coerces boolean values - truthy', () => {
    const field: FieldDefinition = { name: 'active', type: 'boolean', required: false, description: 'test' }
    expect(coerceValue('true', field)).toEqual({ value: true })
    expect(coerceValue('yes', field)).toEqual({ value: true })
    expect(coerceValue('1', field)).toEqual({ value: true })
    expect(coerceValue('Y', field)).toEqual({ value: true })
  })

  it('coerces boolean values - falsy', () => {
    const field: FieldDefinition = { name: 'active', type: 'boolean', required: false, description: 'test' }
    expect(coerceValue('false', field)).toEqual({ value: false })
    expect(coerceValue('no', field)).toEqual({ value: false })
    expect(coerceValue('0', field)).toEqual({ value: false })
    expect(coerceValue('N', field)).toEqual({ value: false })
  })

  it('returns error for invalid boolean', () => {
    const field: FieldDefinition = { name: 'active', type: 'boolean', required: false, description: 'test' }
    const result = coerceValue('maybe', field)
    expect(result.error).toBeTruthy()
  })

  // Enum type
  it('coerces enum values via exact match', () => {
    const field: FieldDefinition = {
      name: 'gender', type: 'enum', required: false, description: 'test',
      enumValues: ['MALE', 'FEMALE', 'OTHER'],
      enumAliases: GENDER_ALIASES,
    }
    expect(coerceValue('MALE', field)).toEqual({ value: 'MALE' })
  })

  it('coerces enum values via alias', () => {
    const field: FieldDefinition = {
      name: 'gender', type: 'enum', required: false, description: 'test',
      enumValues: ['MALE', 'FEMALE', 'OTHER'],
      enumAliases: GENDER_ALIASES,
    }
    expect(coerceValue('M', field)).toEqual({ value: 'MALE' })
    expect(coerceValue('female', field)).toEqual({ value: 'FEMALE' })
  })

  it('returns error for unknown enum value', () => {
    const field: FieldDefinition = {
      name: 'gender', type: 'enum', required: false, description: 'test',
      enumValues: ['MALE', 'FEMALE', 'OTHER'],
    }
    const result = coerceValue('ALIEN', field)
    expect(result.error).toBeTruthy()
  })

  // Pattern validation
  it('validates string against pattern', () => {
    const field: FieldDefinition = {
      name: 'phone', type: 'string', required: false, description: 'test',
      pattern: /^\d{10}$/,
    }
    const valid = coerceValue('9876543210', field)
    expect(valid.error).toBeUndefined()

    const invalid = coerceValue('12345', field)
    expect(invalid.error).toBeTruthy()
  })
})
