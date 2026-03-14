// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    hospital: {
      findUnique: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    appointment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    staff: {
      findFirst: vi.fn(),
    },
    inventoryItem: {
      findMany: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
    },
    treatment: {
      findMany: vi.fn(),
    },
    procedure: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    labOrder: {
      findMany: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    // AI models use Prisma's "aI" prefix convention
    aIConversation: {
      create: vi.fn(),
      count: vi.fn(),
    },
    aISkillExecution: {
      create: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    aIInsight: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    patientRiskScore: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/ai/openrouter', () => ({
  complete: vi.fn(),
  streamResponse: vi.fn(),
  extractJSON: vi.fn((text: string) => text),
}))

vi.mock('@/lib/ai/context-builder', () => ({
  buildContext: vi.fn().mockResolvedValue({
    hospital: { id: 'h1', name: 'Test Clinic', plan: 'PROFESSIONAL' },
    user: { id: 'u1', name: 'Test User', role: 'ADMIN' },
  }),
  serializeContext: vi.fn().mockReturnValue('Hospital: Test Clinic\nUser: Test User (ADMIN)'),
}))

vi.mock('@/lib/ai/models', () => ({
  getModelByTier: vi.fn().mockReturnValue({
    model: 'google/gemini-2.5-pro',
    maxTokens: 4096,
    temperature: 0.7,
  }),
  SKILL_MODEL_MAP: {},
  AI_MODELS: {
    default: { model: 'google/gemini-2.5-pro', maxTokens: 4096, temperature: 0.7 },
  },
}))

vi.mock('@/lib/ai/event-dispatcher', () => ({
  dispatchEvent: vi.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------
import { POST as chatPOST } from '@/app/api/ai/chat/route'
import { POST as commandPOST } from '@/app/api/ai/command/route'
import {
  GET as insightsGET,
  POST as insightsPOST,
  PUT as insightsPUT,
} from '@/app/api/ai/insights/route'
import { GET as usageGET } from '@/app/api/ai/usage/route'
import { POST as clinicalPOST } from '@/app/api/ai/clinical/route'
import { POST as webhooksPOST } from '@/app/api/webhooks/route'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { complete, streamResponse } from '@/lib/ai/openrouter'
import { dispatchEvent } from '@/lib/ai/event-dispatcher'

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
function mockAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Test User', role: 'ADMIN' },
    hospitalId: 'h1',
  }
  vi.mocked(requireAuthAndRole).mockResolvedValue({ ...defaults, ...overrides } as any)
}

function mockAuthError() {
  vi.mocked(requireAuthAndRole).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    user: null,
    hospitalId: null,
  } as any)
}

function mockAuthRole(role: string) {
  mockAuth({ user: { id: 'u1', name: 'Test User', role } })
}

// ---------------------------------------------------------------------------
// Common prisma setup helpers
// ---------------------------------------------------------------------------
function setupHospitalMock() {
  vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
    name: 'Test Clinic',
    plan: 'PROFESSIONAL',
  } as any)
}

// =========================================================================
// 1. POST /api/ai/chat
// =========================================================================
describe('POST /api/ai/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
    setupHospitalMock()
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0)
    vi.mocked(prisma.aIConversation.create).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 'audit-1' } as any)
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()

    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    })
    const res = await chatPOST(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{invalid json',
    })
    const res = await chatPOST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid JSON')
  })

  it('returns 400 when messages array is empty', async () => {
    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    })
    const res = await chatPOST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('messages array is required')
  })

  it('returns 400 when messages field is missing', async () => {
    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    })
    const res = await chatPOST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('messages array is required')
  })

  it('returns 429 when rate limited (100+ recent requests)', async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(100)

    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    })
    const res = await chatPOST(req)

    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toContain('Rate limit')
  })

  it('successfully streams a response', async () => {
    const mockStreamResponse = new Response('data: {"text":"Hi"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
    vi.mocked(streamResponse).mockResolvedValue(mockStreamResponse)

    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    })
    const res = await chatPOST(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(streamResponse).toHaveBeenCalled()
  })

  it('logs AIConversation and AuditLog entries on success', async () => {
    const mockStreamResponse = new Response('data: {"text":"Hi"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
    vi.mocked(streamResponse).mockResolvedValue(mockStreamResponse)

    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    })
    await chatPOST(req)

    expect(prisma.aIConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hospitalId: 'h1',
          userId: 'u1',
          sessionType: 'CHAT',
        }),
      })
    )
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hospitalId: 'h1',
          userId: 'u1',
          action: 'AI_INTERACTION',
          entityType: 'AIConversation',
          entityId: 'chat',
        }),
      })
    )
  })

  it('returns 502 when AI service fails', async () => {
    vi.mocked(streamResponse).mockRejectedValue(new Error('Service unavailable'))

    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    })
    const res = await chatPOST(req)

    expect(res.status).toBe(502)
    const data = await res.json()
    expect(data.error).toBe('Service unavailable')
  })
})

