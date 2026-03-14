// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock prisma
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

// ---------------------------------------------------------------------------
// Mock cn utility (passthrough)
// ---------------------------------------------------------------------------
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// ---------------------------------------------------------------------------
// Helper to mock fetch responses
// ---------------------------------------------------------------------------
const mockFetchResponse = (data: any, ok = true) => {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok,
    json: async () => data,
    text: async () => JSON.stringify(data),
    status: ok ? 200 : 500,
  } as Response)
}

const mockFetchError = () => {
  vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))
}

// ---------------------------------------------------------------------------
// Imports — components under test
// ---------------------------------------------------------------------------
import { AIProvider, useAI } from '@/components/ai/ai-provider'
import { CommandBar } from '@/components/ai/command-bar'
import { ChatWidget } from '@/components/ai/chat-widget'
import { InsightsPanel } from '@/components/ai/insights-panel'
import { SmartSuggestions } from '@/components/ai/smart-suggestions'
import { Patient360 } from '@/components/ai/patient-360'
import { DuplicateDetector } from '@/components/ai/duplicate-detector'
import { TreatmentAssist } from '@/components/ai/treatment-assist'
import { ReportBuilder } from '@/components/ai/report-builder'
import { AuditMonitor } from '@/components/ai/audit-monitor'
import { AIUsageStats } from '@/components/ai/ai-usage-stats'
import React from 'react'

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(global.fetch).mockReset()
})

