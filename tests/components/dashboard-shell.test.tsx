// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

// Mock child components to isolate DashboardShell
vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: ({ role, hospitalName, plan }: any) => (
    <div data-testid="sidebar" data-role={role} data-hospital={hospitalName} data-plan={plan}>
      Sidebar
    </div>
  ),
}))

vi.mock('@/components/layout/mobile-sidebar', () => ({
  MobileSidebar: ({ role }: any) => (
    <div data-testid="mobile-sidebar" data-role={role}>MobileSidebar</div>
  ),
}))

vi.mock('@/components/layout/header', () => ({
  Header: ({ user }: any) => (
    <div data-testid="header" data-user-name={user.name} data-user-role={user.role}>
      Header
    </div>
  ),
}))

vi.mock('@/components/layout/sidebar-context', () => ({
  SidebarProvider: ({ children }: any) => <div data-testid="sidebar-provider">{children}</div>,
}))

vi.mock('@/components/ai/ai-provider', () => ({
  AIProvider: ({ children }: any) => <div data-testid="ai-provider">{children}</div>,
}))

vi.mock('@/components/ai/command-bar', () => ({
  CommandBar: () => <div data-testid="command-bar">CommandBar</div>,
}))

vi.mock('@/components/ai/chat-widget', () => ({
  ChatWidget: () => <div data-testid="chat-widget">ChatWidget</div>,
}))

vi.mock('@/components/ui/breadcrumb', () => ({
  Breadcrumb: ({ className }: any) => <nav data-testid="breadcrumb" className={className}>Breadcrumb</nav>,
}))

vi.mock('@/components/layout/keyboard-shortcut-help', () => ({
  KeyboardShortcutHelp: () => <div data-testid="keyboard-shortcut-help">KeyboardShortcutHelp</div>,
}))

import { DashboardShell } from '@/components/layout/dashboard-shell'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const defaultUser = { name: 'Dr. Smith', email: 'dr@clinic.com', role: 'DOCTOR' }
const defaultHospital = { name: 'Bright Smile Dental', plan: 'PREMIUM', logo: '/logo.png' }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardShell', () => {
  it('renders Sidebar with correct props', () => {
    render(
      <DashboardShell user={defaultUser} hospital={defaultHospital}>
        <p>Page content</p>
      </DashboardShell>
    )
    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toHaveAttribute('data-role', 'DOCTOR')
    expect(sidebar).toHaveAttribute('data-hospital', 'Bright Smile Dental')
    expect(sidebar).toHaveAttribute('data-plan', 'PREMIUM')
  })

  it('renders MobileSidebar with user role', () => {
    render(
      <DashboardShell user={defaultUser} hospital={defaultHospital}>
        <p>Content</p>
      </DashboardShell>
    )
    const mobileSidebar = screen.getByTestId('mobile-sidebar')
    expect(mobileSidebar).toHaveAttribute('data-role', 'DOCTOR')
  })

  it('renders Header with user info', () => {
    render(
      <DashboardShell user={defaultUser} hospital={defaultHospital}>
        <p>Content</p>
      </DashboardShell>
    )
    const header = screen.getByTestId('header')
    expect(header).toHaveAttribute('data-user-name', 'Dr. Smith')
    expect(header).toHaveAttribute('data-user-role', 'DOCTOR')
  })

  it('renders children in main area', () => {
    render(
      <DashboardShell user={defaultUser} hospital={defaultHospital}>
        <p>Page content here</p>
      </DashboardShell>
    )
    expect(screen.getByText('Page content here')).toBeInTheDocument()
  })

  it('wraps in AIProvider', () => {
    render(
      <DashboardShell user={defaultUser} hospital={defaultHospital}>
        <p>Content</p>
      </DashboardShell>
    )
    expect(screen.getByTestId('ai-provider')).toBeInTheDocument()
  })

  it('wraps in SidebarProvider', () => {
    render(
      <DashboardShell user={defaultUser} hospital={defaultHospital}>
        <p>Content</p>
      </DashboardShell>
    )
    expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument()
  })

  it('renders CommandBar', () => {
    render(
      <DashboardShell user={defaultUser} hospital={defaultHospital}>
        <p>Content</p>
      </DashboardShell>
    )
    expect(screen.getByTestId('command-bar')).toBeInTheDocument()
  })

  it('renders ChatWidget', () => {
    render(
      <DashboardShell user={defaultUser} hospital={defaultHospital}>
        <p>Content</p>
      </DashboardShell>
    )
    expect(screen.getByTestId('chat-widget')).toBeInTheDocument()
  })

  it('renders KeyboardShortcutHelp', () => {
    render(
      <DashboardShell user={defaultUser} hospital={defaultHospital}>
        <p>Content</p>
      </DashboardShell>
    )
    expect(screen.getByTestId('keyboard-shortcut-help')).toBeInTheDocument()
  })

  it('renders Breadcrumb', () => {
    render(
      <DashboardShell user={defaultUser} hospital={defaultHospital}>
        <p>Content</p>
      </DashboardShell>
    )
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument()
  })

  it('works without hospital prop', () => {
    render(
      <DashboardShell user={defaultUser}>
        <p>No hospital</p>
      </DashboardShell>
    )
    expect(screen.getByText('No hospital')).toBeInTheDocument()
    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).not.toHaveAttribute('data-hospital', expect.any(String))
  })

  it('renders multiple children', () => {
    render(
      <DashboardShell user={defaultUser} hospital={defaultHospital}>
        <h1>Title</h1>
        <p>Body</p>
        <footer>Footer</footer>
      </DashboardShell>
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('passes different roles correctly', () => {
    const adminUser = { name: 'Admin', email: 'admin@clinic.com', role: 'SUPER_ADMIN' }
    render(
      <DashboardShell user={adminUser} hospital={defaultHospital}>
        <p>Admin page</p>
      </DashboardShell>
    )
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-role', 'SUPER_ADMIN')
    expect(screen.getByTestId('mobile-sidebar')).toHaveAttribute('data-role', 'SUPER_ADMIN')
    expect(screen.getByTestId('header')).toHaveAttribute('data-user-role', 'SUPER_ADMIN')
  })
})