// =========================================================================
// 2. POST /api/ai/command
// =========================================================================
describe('POST /api/ai/command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
    setupHospitalMock()
    vi.mocked(prisma.aISkillExecution.create).mockResolvedValue({ id: 'exec-1' } as any)
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()

    const req = new Request('http://localhost/api/ai/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'check patient John' }),
    })
    const res = await commandPOST(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 for missing command', async () => {
    const req = new Request('http://localhost/api/ai/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await commandPOST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('command is required')
  })

  it('returns 400 for empty command string', async () => {
    const req = new Request('http://localhost/api/ai/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '   ' }),
    })
    const res = await commandPOST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('command is required')
  })

  it('successfully parses and executes check_patient intent', async () => {
    // AI returns the parsed intent
    vi.mocked(complete).mockResolvedValue({
      content: JSON.stringify({
        intent: 'check_patient',
        params: { query: 'John Doe' },
        confidence: 0.95,
        summary: 'Looking up patient John Doe',
        requiresApproval: false,
      }),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'google/gemini-2.5-pro',
    })

    // Patient found
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'p1',
      patientId: 'PAT-001',
      firstName: 'John',
      lastName: 'Doe',
      age: 30,
      phone: '9876543210',
      medicalHistory: { drugAllergies: 'Penicillin', hasDiabetes: false, hasHypertension: false, isPregnant: false, hasBleedingDisorder: false },
      treatmentPlans: [{ title: 'Root Canal', status: 'IN_PROGRESS' }],
      appointments: [{ scheduledDate: new Date('2025-01-15'), appointmentType: 'CONSULTATION', status: 'COMPLETED' }],
      invoices: [{ balanceAmount: 500 }],
    } as any)

    const req = new Request('http://localhost/api/ai/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'check patient John Doe' }),
    })
    const res = await commandPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.intent).toBe('check_patient')
    expect(data.result.success).toBe(true)
    expect(data.result.summary.name).toBe('John Doe')
    expect(data.result.summary.medicalFlags).toContain('Allergies: Penicillin')
  })

  it('successfully executes check_stock intent', async () => {
    vi.mocked(complete).mockResolvedValue({
      content: JSON.stringify({
        intent: 'check_stock',
        params: { itemName: 'Gloves' },
        confidence: 0.9,
        summary: 'Checking stock for Gloves',
        requiresApproval: false,
      }),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'google/gemini-2.5-pro',
    })

    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([
      { name: 'Latex Gloves', currentStock: 200, minimumStock: 50, reorderLevel: 100, unit: 'pairs' },
      { name: 'Nitrile Gloves', currentStock: 30, minimumStock: 50, reorderLevel: 80, unit: 'pairs' },
    ] as any)

    const req = new Request('http://localhost/api/ai/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'check stock gloves' }),
    })
    const res = await commandPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.intent).toBe('check_stock')
    expect(data.result.success).toBe(true)
    expect(data.result.items).toHaveLength(2)
    expect(data.result.items[0].name).toBe('Latex Gloves')
    expect(data.result.items[0].status).toBe('OK')
    expect(data.result.items[1].status).toBe('Critical')
  })

  it('successfully executes check_overdue intent', async () => {
    vi.mocked(complete).mockResolvedValue({
      content: JSON.stringify({
        intent: 'check_overdue',
        params: {},
        confidence: 0.95,
        summary: 'Listing overdue invoices',
        requiresApproval: false,
      }),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'google/gemini-2.5-pro',
    })

    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      {
        invoiceNo: 'INV-001',
        balanceAmount: 2500,
        patient: { firstName: 'Alice', lastName: 'Smith' },
      },
      {
        invoiceNo: 'INV-002',
        balanceAmount: 1500,
        patient: { firstName: 'Bob', lastName: 'Jones' },
      },
    ] as any)

    const req = new Request('http://localhost/api/ai/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'show overdue invoices' }),
    })
    const res = await commandPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.intent).toBe('check_overdue')
    expect(data.result.success).toBe(true)
    expect(data.result.count).toBe(2)
    expect(data.result.invoices).toHaveLength(2)
    expect(data.result.invoices[0].invoiceNo).toBe('INV-001')
  })

  it('logs AISkillExecution after execution', async () => {
    vi.mocked(complete).mockResolvedValue({
      content: JSON.stringify({
        intent: 'check_overdue',
        params: {},
        confidence: 0.95,
        summary: 'Overdue check',
        requiresApproval: false,
      }),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'google/gemini-2.5-pro',
    })
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])

    const req = new Request('http://localhost/api/ai/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'check overdue' }),
    })
    await commandPOST(req)

    expect(prisma.aISkillExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hospitalId: 'h1',
          userId: 'u1',
          skill: 'check_overdue',
          status: expect.any(String),
        }),
      })
    )
  })

  it('falls back to general intent when AI parsing fails', async () => {
    // First call (parsing) rejects, second call (general execution) resolves
    vi.mocked(complete)
      .mockRejectedValueOnce(new Error('Parse error'))
      .mockResolvedValueOnce({
        content: 'Here is some general help.',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'google/gemini-2.5-pro',
      })

    const req = new Request('http://localhost/api/ai/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'what is the meaning of life' }),
    })
    const res = await commandPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.intent).toBe('general')
    expect(data.result.success).toBe(true)
    expect(data.result.message).toBe('Here is some general help.')
  })
})