// ===========================================================================
// 1. AI Provider
// ===========================================================================
describe('AIProvider', () => {
  it('renders children without crashing', () => {
    render(
      <AIProvider>
        <div data-testid="child">Hello</div>
      </AIProvider>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('provides context values to consumer components', () => {
    function TestConsumer() {
      const ctx = useAI()
      return (
        <div>
          <span data-testid="chat-length">{ctx.chatMessages.length}</span>
          <span data-testid="chat-loading">{String(ctx.chatLoading)}</span>
          <span data-testid="command-loading">{String(ctx.commandLoading)}</span>
          <span data-testid="insights-length">{ctx.insights.length}</span>
          <span data-testid="insights-loading">{String(ctx.insightsLoading)}</span>
          <span data-testid="suggestions-length">{ctx.suggestions.length}</span>
        </div>
      )
    }

    render(
      <AIProvider>
        <TestConsumer />
      </AIProvider>
    )

    expect(screen.getByTestId('chat-length')).toHaveTextContent('0')
    expect(screen.getByTestId('chat-loading')).toHaveTextContent('false')
    expect(screen.getByTestId('command-loading')).toHaveTextContent('false')
    expect(screen.getByTestId('insights-length')).toHaveTextContent('0')
    expect(screen.getByTestId('insights-loading')).toHaveTextContent('false')
    expect(screen.getByTestId('suggestions-length')).toHaveTextContent('0')
  })

  it('throws error when useAI is used outside AIProvider', () => {
    function TestConsumer() {
      useAI()
      return <div />
    }

    // Suppress console.error during expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useAI must be used inside <AIProvider>')
    consoleSpy.mockRestore()
  })

  it('executeCommand calls /api/ai/command and returns result', async () => {
    const commandResult = {
      intent: 'show_appointments',
      summary: 'Here are your appointments',
      requiresApproval: false,
      result: { success: true, message: 'Found 3 appointments' },
    }
    mockFetchResponse(commandResult)

    let execResult: any = null
    function TestConsumer() {
      const { executeCommand, commandLoading } = useAI()
      return (
        <div>
          <span data-testid="loading">{String(commandLoading)}</span>
          <button
            data-testid="exec-btn"
            onClick={async () => {
              execResult = await executeCommand('show appointments')
            }}
          >
            Execute
          </button>
        </div>
      )
    }

    render(
      <AIProvider>
        <TestConsumer />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('exec-btn'))
    })

    await waitFor(() => {
      expect(execResult).toEqual(commandResult)
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/ai/command', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('loadInsights fetches and stores insights', async () => {
    const mockInsights = [
      { id: '1', category: 'REVENUE', severity: 'WARNING', title: 'Low revenue', description: 'Revenue is down', dismissed: false, actionTaken: false, createdAt: '2025-01-01' },
    ]
    mockFetchResponse({ insights: mockInsights })

    function TestConsumer() {
      const { insights, loadInsights } = useAI()
      return (
        <div>
          <span data-testid="count">{insights.length}</span>
          <button data-testid="load" onClick={loadInsights}>Load</button>
          {insights.map((i) => (
            <span key={i.id} data-testid={`insight-${i.id}`}>{i.title}</span>
          ))}
        </div>
      )
    }

    render(
      <AIProvider>
        <TestConsumer />
      </AIProvider>
    )

    expect(screen.getByTestId('count')).toHaveTextContent('0')

    await act(async () => {
      fireEvent.click(screen.getByTestId('load'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1')
    })
    expect(screen.getByTestId('insight-1')).toHaveTextContent('Low revenue')
  })

  it('dismissInsight removes insight from state', async () => {
    // First load insights
    mockFetchResponse({
      insights: [
        { id: '1', category: 'REVENUE', severity: 'INFO', title: 'Insight 1', description: '', dismissed: false, actionTaken: false, createdAt: '' },
        { id: '2', category: 'CLINICAL', severity: 'WARNING', title: 'Insight 2', description: '', dismissed: false, actionTaken: false, createdAt: '' },
      ],
    })
    // Then dismiss
    mockFetchResponse({})

    function TestConsumer() {
      const { insights, loadInsights, dismissInsight } = useAI()
      return (
        <div>
          <span data-testid="count">{insights.length}</span>
          <button data-testid="load" onClick={loadInsights}>Load</button>
          <button data-testid="dismiss" onClick={() => dismissInsight('1')}>Dismiss</button>
        </div>
      )
    }

    render(
      <AIProvider>
        <TestConsumer />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('load'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('2')
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('dismiss'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1')
    })
  })

  it('clearChat resets chat messages', async () => {
    function TestConsumer() {
      const { chatMessages, clearChat } = useAI()
      return (
        <div>
          <span data-testid="count">{chatMessages.length}</span>
          <button data-testid="clear" onClick={clearChat}>Clear</button>
        </div>
      )
    }

    render(
      <AIProvider>
        <TestConsumer />
      </AIProvider>
    )

    expect(screen.getByTestId('count')).toHaveTextContent('0')

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear'))
    })

    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('loadSuggestions fetches suggestions via /api/ai/suggestions', async () => {
    const mockSuggestions = [
      { title: 'Follow up', description: 'Follow up with patient', action: 'follow_up', urgency: 'normal' as const },
    ]
    mockFetchResponse({ suggestions: mockSuggestions })

    function TestConsumer() {
      const { suggestions, loadSuggestions } = useAI()
      return (
        <div>
          <span data-testid="count">{suggestions.length}</span>
          <button data-testid="load" onClick={() => loadSuggestions('/dashboard')}>Load</button>
        </div>
      )
    }

    render(
      <AIProvider>
        <TestConsumer />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('load'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1')
    })
  })
})

// ===========================================================================
// 2. Command Bar
// ===========================================================================
describe('CommandBar', () => {
  it('does not render anything when closed', () => {
    const { container } = render(
      <AIProvider>
        <CommandBar />
      </AIProvider>
    )
    // CommandBar returns null when !open
    expect(container.innerHTML).toBe('')
  })

  it('renders input when opened via Ctrl+K', async () => {
    render(
      <AIProvider>
        <CommandBar />
      </AIProvider>
    )

    // Simulate Ctrl+K to open
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type a command/)).toBeInTheDocument()
    })
  })

  it('renders quick command examples when open with no query', async () => {
    render(
      <AIProvider>
        <CommandBar />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })

    await waitFor(() => {
      expect(screen.getByText("Show today's appointments")).toBeInTheDocument()
      expect(screen.getByText('Check stock for composite resin')).toBeInTheDocument()
      expect(screen.getByText("Show this month's revenue")).toBeInTheDocument()
      expect(screen.getByText('Quick commands')).toBeInTheDocument()
    })
  })

  it('closes when Escape is pressed', async () => {
    render(
      <AIProvider>
        <CommandBar />
      </AIProvider>
    )

    // Open
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })
    expect(screen.getByPlaceholderText(/Type a command/)).toBeInTheDocument()

    // Close with Escape
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Type a command/)).not.toBeInTheDocument()
    })
  })

  it('closes when backdrop is clicked', async () => {
    render(
      <AIProvider>
        <CommandBar />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })

    expect(screen.getByPlaceholderText(/Type a command/)).toBeInTheDocument()

    // Click the backdrop (the element with bg-black/40)
    const backdrop = document.querySelector('.bg-black\\/40')
    if (backdrop) {
      await act(async () => {
        fireEvent.click(backdrop)
      })
    }

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Type a command/)).not.toBeInTheDocument()
    })
  })

  it('submits command on Enter and shows result', async () => {
    const commandResult = {
      intent: 'show_appointments',
      requiresApproval: false,
      result: { type: 'general', message: 'You have 3 appointments today' },
    }
    mockFetchResponse(commandResult)

    render(
      <AIProvider>
        <CommandBar />
      </AIProvider>
    )

    // Open
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })

    const input = screen.getByPlaceholderText(/Type a command/)

    // Type a command
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Show appointments' } })
    })

    // Submit with Enter
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByText('You have 3 appointments today')).toBeInTheDocument()
    })
  })

  it('shows footer hints text', async () => {
    render(
      <AIProvider>
        <CommandBar />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })

    expect(screen.getByText(/Enter to execute/)).toBeInTheDocument()
    expect(screen.getByText('Powered by AI')).toBeInTheDocument()
  })

  it('sets query when quick command example is clicked', async () => {
    render(
      <AIProvider>
        <CommandBar />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })

    await act(async () => {
      fireEvent.click(screen.getByText("Show today's appointments"))
    })

    const input = screen.getByPlaceholderText(/Type a command/) as HTMLInputElement
    expect(input.value).toBe("Show today's appointments")
  })
})

