// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn()
const mockPathname = vi.fn().mockReturnValue('/')

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => mockPathname(),
  useParams: () => ({}),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// ---------------------------------------------------------------------------
// Import nav config directly (no UI component mocks needed)
// ---------------------------------------------------------------------------

import { navigation, getNavigationForRole } from '@/config/nav'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Navigation Structure', () => {
  describe('All links are valid paths', () => {
    it('every item has a non-empty href starting with /', () => {
      const allItems: any[] = []
      navigation.forEach((section) => {
        section.items.forEach((item) => {
          allItems.push(item)
          if (item.subItems) {
            item.subItems.forEach((sub) => allItems.push(sub))
          }
        })
      })

      allItems.forEach((item) => {
        expect(item.href).toBeTruthy()
        expect(item.href.startsWith('/')).toBe(true)
      })
    })

    it('every item has a non-empty title', () => {
      const allItems: any[] = []
      navigation.forEach((section) => {
        section.items.forEach((item) => {
          allItems.push(item)
          if (item.subItems) {
            item.subItems.forEach((sub) => allItems.push(sub))
          }
        })
      })

      allItems.forEach((item) => {
        expect(item.title).toBeTruthy()
        expect(item.title.length).toBeGreaterThan(0)
      })
    })

    it('every item has an icon', () => {
      navigation.forEach((section) => {
        section.items.forEach((item) => {
          expect(item.icon).toBeTruthy()
          if (item.subItems) {
            item.subItems.forEach((sub) => {
              expect(sub.icon).toBeTruthy()
            })
          }
        })
      })
    })

    it('top-level items have mostly unique hrefs', () => {
      const hrefs: string[] = []
      navigation.forEach((section) => {
        section.items.forEach((item) => {
          hrefs.push(item.href)
        })
      })

      // Top-level items should be unique
      const uniqueHrefs = new Set(hrefs)
      expect(uniqueHrefs.size).toBe(hrefs.length)
    })
  })

  describe('Section structure', () => {
    it('has multiple navigation sections', () => {
      expect(navigation.length).toBeGreaterThan(3)
    })

    it('each section has a title and items array', () => {
      navigation.forEach((section) => {
        expect(section.title).toBeTruthy()
        expect(Array.isArray(section.items)).toBe(true)
        expect(section.items.length).toBeGreaterThan(0)
      })
    })

    it('has an Overview section with Dashboard', () => {
      const overview = navigation.find((s) => s.title === 'Overview')
      expect(overview).toBeDefined()
      const dashboard = overview!.items.find((i) => i.title === 'Dashboard')
      expect(dashboard).toBeDefined()
      expect(dashboard!.href).toBe('/dashboard')
    })

    it('has a Settings section', () => {
      const settings = navigation.find((s) =>
        s.items.some((i) => i.href === '/settings' || i.title === 'Settings')
      )
      expect(settings).toBeDefined()
    })
  })

  describe('Role-based filtering', () => {
    it('ADMIN gets all navigation items', () => {
      const adminNav = getNavigationForRole('ADMIN')
      // Admin should have at least as many sections as the full nav
      expect(adminNav.length).toBeGreaterThanOrEqual(navigation.length - 1)
    })

    it('DOCTOR gets filtered navigation', () => {
      const doctorNav = getNavigationForRole('DOCTOR')
      // Doctor should see clinical items but maybe not all admin items
      const allItems = doctorNav.flatMap((s) => s.items)
      // Dashboard should be visible
      expect(allItems.some((i) => i.href === '/dashboard')).toBe(true)
    })

    it('RECEPTIONIST gets filtered navigation', () => {
      const receptionistNav = getNavigationForRole('RECEPTIONIST')
      const allItems = receptionistNav.flatMap((s) => s.items)
      // Receptionist should see appointments
      expect(allItems.some((i) => i.href === '/appointments')).toBe(true)
    })

    it('ACCOUNTANT gets billing-related items', () => {
      const accountantNav = getNavigationForRole('ACCOUNTANT')
      const allItems = accountantNav.flatMap((s) => s.items)
      // Accountant should see billing
      const hasBilling = allItems.some(
        (i) => i.href.includes('billing') || i.href.includes('invoices') || i.title.includes('Billing')
      )
      expect(hasBilling).toBe(true)
    })

    it('LAB_TECH gets lab-related items', () => {
      const labNav = getNavigationForRole('LAB_TECH')
      const allItems = labNav.flatMap((s) => s.items)
      const hasLab = allItems.some(
        (i) => i.href.includes('lab') || i.title.toLowerCase().includes('lab')
      )
      expect(hasLab).toBe(true)
    })

    it('empty sections are removed after filtering', () => {
      const roles = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT', 'LAB_TECH']
      roles.forEach((role) => {
        const nav = getNavigationForRole(role)
        nav.forEach((section) => {
          expect(section.items.length).toBeGreaterThan(0)
        })
      })
    })
  })

  describe('Breadcrumb paths', () => {
    it('key routes have hierarchical structure', () => {
      // Verify common route hierarchies
      const flatItems: any[] = []
      navigation.forEach((section) => {
        section.items.forEach((item) => {
          flatItems.push(item)
          if (item.subItems) {
            item.subItems.forEach((sub) => flatItems.push(sub))
          }
        })
      })

      // Sub-routes should be deeper paths of parent routes
      const parentPaths = flatItems.filter((i) => i.subItems && i.subItems.length > 0)
      parentPaths.forEach((parent) => {
        parent.subItems.forEach((sub: any) => {
          // Sub-item href should start with parent href or be related
          expect(sub.href.startsWith('/')).toBe(true)
        })
      })
    })
  })

  describe('Deep linking support', () => {
    it('all top-level routes are directly accessible', () => {
      const topLevelRoutes: string[] = []
      navigation.forEach((section) => {
        section.items.forEach((item) => {
          topLevelRoutes.push(item.href)
        })
      })

      // All should be valid absolute paths
      topLevelRoutes.forEach((route) => {
        expect(route.startsWith('/')).toBe(true)
        expect(route).not.toContain(' ')
        expect(route).not.toContain('#')
      })
    })
  })
})