// =========================================================================
// 3. GET /api/ai/insights
// =========================================================================
describe('GET /api/ai/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()

    const req = new NextRequest('http://localhost/api/ai/insights')
    const res = await insightsGET(req as any)

    expect(res.status).toBe(401)
  })

  it('returns insights list', async () => {
    const mockInsights = [
      {
        id: 'ins-1',
        hospitalId: 'h1',
        category: 'REVENUE',
        severity: 'WARNING',
        title: 'High collection rate drop',
        description: 'Collection rate dropped 15% this month.',
        dismissed: false,
        createdAt: new Date(),
      },
      {
        id: 'ins-2',
        hospitalId: 'h1',
        category: 'INVENTORY',
        severity: 'CRITICAL',
        title: 'Low stock: Composite Resin',
        description: 'Only 5 units remaining.',
        dismissed: false,
        createdAt: new Date(),
      },
    ]
    vi.mocked(prisma.aIInsight.findMany).mockResolvedValue(mockInsights as any)

    const req = new NextRequest('http://localhost/api/ai/insights')
    const res = await insightsGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.insights).toHaveLength(2)
    expect(data.insights[0].category).toBe('REVENUE')
    expect(data.insights[1].category).toBe('INVENTORY')
  })

  it('supports category filter', async () => {
    vi.mocked(prisma.aIInsight.findMany).mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/ai/insights?category=REVENUE')
    await insightsGET(req as any)

    expect(prisma.aIInsight.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hospitalId: 'h1',
          dismissed: false,
          category: 'REVENUE',
        }),
      })
    )
  })
})

// =========================================================================
// 4. PUT /api/ai/insights
// =========================================================================
describe('PUT /api/ai/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('returns 400 for missing id', async () => {
    const req = new Request('http://localhost/api/ai/insights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissed: true }),
    })
    const res = await insightsPUT(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('id is required')
  })

  it('successfully dismisses an insight', async () => {
    vi.mocked(prisma.aIInsight.updateMany).mockResolvedValue({ count: 1 } as any)

    const req = new Request('http://localhost/api/ai/insights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'ins-1', dismissed: true }),
    })
    const res = await insightsPUT(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.updated).toBe(true)
    expect(prisma.aIInsight.updateMany).toHaveBeenCalledWith({
      where: { id: 'ins-1', hospitalId: 'h1' },
      data: { dismissed: true },
    })
  })

  it('returns 404 when insight not found (updateMany count: 0)', async () => {
    vi.mocked(prisma.aIInsight.updateMany).mockResolvedValue({ count: 0 } as any)

    const req = new Request('http://localhost/api/ai/insights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'nonexistent', dismissed: true }),
    })
    const res = await insightsPUT(req)

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Insight not found')
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/ai/insights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{{bad json',
    })
    const res = await insightsPUT(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid JSON')
  })
})