// ===========================================================================
// 3. Chat Widget
// ===========================================================================
describe('ChatWidget', () => {
  it('renders the chat toggle button when closed', () => {
    render(
      <AIProvider>
        <ChatWidget />
      </AIProvider>
    )

    expect(screen.getByLabelText('Open AI chat')).toBeInTheDocument()
  })

  it('shows chat panel when toggle button is clicked', async () => {
    render(
      <AIProvider>
        <ChatWidget />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open AI chat'))
    })

    expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    expect(screen.getByText('Ask anything about your clinic')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type or tap mic...')).toBeInTheDocument()
    expect(screen.getByText('Send')).toBeInTheDocument()
  })

  it('shows empty state hints when no messages exist', async () => {
    render(
      <AIProvider>
        <ChatWidget />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open AI chat'))
    })

    expect(screen.getByText('How can I help?')).toBeInTheDocument()
    expect(screen.getByText('Daily summary')).toBeInTheDocument()
    expect(screen.getByText("Today's schedule")).toBeInTheDocument()
    expect(screen.getByText('Book appointment')).toBeInTheDocument()
  })

  it('hides toggle button when chat is open', async () => {
    render(
      <AIProvider>
        <ChatWidget />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open AI chat'))
    })

    expect(screen.queryByLabelText('Open AI chat')).not.toBeInTheDocument()
  })

  it('closes chat panel when close button is clicked', async () => {
    render(
      <AIProvider>
        <ChatWidget />
      </AIProvider>
    )

    // Open
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open AI chat'))
    })
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()

    // Close
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Close'))
    })

    expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Open AI chat')).toBeInTheDocument()
  })

  it('has a clear chat button in the header', async () => {
    render(
      <AIProvider>
        <ChatWidget />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open AI chat'))
    })

    expect(screen.getByLabelText('Clear chat')).toBeInTheDocument()
  })

  it('disables Send button when input is empty', async () => {
    render(
      <AIProvider>
        <ChatWidget />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open AI chat'))
    })

    const sendBtn = screen.getByText('Send')
    expect(sendBtn).toBeDisabled()
  })

  it('clicking a hint sets the input value', async () => {
    render(
      <AIProvider>
        <ChatWidget />
      </AIProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open AI chat'))
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Daily summary'))
    })

    const textarea = screen.getByPlaceholderText('Type or tap mic...') as HTMLTextAreaElement
    expect(textarea.value).toBe('Daily summary')
  })
})

// ===========================================================================
// 4. Insights Panel
// ===========================================================================
describe('InsightsPanel', () => {
  it('renders header and empty state when no insights', async () => {
    // loadInsights is called on mount
    mockFetchResponse({ insights: [] })

    render(
      <AIProvider>
        <InsightsPanel />
      </AIProvider>
    )

    expect(screen.getByText('AI Insights')).toBeInTheDocument()
    expect(screen.getByText('Refresh')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('No active insights right now.')).toBeInTheDocument()
    })
  })

  it('renders loading state while fetching', () => {
    // Make fetch never resolve
    vi.mocked(global.fetch).mockReturnValueOnce(new Promise(() => {}))

    render(
      <AIProvider>
        <InsightsPanel />
      </AIProvider>
    )

    expect(screen.getByText('Loading insights\u2026')).toBeInTheDocument()
  })

  it('renders insight cards when data is loaded', async () => {
    const mockInsights = [
      { id: '1', category: 'REVENUE', severity: 'WARNING', title: 'Revenue Drop', description: 'Revenue has dropped 15%', dismissed: false, actionTaken: false, createdAt: '2025-01-01' },
      { id: '2', category: 'CLINICAL', severity: 'CRITICAL', title: 'Missing Records', description: 'Some records incomplete', dismissed: false, actionTaken: false, createdAt: '2025-01-02' },
    ]
    mockFetchResponse({ insights: mockInsights })

    render(
      <AIProvider>
        <InsightsPanel />
      </AIProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Revenue Drop')).toBeInTheDocument()
      expect(screen.getByText('Revenue has dropped 15%')).toBeInTheDocument()
      expect(screen.getByText('Missing Records')).toBeInTheDocument()
    })
  })

  it('shows correct severity badges', async () => {
    const mockInsights = [
      { id: '1', category: 'REVENUE', severity: 'INFO', title: 'Info Insight', description: 'Some info', dismissed: false, actionTaken: false, createdAt: '' },
      { id: '2', category: 'CLINICAL', severity: 'WARNING', title: 'Warning Insight', description: 'Some warning', dismissed: false, actionTaken: false, createdAt: '' },
      { id: '3', category: 'OPERATIONAL', severity: 'CRITICAL', title: 'Critical Insight', description: 'Something critical', dismissed: false, actionTaken: false, createdAt: '' },
    ]
    mockFetchResponse({ insights: mockInsights })

    render(
      <AIProvider>
        <InsightsPanel />
      </AIProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('INFO')).toBeInTheDocument()
      expect(screen.getByText('WARNING')).toBeInTheDocument()
      expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    })
  })

  it('has dismiss buttons on insight cards', async () => {
    mockFetchResponse({
      insights: [
        { id: '1', category: 'REVENUE', severity: 'INFO', title: 'Test', description: 'Desc', dismissed: false, actionTaken: false, createdAt: '' },
      ],
    })

    render(
      <AIProvider>
        <InsightsPanel />
      </AIProvider>
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Dismiss insight')).toBeInTheDocument()
    })
  })

  it('respects maxItems prop', async () => {
    const mockInsights = Array.from({ length: 6 }, (_, i) => ({
      id: String(i + 1),
      category: 'REVENUE',
      severity: 'INFO',
      title: `Insight ${i + 1}`,
      description: `Desc ${i + 1}`,
      dismissed: false,
      actionTaken: false,
      createdAt: '',
    }))
    mockFetchResponse({ insights: mockInsights })

    render(
      <AIProvider>
        <InsightsPanel maxItems={2} />
      </AIProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Insight 1')).toBeInTheDocument()
      expect(screen.getByText('Insight 2')).toBeInTheDocument()
      expect(screen.queryByText('Insight 3')).not.toBeInTheDocument()
    })

    // Should show "more" link
    expect(screen.getByText('+4 more insights')).toBeInTheDocument()
  })
})

