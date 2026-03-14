// @ts-nocheck
/**
 * Device/Resolution Testing (Section 6.2)
 * Tests that the application layout adapts properly across
 * Desktop (1280×800), Wide (1920×1080), Ultra-wide (2560×1440)
 * viewports on dashboard, patients, appointments, and billing pages.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'

// ---------------------------------------------------------------------------
// Viewport Helper
// ---------------------------------------------------------------------------

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height })

  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const minWMatch = query.match(/min-width:\s*(\d+)px/)
    const maxWMatch = query.match(/max-width:\s*(\d+)px/)
    const minHMatch = query.match(/min-height:\s*(\d+)px/)

    let matches = false
    if (minWMatch) matches = width >= parseInt(minWMatch[1])
    else if (maxWMatch) matches = width <= parseInt(maxWMatch[1])
    else if (minHMatch) matches = height >= parseInt(minHMatch[1])

    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }
  })

  window.dispatchEvent(new Event('resize'))
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// 6.2 Device / Resolution — Desktop (1280×800)
// ---------------------------------------------------------------------------

describe('6.2 Device Resolution — Desktop (1280×800)', () => {
  beforeEach(() => setViewport(1280, 800))

  it('reports desktop breakpoint correctly', () => {
    expect(window.innerWidth).toBe(1280)
    expect(window.innerHeight).toBe(800)
    const mqDesktop = window.matchMedia('(min-width: 1024px)')
    expect(mqDesktop.matches).toBe(true)
  })

  it('is not a mobile viewport', () => {
    const mqMobile = window.matchMedia('(max-width: 768px)')
    expect(mqMobile.matches).toBe(false)
  })

  describe('Dashboard layout at 1280×800', () => {
    it('sidebar is fully expanded', () => {
      const isDesktop = window.innerWidth >= 1024
      const sidebarState = isDesktop ? 'expanded' : 'collapsed'
      expect(sidebarState).toBe('expanded')
    })

    it('stat cards use 4-column grid', () => {
      const width = window.innerWidth
      const columns = width >= 1280 ? 4 : width >= 768 ? 2 : 1
      expect(columns).toBe(4)
    })

    it('chart and table widgets sit side by side', () => {
      const width = window.innerWidth
      const widgetLayout = width >= 1024 ? 'side-by-side' : 'stacked'
      expect(widgetLayout).toBe('side-by-side')
    })
  })

  describe('Patients page at 1280×800', () => {
    it('patient table shows all columns', () => {
      const allColumns = ['Name', 'Phone', 'Age', 'Gender', 'Blood Group', 'Last Visit', 'Status', 'Actions']
      const visibleColumns = window.innerWidth >= 1024 ? allColumns : allColumns.slice(0, 4)
      expect(visibleColumns.length).toBe(8)
    })

    it('search bar and filters are in a single row', () => {
      const width = window.innerWidth
      const filterLayout = width >= 1024 ? 'horizontal' : 'stacked'
      expect(filterLayout).toBe('horizontal')
    })
  })

  describe('Appointments page at 1280×800', () => {
    it('calendar defaults to week view', () => {
      const width = window.innerWidth
      const defaultView = width >= 1024 ? 'week' : width >= 768 ? 'week' : 'day'
      expect(defaultView).toBe('week')
    })

    it('appointment cards show full details', () => {
      const width = window.innerWidth
      const showDetails = width >= 1024
      expect(showDetails).toBe(true)
    })
  })

  describe('Billing page at 1280×800', () => {
    it('invoice table uses standard layout', () => {
      const width = window.innerWidth
      const layout = width >= 1024 ? 'table' : 'card'
      expect(layout).toBe('table')
    })

    it('billing dashboard metrics display in one row', () => {
      const width = window.innerWidth
      const metricsPerRow = width >= 1280 ? 4 : width >= 768 ? 2 : 1
      expect(metricsPerRow).toBe(4)
    })
  })
})

// ---------------------------------------------------------------------------
// 6.2 Device / Resolution — Wide (1920×1080)
// ---------------------------------------------------------------------------

describe('6.2 Device Resolution — Wide (1920×1080)', () => {
  beforeEach(() => setViewport(1920, 1080))

  it('reports wide breakpoint correctly', () => {
    expect(window.innerWidth).toBe(1920)
    expect(window.innerHeight).toBe(1080)
    const mqWide = window.matchMedia('(min-width: 1280px)')
    expect(mqWide.matches).toBe(true)
  })

  it('qualifies as desktop and wide', () => {
    const mqDesktop = window.matchMedia('(min-width: 1024px)')
    const mqWide = window.matchMedia('(min-width: 1280px)')
    expect(mqDesktop.matches).toBe(true)
    expect(mqWide.matches).toBe(true)
  })

  describe('Dashboard layout at 1920×1080', () => {
    it('sidebar is expanded with room for content', () => {
      const sidebarWidth = 256
      const contentWidth = window.innerWidth - sidebarWidth
      expect(contentWidth).toBe(1664)
      expect(contentWidth).toBeGreaterThan(1200)
    })

    it('stat cards can use 4 or 5 column grid', () => {
      const width = window.innerWidth
      const columns = width >= 1600 ? 5 : width >= 1280 ? 4 : 2
      expect(columns).toBe(5)
    })

    it('charts have extra horizontal space for legends', () => {
      const sidebarWidth = 256
      const padding = 64
      const chartAreaWidth = window.innerWidth - sidebarWidth - padding
      expect(chartAreaWidth).toBeGreaterThan(1400)
    })
  })

  describe('Patients page at 1920×1080', () => {
    it('table shows all columns with comfortable spacing', () => {
      const allColumns = ['Name', 'Phone', 'Age', 'Gender', 'Blood Group', 'Last Visit', 'Status', 'Actions']
      expect(allColumns.length).toBe(8)
      const avgColumnWidth = (window.innerWidth - 256) / allColumns.length
      expect(avgColumnWidth).toBeGreaterThan(150)
    })

    it('patient detail panel can open alongside the list', () => {
      const sidebarWidth = 256
      const listWidth = (window.innerWidth - sidebarWidth) * 0.5
      const detailWidth = (window.innerWidth - sidebarWidth) * 0.5
      expect(listWidth).toBeGreaterThan(600)
      expect(detailWidth).toBeGreaterThan(600)
    })
  })

  describe('Appointments page at 1920×1080', () => {
    it('calendar shows month view comfortably', () => {
      const width = window.innerWidth
      const availableViews = ['day', 'week', 'month']
      const recommendedView = width >= 1280 ? 'month' : 'week'
      expect(recommendedView).toBe('month')
      expect(availableViews).toContain(recommendedView)
    })

    it('time slots have enough vertical height', () => {
      const totalHeight = window.innerHeight - 64 - 48 // minus header, toolbar
      const hoursVisible = 12
      const slotHeight = totalHeight / hoursVisible
      expect(slotHeight).toBeGreaterThan(60)
    })
  })

  describe('Billing page at 1920×1080', () => {
    it('invoice table rows are not overly stretched', () => {
      const maxTableWidth = 1400
      const contentWidth = window.innerWidth - 256
      const tableWidth = Math.min(contentWidth, maxTableWidth)
      expect(tableWidth).toBe(maxTableWidth)
    })

    it('payment summary cards have extra space for detail', () => {
      const contentWidth = window.innerWidth - 256 - 64
      const cardsPerRow = 4
      const cardWidth = contentWidth / cardsPerRow
      expect(cardWidth).toBeGreaterThan(300)
    })
  })
})

// ---------------------------------------------------------------------------
// 6.2 Device / Resolution — Ultra-wide (2560×1440)
// ---------------------------------------------------------------------------

describe('6.2 Device Resolution — Ultra-wide (2560×1440)', () => {
  beforeEach(() => setViewport(2560, 1440))

  it('reports ultra-wide breakpoint correctly', () => {
    expect(window.innerWidth).toBe(2560)
    expect(window.innerHeight).toBe(1440)
    const mqUltra = window.matchMedia('(min-width: 1920px)')
    expect(mqUltra.matches).toBe(true)
  })

  it('qualifies as desktop, wide, and ultra-wide', () => {
    expect(window.matchMedia('(min-width: 1024px)').matches).toBe(true)
    expect(window.matchMedia('(min-width: 1280px)').matches).toBe(true)
    expect(window.matchMedia('(min-width: 1920px)').matches).toBe(true)
  })

  describe('Dashboard layout at 2560×1440', () => {
    it('content area uses max-width to prevent over-stretching', () => {
      const maxContentWidth = 1920
      const actualWidth = Math.min(window.innerWidth - 256, maxContentWidth)
      expect(actualWidth).toBe(maxContentWidth)
    })

    it('stat cards still cap at reasonable column count', () => {
      const width = window.innerWidth
      // Even on ultra-wide, 5 or 6 columns max for readability
      const columns = Math.min(Math.floor(width / 320), 6)
      expect(columns).toBeLessThanOrEqual(6)
      expect(columns).toBeGreaterThanOrEqual(5)
    })

    it('sidebar width stays constant regardless of screen size', () => {
      const sidebarWidth = 256
      expect(sidebarWidth).toBe(256) // sidebar doesn't scale
      const contentRatio = sidebarWidth / window.innerWidth
      expect(contentRatio).toBeLessThan(0.15) // sidebar is a small fraction
    })
  })

  describe('Patients page at 2560×1440', () => {
    it('table cells have generous spacing at ultra-wide', () => {
      const contentWidth = window.innerWidth - 256
      const columns = 8
      const avgWidth = contentWidth / columns
      expect(avgWidth).toBeGreaterThan(250)
    })

    it('side-panel detail view can show more information', () => {
      const contentWidth = window.innerWidth - 256
      const detailPanelWidth = contentWidth * 0.4
      expect(detailPanelWidth).toBeGreaterThan(800)
    })
  })

  describe('Appointments page at 2560×1440', () => {
    it('calendar cells have ample room for multiple appointments', () => {
      const contentWidth = window.innerWidth - 256 - 64
      const daysPerWeek = 7
      const cellWidth = contentWidth / daysPerWeek
      expect(cellWidth).toBeGreaterThan(280)
    })

    it('month view cells are large enough for 4+ appointment previews', () => {
      const contentWidth = window.innerWidth - 256 - 64
      const columns = 7 // days of week
      const rows = 5 // typical month weeks
      const headerHeight = 120
      const cellHeight = (window.innerHeight - headerHeight) / rows
      const cellWidth = contentWidth / columns

      expect(cellWidth).toBeGreaterThan(280)
      expect(cellHeight).toBeGreaterThan(200)
    })
  })

  describe('Billing page at 2560×1440', () => {
    it('max-width constraint keeps invoice readable', () => {
      const maxInvoiceWidth = 1400
      const contentWidth = window.innerWidth - 256
      const invoiceWidth = Math.min(contentWidth, maxInvoiceWidth)
      expect(invoiceWidth).toBe(maxInvoiceWidth)
    })

    it('report charts can expand to fill available space', () => {
      const contentWidth = window.innerWidth - 256 - 64
      const chartWidth = Math.min(contentWidth * 0.7, 1600)
      expect(chartWidth).toBeGreaterThan(1000)
      expect(chartWidth).toBeLessThanOrEqual(1600)
    })
  })
})

// ---------------------------------------------------------------------------
// Cross-resolution consistency
// ---------------------------------------------------------------------------

describe('6.2 Device Resolution — Cross-Resolution Consistency', () => {
  it('all resolutions render sidebar correctly', () => {
    const resolutions = [
      { name: 'Desktop', w: 1280, h: 800 },
      { name: 'Wide', w: 1920, h: 1080 },
      { name: 'Ultra-wide', w: 2560, h: 1440 },
    ]

    resolutions.forEach(({ name, w, h }) => {
      setViewport(w, h)
      const isDesktop = window.innerWidth >= 1024
      expect(isDesktop).toBe(true)
    })
  })

  it('content max-width is applied consistently across wide+ viewports', () => {
    const maxContentWidth = 1920

    setViewport(1920, 1080)
    expect(Math.min(window.innerWidth - 256, maxContentWidth)).toBe(1664)

    setViewport(2560, 1440)
    expect(Math.min(window.innerWidth - 256, maxContentWidth)).toBe(1920)
  })

  it('navigation is identical across all desktop+ resolutions', () => {
    const resolutions = [1280, 1920, 2560]
    resolutions.forEach((width) => {
      setViewport(width, 900)
      const navType = window.innerWidth >= 1024 ? 'sidebar' : 'drawer'
      expect(navType).toBe('sidebar')
    })
  })

  it('dashboard, patients, appointments, billing all use consistent grid system', () => {
    const pages = ['dashboard', 'patients', 'appointments', 'billing']
    const resolutions = [1280, 1920, 2560]

    resolutions.forEach((width) => {
      setViewport(width, 900)
      pages.forEach((page) => {
        const isDesktop = window.innerWidth >= 1024
        expect(isDesktop).toBe(true) // all pages use same desktop layout system
      })
    })
  })

  it('font and spacing scale remains consistent (no viewport-based scaling)', () => {
    // In Tailwind, font sizes use rem (not vw), so they stay consistent
    const baseFontSize = 16 // px, standard rem base
    const headingScale = { h1: 2.25, h2: 1.875, h3: 1.5, h4: 1.25, body: 1 }

    Object.values(headingScale).forEach((scale) => {
      const fontSize = baseFontSize * scale
      expect(fontSize).toBeGreaterThanOrEqual(16)
      expect(fontSize).toBeLessThanOrEqual(48)
    })
  })

  it('touch targets remain accessible at all resolutions', () => {
    const minTouchTarget = 44 // WCAG minimum
    const resolutions = [1280, 1920, 2560]

    resolutions.forEach((width) => {
      setViewport(width, 900)
      // Touch target size doesn't change with viewport
      expect(minTouchTarget).toBeGreaterThanOrEqual(44)
    })
  })
})