// =========================================================================
// 5. POST /api/ai/insights (generate)
// =========================================================================
describe('POST /api/ai/insights (generate)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('returns 401 for non-ADMIN users', async () => {
    // POST requires ADMIN — requireAuthAndRole(["ADMIN"]) is called
    // If the user is not ADMIN, requireAuthAndRole returns an error
    vi.mocked(requireAuthAndRole).mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      user: null,
      hospitalId: null,
    } as any)

    const req = new Request('http://localhost/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await insightsPOST(req)

    expect(res.status).toBe(403)
  })

  it('generates insights via AI and persists them', async () => {
    // Mock data-gathering queries
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { totalAmount: 10000, paidAmount: 8000, status: 'PAID', createdAt: new Date() },
      { totalAmount: 5000, paidAmount: 0, status: 'OVERDUE', createdAt: new Date() },
    ] as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { status: 'COMPLETED', scheduledDate: new Date(), appointmentType: 'CONSULTATION' },
      { status: 'NO_SHOW', scheduledDate: new Date(), appointmentType: 'FOLLOW_UP' },
    ] as any)
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([
      { name: 'Composite Resin', currentStock: 5, reorderLevel: 20, minimumStock: 10 },
    ] as any)
    vi.mocked(prisma.labOrder.findMany).mockResolvedValue([])

    // AI returns insights
    const aiInsights = [
      {
        category: 'REVENUE',
        severity: 'WARNING',
        title: 'Overdue invoices detected',
        description: '1 overdue invoice totalling 5,000.',
        actionable: true,
      },
      {
        category: 'INVENTORY',
        severity: 'CRITICAL',
        title: 'Low stock: Composite Resin',
        description: 'Only 5 units remaining (reorder level: 20).',
        actionable: true,
      },
    ]
    vi.mocked(complete).mockResolvedValue({
      content: JSON.stringify(aiInsights),
      usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
      model: 'google/gemini-2.5-pro',
    })

    // Mock persisting insights
    vi.mocked(prisma.aIInsight.create)
      .mockResolvedValueOnce({ id: 'ins-new-1', ...aiInsights[0] } as any)
      .mockResolvedValueOnce({ id: 'ins-new-2', ...aiInsights[1] } as any)

    const req = new Request('http://localhost/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await insightsPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.count).toBe(2)
    expect(data.insights).toHaveLength(2)
    expect(prisma.aIInsight.create).toHaveBeenCalledTimes(2)
  })

  it('returns 502 when AI insight generation fails', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.labOrder.findMany).mockResolvedValue([])

    vi.mocked(complete).mockRejectedValue(new Error('AI timeout'))

    const req = new Request('http://localhost/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await insightsPOST(req)

    expect(res.status).toBe(502)
    const data = await res.json()
    expect(data.error).toBe('Insight generation failed')
  })
})

// =========================================================================
// 6. GET /api/ai/usage
// =========================================================================
describe('GET /api/ai/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('returns 401 for non-ADMIN users', async () => {
    vi.mocked(requireAuthAndRole).mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      user: null,
      hospitalId: null,
    } as any)

    const res = await usageGET()

    expect(res.status).toBe(403)
  })

  it('returns usage statistics', async () => {
    // All-time counts
    vi.mocked(prisma.aIConversation.count).mockResolvedValue(150)
    vi.mocked(prisma.aISkillExecution.count)
      .mockResolvedValueOnce(300)   // totalExecs
      .mockResolvedValueOnce(45)    // monthExecs
    vi.mocked(prisma.aIInsight.count).mockResolvedValue(25)

    // Aggregates
    vi.mocked(prisma.aISkillExecution.aggregate)
      .mockResolvedValueOnce({ _sum: { cost: 120.5, tokensUsed: 500000 } } as any) // all-time
      .mockResolvedValueOnce({ _sum: { cost: 30.0, tokensUsed: 100000 } } as any)  // month

    // Skill breakdown
    vi.mocked(prisma.aISkillExecution.findMany).mockResolvedValue([
      { skill: 'check_patient', cost: 5.0 },
      { skill: 'check_patient', cost: 3.0 },
      { skill: 'check_stock', cost: 2.0 },
    ] as any)

    const res = await usageGET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.allTime.conversations).toBe(150)
    expect(data.allTime.executions).toBe(300)
    expect(data.allTime.insights).toBe(25)
    expect(data.allTime.tokens).toBe(500000)
    expect(data.allTime.costINR).toBe(120.5)
    expect(data.thisMonth.executions).toBe(45)
    expect(data.thisMonth.tokens).toBe(100000)
    expect(data.skillBreakdown).toBeDefined()
    expect(Array.isArray(data.skillBreakdown)).toBe(true)
  })
})