// ===========================================================================
// 5. Smart Suggestions
// ===========================================================================
describe('SmartSuggestions', () => {
  it('renders nothing when no suggestions are available', async () => {
    mockFetchResponse({ suggestions: [] })

    const { container } = render(
      <AIProvider>
        <SmartSuggestions />
      </AIProvider>
    )

    await waitFor(() => {
      expect(container.innerHTML).toBe('')
    })
  })

  it('renders suggestion items when data is loaded', async () => {
    const mockSuggestions = [
      { title: 'Follow up with John', description: 'Last visit was 3 months ago', action: 'follow_up_john', urgency: 'normal' },
      { title: 'Low stock alert', description: 'Composite resin running low', action: 'restock_composite', urgency: 'warning' },
    ]
    mockFetchResponse({ suggestions: mockSuggestions })

    render(
      <AIProvider>
        <SmartSuggestions />
      </AIProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Follow up with John')).toBeInTheDocument()
      expect(screen.getByText('Last visit was 3 months ago')).toBeInTheDocument()
      expect(screen.getByText('Low stock alert')).toBeInTheDocument()
    })
  })

  it('renders action buttons on suggestion items', async () => {
    mockFetchResponse({
      suggestions: [
        { title: 'Follow up', description: 'Desc', action: 'follow_up', urgency: 'normal' },
      ],
    })

    render(
      <AIProvider>
        <SmartSuggestions />
      </AIProvider>
    )

    await waitFor(() => {
      const buttons = screen.getAllByText('Do this \u2192')
      expect(buttons.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('executes action when "Do this" button is clicked', async () => {
    // First fetch: loadSuggestions
    mockFetchResponse({
      suggestions: [
        { title: 'Follow up', description: 'Desc', action: 'follow_up', urgency: 'normal' },
      ],
    })

    render(
      <AIProvider>
        <SmartSuggestions />
      </AIProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Do this \u2192')).toBeInTheDocument()
    })

    // Second fetch: executeCommand
    mockFetchResponse({ intent: 'follow_up', requiresApproval: false, result: { success: true, message: 'Done!' } })

    await act(async () => {
      fireEvent.click(screen.getByText('Do this \u2192'))
    })

    await waitFor(() => {
      expect(screen.getByText('Done!')).toBeInTheDocument()
    })
  })
})

// ===========================================================================
// 6. Patient 360
// ===========================================================================
describe('Patient360', () => {
  it('renders loading skeleton initially', () => {
    // Make fetch never resolve
    vi.mocked(global.fetch).mockReturnValueOnce(new Promise(() => {}))

    render(<Patient360 patientId="patient-1" />)

    expect(screen.getByText('AI Patient Summary')).toBeInTheDocument()
    // Skeleton has animate-pulse elements
    const pulseElements = document.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('renders summary after successful fetch', async () => {
    mockFetchResponse({
      success: true,
      data: {
        summary: 'Patient is a 35-year-old male with good dental health.',
        highlights: ['Regular checkups', 'No cavities'],
        flags: ['Allergic to penicillin'],
        lastVisit: '2025-01-15',
        nextAction: 'Schedule cleaning',
      },
    })

    render(<Patient360 patientId="patient-1" />)

    await waitFor(() => {
      expect(screen.getByText('Patient is a 35-year-old male with good dental health.')).toBeInTheDocument()
    })

    expect(screen.getByText('Regular checkups')).toBeInTheDocument()
    expect(screen.getByText('No cavities')).toBeInTheDocument()
    expect(screen.getByText('Allergic to penicillin')).toBeInTheDocument()
    expect(screen.getByText('Last visit: 2025-01-15')).toBeInTheDocument()
    expect(screen.getByText('\u2192 Schedule cleaning')).toBeInTheDocument()
  })

  it('renders nothing on fetch error', async () => {
    mockFetchResponse({ success: false, error: 'Not found' })

    const { container } = render(<Patient360 patientId="patient-1" />)

    await waitFor(() => {
      // After error, component returns null
      expect(container.innerHTML).toBe('')
    })
  })

  it('renders nothing on network error', async () => {
    mockFetchError()

    const { container } = render(<Patient360 patientId="patient-1" />)

    await waitFor(() => {
      expect(container.innerHTML).toBe('')
    })
  })

  it('has a Regenerate button after loading', async () => {
    mockFetchResponse({
      success: true,
      data: { summary: 'Test summary' },
    })

    render(<Patient360 patientId="patient-1" />)

    await waitFor(() => {
      expect(screen.getByText('\u21BB Regenerate')).toBeInTheDocument()
    })
  })

  it('calls /api/ai/clinical with correct parameters', async () => {
    mockFetchResponse({ success: true, data: { summary: 'Summary' } })

    render(<Patient360 patientId="patient-123" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/clinical', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ type: 'patient_summary', patientId: 'patient-123', refresh: false }),
      }))
    })
  })
})

// ===========================================================================
// 7. Duplicate Detector
// ===========================================================================
describe('DuplicateDetector', () => {
  it('renders nothing when no required props provided (empty firstName)', async () => {
    // fetch should not be called if firstName/lastName/phone are empty
    const { container } = render(
      <DuplicateDetector
        firstName=""
        lastName=""
        phone=""
        onSelect={vi.fn()}
      />
    )

    // Wait for debounce timeout (1200ms)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1400))
    })

    // No duplicates found, returns null
    expect(container.innerHTML).toBe('')
    // fetch should not have been called since firstName is empty
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows checking spinner while fetching', async () => {
    // Make fetch never resolve
    vi.mocked(global.fetch).mockReturnValueOnce(new Promise(() => {}))

    render(
      <DuplicateDetector
        firstName="John"
        lastName="Doe"
        phone="1234567890"
        onSelect={vi.fn()}
      />
    )

    // Wait for debounce to trigger
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1300))
    })

    expect(screen.getByText('Checking for duplicates\u2026')).toBeInTheDocument()
  })

  it('shows duplicate warning when duplicates found', async () => {
    mockFetchResponse({
      data: {
        duplicates: [
          { id: 'p1', patientId: 'PAT-001', name: 'John Doe', confidence: 0.95, matchFields: ['name', 'phone'] },
        ],
      },
    })

    render(
      <DuplicateDetector
        firstName="John"
        lastName="Doe"
        phone="1234567890"
        onSelect={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicate patient/)).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText(/95% match/)).toBeInTheDocument()
      expect(screen.getByText(/name, phone/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('calls onSelect when "Use existing" button is clicked', async () => {
    mockFetchResponse({
      data: {
        duplicates: [
          { id: 'existing-p1', patientId: 'PAT-001', name: 'John Doe', confidence: 0.9, matchFields: ['name'] },
        ],
      },
    })

    const onSelect = vi.fn()

    render(
      <DuplicateDetector
        firstName="John"
        lastName="Doe"
        phone="1234567890"
        onSelect={onSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Use existing')).toBeInTheDocument()
    }, { timeout: 3000 })

    await act(async () => {
      fireEvent.click(screen.getByText('Use existing'))
    })

    expect(onSelect).toHaveBeenCalledWith('existing-p1')
  })

  it('renders nothing when no duplicates are found', async () => {
    mockFetchResponse({ data: { duplicates: [] } })

    const { container } = render(
      <DuplicateDetector
        firstName="UniqueFirst"
        lastName="UniqueLast"
        phone="9999999999"
        onSelect={vi.fn()}
      />
    )

    await waitFor(() => {
      // After check completes, no duplicates => returns null
      expect(container.innerHTML).toBe('')
    }, { timeout: 3000 })
  })

  it('shows multiple duplicates when found', async () => {
    mockFetchResponse({
      data: {
        duplicates: [
          { id: 'p1', patientId: 'PAT-001', name: 'John Doe', confidence: 0.95, matchFields: ['name', 'phone'] },
          { id: 'p2', patientId: 'PAT-002', name: 'Jon Doe', confidence: 0.7, matchFields: ['phone'] },
        ],
      },
    })

    render(
      <DuplicateDetector
        firstName="John"
        lastName="Doe"
        phone="1234567890"
        onSelect={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicate patients detected/)).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jon Doe')).toBeInTheDocument()
      const useExistingButtons = screen.getAllByText('Use existing')
      expect(useExistingButtons).toHaveLength(2)
    }, { timeout: 3000 })
  })
})

