// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'

import { SidebarProvider, useSidebar } from '@/components/layout/sidebar-context'

function wrapper({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>
}

describe('useSidebar outside provider', () => {
  it('throws when used outside SidebarProvider', () => {
    expect(() => {
      renderHook(() => useSidebar())
    }).toThrow('useSidebar must be used within a SidebarProvider')
  })
})

describe('SidebarProvider', () => {
  it('provides isCollapsed as false initially', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    expect(result.current.isCollapsed).toBe(false)
  })

  it('provides mobileOpen as false initially', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    expect(result.current.mobileOpen).toBe(false)
  })

  it('setIsCollapsed updates collapsed state', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    act(() => {
      result.current.setIsCollapsed(true)
    })
    expect(result.current.isCollapsed).toBe(true)
  })

  it('toggleSidebar toggles collapsed state', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    expect(result.current.isCollapsed).toBe(false)

    act(() => {
      result.current.toggleSidebar()
    })
    expect(result.current.isCollapsed).toBe(true)

    act(() => {
      result.current.toggleSidebar()
    })
    expect(result.current.isCollapsed).toBe(false)
  })

  it('setMobileOpen updates mobile state', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })
    act(() => {
      result.current.setMobileOpen(true)
    })
    expect(result.current.mobileOpen).toBe(true)

    act(() => {
      result.current.setMobileOpen(false)
    })
    expect(result.current.mobileOpen).toBe(false)
  })

  it('collapsed and mobile states are independent', () => {
    const { result } = renderHook(() => useSidebar(), { wrapper })

    act(() => {
      result.current.setIsCollapsed(true)
      result.current.setMobileOpen(true)
    })
    expect(result.current.isCollapsed).toBe(true)
    expect(result.current.mobileOpen).toBe(true)

    act(() => {
      result.current.toggleSidebar()
    })
    expect(result.current.isCollapsed).toBe(false)
    expect(result.current.mobileOpen).toBe(true)
  })
})