// =========================================================================
// 7. POST /api/ai/clinical
// =========================================================================
describe('POST /api/ai/clinical', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('returns 400 for unknown clinical type', async () => {
    const req = new NextRequest('http://localhost/api/ai/clinical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'unknown_type' }),
    })
    const res = await clinicalPOST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Unknown clinical type')
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/ai/clinical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{bad',
    })
    const res = await clinicalPOST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid JSON')
  })

  // -- patient_summary --
  describe('patient_summary', () => {
    it('returns 400 without patientId', async () => {
      const req = new NextRequest('http://localhost/api/ai/clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'patient_summary' }),
      })
      const res = await clinicalPOST(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('patientId required')
    })

    it('returns 404 for missing patient', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)

      const req = new NextRequest('http://localhost/api/ai/clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'patient_summary', patientId: 'p999' }),
      })
      const res = await clinicalPOST(req)

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('Patient not found')
    })

    it('returns a successful patient summary', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({
        id: 'p1',
        firstName: 'Alice',
        lastName: 'Smith',
        age: 32,
        phone: '9876543210',
        aiSummary: null,
        aiSummaryAt: null,
      } as any)

      vi.mocked(prisma.appointment.findMany).mockResolvedValue([
        { scheduledDate: new Date('2025-01-10'), appointmentType: 'CONSULTATION', status: 'COMPLETED' },
      ] as any)
      vi.mocked(prisma.treatment.findMany).mockResolvedValue([
        { status: 'COMPLETED', createdAt: new Date() },
      ] as any)
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([
        { status: 'PENDING', totalAmount: 3000, paidAmount: 1000 },
      ] as any)
      vi.mocked(prisma.patientRiskScore.findMany).mockResolvedValue([
        { overallScore: 35, factors: ['Missed appointments'] },
      ] as any)
      vi.mocked(prisma.patient.update).mockResolvedValue({} as any)

      const summaryResponse = JSON.stringify({
        summary: 'Alice Smith is a 32-year-old patient with one recent visit.',
        highlights: ['Recent consultation completed'],
        flags: [],
        lastVisit: 'Jan 10, 2025',
        nextAction: 'Schedule follow-up',
      })
      vi.mocked(complete).mockResolvedValue({
        content: summaryResponse,
        usage: { promptTokens: 300, completionTokens: 100, totalTokens: 400 },
        model: 'anthropic/claude-opus-4-5-20251101',
      })

      const req = new NextRequest('http://localhost/api/ai/clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'patient_summary', patientId: 'p1' }),
      })
      const res = await clinicalPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.summary).toContain('Alice Smith')
      expect(data.data.nextAction).toBe('Schedule follow-up')
    })
  })

  // -- duplicate_check --
  describe('duplicate_check', () => {
    it('returns empty duplicates when no matching criteria provided', async () => {
      const req = new NextRequest('http://localhost/api/ai/clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'duplicate_check' }),
      })
      const res = await clinicalPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.duplicates).toEqual([])
    })

    it('returns empty duplicates when no candidates found', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([])

      const req = new NextRequest('http://localhost/api/ai/clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'duplicate_check',
          firstName: 'NewPerson',
          lastName: 'NoMatch',
          phone: '1111111111',
        }),
      })
      const res = await clinicalPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.duplicates).toEqual([])
    })

    it('returns duplicate candidates scored by AI', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([
        { id: 'p1', patientId: 'PAT-001', firstName: 'John', lastName: 'Doe', phone: '9876543210', email: null, dateOfBirth: null },
      ] as any)

      const aiDuplicateResult = JSON.stringify({
        duplicates: [
          { id: 'p1', patientId: 'PAT-001', name: 'John Doe', confidence: 0.85, matchFields: ['phone', 'name'] },
        ],
      })
      vi.mocked(complete).mockResolvedValue({
        content: aiDuplicateResult,
        usage: { promptTokens: 200, completionTokens: 80, totalTokens: 280 },
        model: 'google/gemini-2.5-pro',
      })

      const req = new NextRequest('http://localhost/api/ai/clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'duplicate_check',
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
        }),
      })
      const res = await clinicalPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.duplicates).toHaveLength(1)
      expect(data.data.duplicates[0].confidence).toBe(0.85)
    })
  })

  // -- clinical_notes --
  describe('clinical_notes', () => {
    it('returns expanded clinical notes', async () => {
      const expandedNotes = JSON.stringify({
        expandedNotes: 'Patient presented with acute periapical abscess on tooth #36.',
        diagnosis: 'Acute periapical abscess',
        findings: 'Swelling in lower left quadrant, tenderness on percussion',
        procedureNotes: 'Incision and drainage performed under local anesthesia.',
        recommendations: 'Prescribe antibiotics. Review in 48 hours.',
      })
      vi.mocked(complete).mockResolvedValue({
        content: expandedNotes,
        usage: { promptTokens: 200, completionTokens: 150, totalTokens: 350 },
        model: 'google/gemini-2.5-pro',
      })

      const req = new NextRequest('http://localhost/api/ai/clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clinical_notes',
          briefNotes: 'abscess lower left, I&D done',
          procedureName: 'Incision and Drainage',
          diagnosis: 'Abscess',
          findings: 'Swelling LL',
        }),
      })
      const res = await clinicalPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.expandedNotes).toContain('periapical abscess')
      expect(data.data.recommendations).toContain('antibiotics')
    })
  })

  // -- audit_analysis --
  describe('audit_analysis', () => {
    it('returns suspicious patterns from audit logs', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
        { action: 'LOGIN', userId: 'u1', createdAt: new Date(), details: {} },
        { action: 'EXPORT_DATA', userId: 'u1', createdAt: new Date(), details: {} },
      ] as any)

      const analysisResult = JSON.stringify({
        suspicious: [
          {
            pattern: 'Bulk data export after login',
            severity: 'medium',
            affectedUsers: ['u1'],
            occurrences: 1,
            recommendation: 'Verify export was authorized.',
          },
        ],
        summary: 'One moderately suspicious pattern detected.',
      })
      vi.mocked(complete).mockResolvedValue({
        content: analysisResult,
        usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
        model: 'google/gemini-2.5-pro',
      })

      const req = new NextRequest('http://localhost/api/ai/clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'audit_analysis', daysBack: 7 }),
      })
      const res = await clinicalPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.suspicious).toHaveLength(1)
      expect(data.data.summary).toContain('suspicious')
    })
  })

  // -- cost_estimate --
  describe('cost_estimate', () => {
    it('returns a cost estimate breakdown', async () => {
      vi.mocked(prisma.procedure.findMany).mockResolvedValue([
        { id: 'proc-1', name: 'Root Canal', category: 'ENDODONTICS', basePrice: 5000 },
      ] as any)

      const costResult = JSON.stringify({
        lineItems: [{ description: 'Root Canal', quantity: 1, unitCost: 5000, total: 5000 }],
        subtotal: 5000,
        gst: 600,
        grandTotal: 5600,
        notes: 'Estimate based on standard pricing.',
      })
      vi.mocked(complete).mockResolvedValue({
        content: costResult,
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
        model: 'google/gemini-2.5-pro',
      })

      const req = new NextRequest('http://localhost/api/ai/clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cost_estimate', procedureIds: ['proc-1'] }),
      })
      const res = await clinicalPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.grandTotal).toBe(5600)
      expect(data.data.lineItems).toHaveLength(1)
    })
  })

  // -- consent_form --
  describe('consent_form', () => {
    it('returns a generated consent form', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({
        firstName: 'Alice',
        lastName: 'Smith',
      } as any)
      vi.mocked(prisma.procedure.findFirst).mockResolvedValue({
        name: 'Wisdom Tooth Extraction',
        description: 'Surgical extraction of impacted third molar.',
      } as any)
      vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
        name: 'Test Clinic',
      } as any)

      const consentResult = JSON.stringify({
        title: 'Consent for Wisdom Tooth Extraction',
        patientName: 'Alice Smith',
        hospitalName: 'Test Clinic',
        procedureName: 'Wisdom Tooth Extraction',
        description: 'Surgical extraction of impacted third molar.',
        risks: ['Infection', 'Nerve damage', 'Dry socket'],
        benefits: ['Relief from pain', 'Prevent crowding'],
        alternatives: ['Monitoring', 'Partial extraction'],
        acknowledgement: 'I acknowledge the risks and consent to the procedure.',
      })
      vi.mocked(complete).mockResolvedValue({
        content: consentResult,
        usage: { promptTokens: 250, completionTokens: 150, totalTokens: 400 },
        model: 'google/gemini-2.5-pro',
      })

      const req = new NextRequest('http://localhost/api/ai/clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'consent_form',
          patientId: 'p1',
          procedureId: 'proc-1',
          language: 'English',
        }),
      })
      const res = await clinicalPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.title).toContain('Wisdom Tooth')
      expect(data.data.risks).toHaveLength(3)
    })
  })

  // -- drug_check --
  describe('drug_check', () => {
    it('returns drug interaction analysis', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({
        id: 'p1',
        firstName: 'Bob',
        lastName: 'Jones',
      } as any)

      const drugResult = JSON.stringify({
        safe: false,
        interactions: [
          { drugs: 'Ibuprofen + Aspirin', severity: 'moderate', description: 'Increased bleeding risk.' },
        ],
        allergies: [],
        recommendations: ['Consider alternative NSAID.'],
      })
      vi.mocked(complete).mockResolvedValue({
        content: drugResult,
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
        model: 'anthropic/claude-opus-4-5-20251101',
      })

      const req = new NextRequest('http://localhost/api/ai/clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'drug_check',
          patientId: 'p1',
          medications: ['Aspirin'],
          newMedication: 'Ibuprofen',
        }),
      })
      const res = await clinicalPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.safe).toBe(false)
      expect(data.data.interactions).toHaveLength(1)
      expect(data.data.interactions[0].severity).toBe('moderate')
    })
  })
})