// ===========================================================================
// 8. Treatment Assist
// ===========================================================================
describe('TreatmentAssist', () => {
  it('renders the header and all four tabs', () => {
    render(
      <TreatmentAssist patientId="patient-1" procedureId="proc-1" procedureName="Root Canal" />
    )

    expect(screen.getByText('AI Treatment Assistant')).toBeInTheDocument()
    // Tab icons are always visible; labels may be hidden on small screens but are in DOM
    expect(screen.getByText('Drug Check')).toBeInTheDocument()
    expect(screen.getByText('Cost Estimate')).toBeInTheDocument()
    expect(screen.getByText('Consent Form')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })

  it('shows Drug Check panel by default with input and button', () => {
    render(
      <TreatmentAssist patientId="patient-1" />
    )

    expect(screen.getByPlaceholderText('e.g. Amoxicillin 500 mg')).toBeInTheDocument()
    expect(screen.getByText('Check')).toBeInTheDocument()
    expect(screen.getByText(/Enter a medication to check/)).toBeInTheDocument()
  })

  it('Check button is disabled when drug input is empty', () => {
    render(
      <TreatmentAssist patientId="patient-1" />
    )

    const checkBtn = screen.getByText('Check')
    expect(checkBtn).toBeDisabled()
  })

  it('switches to Cost Estimate tab and triggers fetch', async () => {
    // Mock the cost estimate fetch
    mockFetchResponse({
      success: true,
      data: {
        lineItems: [{ description: 'Root Canal', quantity: 1, total: 5000 }],
        subtotal: 5000,
        gst: 600,
        grandTotal: 5600,
      },
    })

    render(
      <TreatmentAssist patientId="patient-1" procedureId="proc-1" procedureName="Root Canal" />
    )

    await act(async () => {
      fireEvent.click(screen.getByText('Cost Estimate'))
    })

    // Should trigger a fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/clinical', expect.objectContaining({
        method: 'POST',
      }))
    })
  })

  it('switches to Consent Form tab and shows language selector', async () => {
    mockFetchResponse({ success: true, data: {} })

    render(
      <TreatmentAssist patientId="patient-1" procedureId="proc-1" procedureName="Root Canal" />
    )

    await act(async () => {
      fireEvent.click(screen.getByText('Consent Form'))
    })

    expect(screen.getByText('Language:')).toBeInTheDocument()
    expect(screen.getByDisplayValue('English')).toBeInTheDocument()
  })

  it('switches to Clinical Notes tab and shows expand button', async () => {
    mockFetchResponse({ success: true, data: {} })

    render(
      <TreatmentAssist patientId="patient-1" procedureId="proc-1" procedureName="Root Canal" />
    )

    await act(async () => {
      fireEvent.click(screen.getByText('Notes'))
    })

    expect(screen.getByText('Expand notes')).toBeInTheDocument()
    expect(screen.getByText(/Expand brief notes into structured/)).toBeInTheDocument()
  })

  it('Drug Check calls API and displays safe result', async () => {
    render(
      <TreatmentAssist patientId="patient-1" />
    )

    const input = screen.getByPlaceholderText('e.g. Amoxicillin 500 mg')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Amoxicillin 500mg' } })
    })

    mockFetchResponse({
      success: true,
      data: {
        safe: true,
        interactions: [],
        allergies: [],
        recommendations: [],
      },
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Check'))
    })

    await waitFor(() => {
      expect(screen.getByText(/No interactions detected/)).toBeInTheDocument()
    })
  })
})

// ===========================================================================
// 9. Report Builder
// ===========================================================================
describe('ReportBuilder', () => {
  it('renders header, input, and generate button', () => {
    render(<ReportBuilder />)

    expect(screen.getByText('Natural Language Report Builder')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Show revenue by procedure/)).toBeInTheDocument()
    expect(screen.getByText('Generate')).toBeInTheDocument()
  })

  it('renders example query chips', () => {
    render(<ReportBuilder />)

    expect(screen.getByText('Monthly revenue by procedure for last 3 months')).toBeInTheDocument()
    expect(screen.getByText("Patients who haven't visited in 6 months")).toBeInTheDocument()
    expect(screen.getByText('Overdue invoices sorted by amount')).toBeInTheDocument()
    expect(screen.getByText('Appointment no-show rate by day of week')).toBeInTheDocument()
    expect(screen.getByText('Top 5 most performed procedures this quarter')).toBeInTheDocument()
    expect(screen.getByText('Inventory items running low on stock')).toBeInTheDocument()
  })

  it('Generate button is disabled when input is empty', () => {
    render(<ReportBuilder />)

    expect(screen.getByText('Generate')).toBeDisabled()
  })

  it('sets query when example chip is clicked', async () => {
    render(<ReportBuilder />)

    await act(async () => {
      fireEvent.click(screen.getByText('Overdue invoices sorted by amount'))
    })

    const input = screen.getByPlaceholderText(/Show revenue by procedure/) as HTMLInputElement
    expect(input.value).toBe('Overdue invoices sorted by amount')
  })

  it('submits query and shows results table', async () => {
    render(<ReportBuilder />)

    const input = screen.getByPlaceholderText(/Show revenue by procedure/)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Show revenue' } })
    })

    mockFetchResponse({
      success: true,
      rows: [
        { procedure: 'Root Canal', revenue: 50000 },
        { procedure: 'Cleaning', revenue: 15000 },
      ],
      summary: 'Here is your revenue breakdown.',
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Generate'))
    })

    await waitFor(() => {
      expect(screen.getByText('Here is your revenue breakdown.')).toBeInTheDocument()
      expect(screen.getByText('procedure')).toBeInTheDocument()
      expect(screen.getByText('revenue')).toBeInTheDocument()
      expect(screen.getByText('Root Canal')).toBeInTheDocument()
      expect(screen.getByText('Cleaning')).toBeInTheDocument()
    })
  })

  it('submits query on Enter key press', async () => {
    render(<ReportBuilder />)

    const input = screen.getByPlaceholderText(/Show revenue by procedure/)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Show appointments' } })
    })

    mockFetchResponse({
      success: true,
      results: [],
      message: 'No results found.',
    })

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/query', expect.objectContaining({
        method: 'POST',
      }))
    })
  })

  it('shows error message when query fails', async () => {
    render(<ReportBuilder />)

    const input = screen.getByPlaceholderText(/Show revenue by procedure/)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Invalid query' } })
    })

    mockFetchResponse({ success: false, error: 'Could not parse query' })

    await act(async () => {
      fireEvent.click(screen.getByText('Generate'))
    })

    await waitFor(() => {
      expect(screen.getByText('Could not parse query')).toBeInTheDocument()
    })
  })

  it('shows empty state when query succeeds with no results', async () => {
    render(<ReportBuilder />)

    const input = screen.getByPlaceholderText(/Show revenue by procedure/)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Show data' } })
    })

    mockFetchResponse({ success: true, results: [] })

    await act(async () => {
      fireEvent.click(screen.getByText('Generate'))
    })

    await waitFor(() => {
      expect(screen.getByText('No results found for this query.')).toBeInTheDocument()
    })
  })

  it('shows loading indicator while fetching', async () => {
    render(<ReportBuilder />)

    const input = screen.getByPlaceholderText(/Show revenue by procedure/)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Show data' } })
    })

    // Make fetch never resolve to keep loading state
    vi.mocked(global.fetch).mockReturnValueOnce(new Promise(() => {}))

    await act(async () => {
      fireEvent.click(screen.getByText('Generate'))
    })

    expect(screen.getByText('Querying your data\u2026')).toBeInTheDocument()
    // Button text changes to "Generating..."
    expect(screen.getByText('Generating\u2026')).toBeInTheDocument()
  })

  it('shows Export JSON button when results are present', async () => {
    render(<ReportBuilder />)

    const input = screen.getByPlaceholderText(/Show revenue by procedure/)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Show revenue' } })
    })

    mockFetchResponse({
      success: true,
      rows: [{ procedure: 'Root Canal', revenue: 50000 }],
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Generate'))
    })

    await waitFor(() => {
      expect(screen.getByText('\u2B07 Export JSON')).toBeInTheDocument()
    })
  })
})