// =========================================================================
// 8. POST /api/webhooks
// =========================================================================
describe('POST /api/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()

    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'treatment.completed', payload: {} }),
    })
    const res = await webhooksPOST(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid event type', async () => {
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'invalid.event', payload: {} }),
    })
    const res = await webhooksPOST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid event type')
    expect(data.validEvents).toBeDefined()
    expect(Array.isArray(data.validEvents)).toBe(true)
  })

  it('returns 400 for missing event type', async () => {
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: {} }),
    })
    const res = await webhooksPOST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid event type')
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{invalid',
    })
    const res = await webhooksPOST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid JSON')
  })

  it('accepts treatment.completed event and returns received: true', async () => {
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'treatment.completed',
        payload: { treatmentId: 't1', patientId: 'p1', patientName: 'Alice' },
      }),
    })
    const res = await webhooksPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.received).toBe(true)
    expect(data.eventType).toBe('treatment.completed')
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'treatment.completed',
        hospitalId: 'h1',
        payload: { treatmentId: 't1', patientId: 'p1', patientName: 'Alice' },
      })
    )
  })

  it('accepts appointment.no_show event', async () => {
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment.no_show',
        payload: { appointmentId: 'a1', patientName: 'Bob' },
      }),
    })
    const res = await webhooksPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.received).toBe(true)
    expect(data.eventType).toBe('appointment.no_show')
  })

  it('accepts inventory.below_reorder event', async () => {
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'inventory.below_reorder',
        payload: { itemName: 'Gloves', currentStock: 5, reorderLevel: 50 },
      }),
    })
    const res = await webhooksPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.received).toBe(true)
    expect(data.eventType).toBe('inventory.below_reorder')
  })

  it('accepts patient.created event with empty payload', async () => {
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'patient.created',
      }),
    })
    const res = await webhooksPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.received).toBe(true)
    expect(data.eventType).toBe('patient.created')
    // dispatchEvent should receive empty object as payload
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'patient.created',
        payload: {},
      })
    )
  })

  it('accepts all six valid event types', async () => {
    const validTypes = [
      'treatment.completed',
      'appointment.no_show',
      'inventory.below_reorder',
      'lab_order.delayed',
      'payment.received',
      'patient.created',
    ]

    for (const eventType of validTypes) {
      vi.clearAllMocks()
      mockAuth()

      const req = new NextRequest('http://localhost/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: eventType, payload: { test: true } }),
      })
      const res = await webhooksPOST(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.received).toBe(true)
      expect(data.eventType).toBe(eventType)
    }
  })
})