// ===========================================================================
// 10. Audit Monitor
// ===========================================================================
describe('AuditMonitor', () => {
  it('renders header and loading state initially', () => {
    vi.mocked(global.fetch).mockReturnValueOnce(new Promise(() => {}))

    render(<AuditMonitor />)

    expect(screen.getByText('Audit Log Intelligence')).toBeInTheDocument()
    expect(screen.getByText('Analysing audit logs\u2026')).toBeInTheDocument()
  })

  it('renders the days-back selector with correct options', () => {
    vi.mocked(global.fetch).mockReturnValueOnce(new Promise(() => {}))

    render(<AuditMonitor />)

    expect(screen.getByDisplayValue('7 days')).toBeInTheDocument()
    expect(screen.getByText('3 days')).toBeInTheDocument()
    expect(screen.getByText('14 days')).toBeInTheDocument()
    expect(screen.getByText('30 days')).toBeInTheDocument()
  })

  it('shows suspicious pattern cards after successful fetch', async () => {
    mockFetchResponse({
      success: true,
      data: {
        summary: 'Found 2 suspicious patterns in the last 7 days.',
        suspicious: [
          {
            pattern: 'Unusual login times',
            severity: 'high',
            affectedUsers: ['user1@test.com'],
            occurrences: 5,
            recommendation: 'Review login activity',
          },
          {
            pattern: 'Bulk data export',
            severity: 'medium',
            occurrences: 2,
            recommendation: 'Verify export necessity',
          },
        ],
      },
    })

    render(<AuditMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Found 2 suspicious patterns in the last 7 days.')).toBeInTheDocument()
      expect(screen.getByText('Unusual login times')).toBeInTheDocument()
      expect(screen.getByText('Review login activity')).toBeInTheDocument()
      expect(screen.getByText('high')).toBeInTheDocument()
      expect(screen.getByText('Bulk data export')).toBeInTheDocument()
      expect(screen.getByText('medium')).toBeInTheDocument()
      expect(screen.getByText(/Affected users: user1@test.com/)).toBeInTheDocument()
      expect(screen.getByText('5 occurrences')).toBeInTheDocument()
      expect(screen.getByText('2 occurrences')).toBeInTheDocument()
    })
  })

  it('shows clean bill of health when no suspicious patterns', async () => {
    mockFetchResponse({
      success: true,
      data: {
        summary: 'All clear.',
        suspicious: [],
      },
    })

    render(<AuditMonitor />)

    await waitFor(() => {
      expect(screen.getByText(/No suspicious patterns detected in the last 7 days/)).toBeInTheDocument()
    })
  })

  it('re-fetches when days-back selector changes', async () => {
    // First load (7 days)
    mockFetchResponse({
      success: true,
      data: { summary: '7 day summary', suspicious: [] },
    })

    render(<AuditMonitor />)

    await waitFor(() => {
      expect(screen.getByText('7 day summary')).toBeInTheDocument()
    })

    // Change to 14 days
    mockFetchResponse({
      success: true,
      data: { summary: '14 day summary', suspicious: [] },
    })

    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('7 days'), { target: { value: '14' } })
    })

    await waitFor(() => {
      expect(screen.getByText('14 day summary')).toBeInTheDocument()
    })

    // fetch should have been called twice
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('has a refresh button', () => {
    vi.mocked(global.fetch).mockReturnValueOnce(new Promise(() => {}))

    render(<AuditMonitor />)

    // Refresh button displays "↻"
    expect(screen.getByText('\u21BB')).toBeInTheDocument()
  })
})

// ===========================================================================
// 11. AI Usage Stats
// ===========================================================================
describe('AIUsageStats', () => {
  it('renders loading skeleton initially', () => {
    vi.mocked(global.fetch).mockReturnValueOnce(new Promise(() => {}))

    render(<AIUsageStats />)

    // Loading skeleton has animate-pulse elements
    const pulseElements = document.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('renders stats after successful fetch', async () => {
    mockFetchResponse({
      allTime: {
        conversations: 150,
        executions: 320,
        insights: 45,
        tokens: 1250000,
        costINR: 245.50,
      },
      thisMonth: {
        conversations: 25,
        executions: 60,
        tokens: 200000,
        costINR: 42.30,
      },
      skillBreakdown: [
        { skill: 'patient-intake', executions: 30, cost: 5.20 },
        { skill: 'smart-scheduler', executions: 20, cost: 3.40 },
      ],
    })

    render(<AIUsageStats />)

    await waitFor(() => {
      expect(screen.getByText('AI Usage Dashboard')).toBeInTheDocument()
      expect(screen.getByText('This-month vs all-time usage statistics')).toBeInTheDocument()
    })

    // Stat cards
    expect(screen.getByText('Conversations')).toBeInTheDocument()
    expect(screen.getByText('Commands Run')).toBeInTheDocument()
    expect(screen.getByText('Tokens Used')).toBeInTheDocument()

    // This month values
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
    // toLocaleString() may format differently depending on locale (e.g. 200,000 or 2,00,000)
    const bodyText = document.body.textContent || ''
    expect(bodyText).toMatch(/2[,.]?00[,.]?000/)

    // All-time values
    expect(bodyText).toMatch(/All-time:\s*150/)
    expect(bodyText).toMatch(/All-time:\s*320/)
    expect(bodyText).toMatch(/1[,.]?2[,.]?50[,.]?000/)

    // Cost card
    expect(screen.getByText('Estimated AI Cost')).toBeInTheDocument()
    expect(bodyText).toContain('42.30')

    // Insights generated
    expect(screen.getByText('45')).toBeInTheDocument()
  })

  it('renders skill breakdown bars', async () => {
    mockFetchResponse({
      allTime: { conversations: 10, executions: 20, insights: 5, tokens: 1000, costINR: 10 },
      thisMonth: { conversations: 5, executions: 10, tokens: 500, costINR: 5 },
      skillBreakdown: [
        { skill: 'patient-intake', executions: 30, cost: 5 },
        { skill: 'smart-scheduler', executions: 20, cost: 3 },
        { skill: 'billing-agent', executions: 10, cost: 2 },
      ],
    })

    render(<AIUsageStats />)

    await waitFor(() => {
      expect(screen.getByText('Top Skills (this month)')).toBeInTheDocument()
      expect(screen.getByText('patient intake')).toBeInTheDocument()
      expect(screen.getByText('smart scheduler')).toBeInTheDocument()
      expect(screen.getByText('billing agent')).toBeInTheDocument()
      expect(screen.getByText('30x')).toBeInTheDocument()
      expect(screen.getByText('20x')).toBeInTheDocument()
      expect(screen.getByText('10x')).toBeInTheDocument()
    })
  })

  it('renders nothing when fetch fails and stats is null', async () => {
    mockFetchError()

    const { container } = render(<AIUsageStats />)

    await waitFor(() => {
      // After fetch failure, loading = false, stats = null => returns null
      expect(container.innerHTML).toBe('')
    })
  })

  it('shows disclaimer about AI cost estimates', async () => {
    mockFetchResponse({
      allTime: { conversations: 1, executions: 1, insights: 0, tokens: 100, costINR: 0.50 },
      thisMonth: { conversations: 1, executions: 1, tokens: 100, costINR: 0.50 },
      skillBreakdown: [],
    })

    render(<AIUsageStats />)

    await waitFor(() => {
      expect(screen.getByText('Costs are estimates based on logged token usage.')).toBeInTheDocument()
    })
  })

  it('does not show skill breakdown when empty', async () => {
    mockFetchResponse({
      allTime: { conversations: 1, executions: 1, insights: 0, tokens: 100, costINR: 0.50 },
      thisMonth: { conversations: 1, executions: 1, tokens: 100, costINR: 0.50 },
      skillBreakdown: [],
    })

    render(<AIUsageStats />)

    await waitFor(() => {
      expect(screen.getByText('AI Usage Dashboard')).toBeInTheDocument()
    })

    expect(screen.queryByText('Top Skills (this month)')).not.toBeInTheDocument()
  })

  it('calls /api/ai/usage on mount', async () => {
    mockFetchResponse({
      allTime: { conversations: 0, executions: 0, insights: 0, tokens: 0, costINR: 0 },
      thisMonth: { conversations: 0, executions: 0, tokens: 0, costINR: 0 },
      skillBreakdown: [],
    })

    render(<AIUsageStats />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/usage')
    })
  })
})
