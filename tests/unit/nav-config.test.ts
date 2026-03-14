// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { navigation, getNavigationForRole } from '@/config/nav'

describe('navigation config', () => {
  it('exports navigation as an array of sections', () => {
    expect(Array.isArray(navigation)).toBe(true)
    expect(navigation.length).toBeGreaterThan(0)
  })

  it('each section has title and items', () => {
    navigation.forEach((section) => {
      expect(section.title).toBeDefined()
      expect(Array.isArray(section.items)).toBe(true)
    })
  })

  it('each item has title, href, and icon', () => {
    navigation.forEach((section) => {
      section.items.forEach((item) => {
        expect(item.title).toBeDefined()
        expect(item.href).toBeDefined()
        expect(item.icon).toBeDefined()
      })
    })
  })

  it('contains expected sections', () => {
    const titles = navigation.map((s) => s.title)
    expect(titles).toContain('Overview')
    expect(titles).toContain('Patient Care')
    expect(titles).toContain('Finance')
    expect(titles).toContain('Operations')
    expect(titles).toContain('Administration')
  })

  it('Overview section has Dashboard and AI Chat', () => {
    const overview = navigation.find((s) => s.title === 'Overview')!
    const titles = overview.items.map((i) => i.title)
    expect(titles).toContain('Dashboard')
    expect(titles).toContain('AI Chat')
  })

  it('Dashboard has no role restriction', () => {
    const overview = navigation.find((s) => s.title === 'Overview')!
    const dashboard = overview.items.find((i) => i.title === 'Dashboard')!
    expect(dashboard.roles).toBeUndefined()
  })

  it('Settings requires ADMIN role', () => {
    const admin = navigation.find((s) => s.title === 'Administration')!
    const settings = admin.items.find((i) => i.title === 'Settings')!
    expect(settings.roles).toEqual(['ADMIN'])
  })

  it('Billing has subItems', () => {
    const finance = navigation.find((s) => s.title === 'Finance')!
    const billing = finance.items.find((i) => i.title === 'Billing')!
    expect(billing.subItems).toBeDefined()
    expect(billing.subItems!.length).toBeGreaterThan(0)
  })

  it('Appointments has subItems with Waitlist', () => {
    const care = navigation.find((s) => s.title === 'Patient Care')!
    const appointments = care.items.find((i) => i.title === 'Appointments')!
    expect(appointments.subItems).toBeDefined()
    const waitlist = appointments.subItems!.find((i) => i.title === 'Waitlist')
    expect(waitlist).toBeDefined()
    expect(waitlist!.roles).toContain('ADMIN')
  })
})

describe('getNavigationForRole', () => {
  it('ADMIN sees all sections', () => {
    const nav = getNavigationForRole('ADMIN')
    const titles = nav.map((s) => s.title)
    expect(titles).toContain('Overview')
    expect(titles).toContain('Patient Care')
    expect(titles).toContain('Finance')
    expect(titles).toContain('Operations')
    expect(titles).toContain('Administration')
  })

  it('ADMIN sees Settings', () => {
    const nav = getNavigationForRole('ADMIN')
    const admin = nav.find((s) => s.title === 'Administration')!
    const items = admin.items.map((i) => i.title)
    expect(items).toContain('Settings')
  })

  it('DOCTOR does not see Settings', () => {
    const nav = getNavigationForRole('DOCTOR')
    const admin = nav.find((s) => s.title === 'Administration')
    if (admin) {
      const items = admin.items.map((i) => i.title)
      expect(items).not.toContain('Settings')
    }
  })

  it('DOCTOR sees Treatments', () => {
    const nav = getNavigationForRole('DOCTOR')
    const care = nav.find((s) => s.title === 'Patient Care')!
    const items = care.items.map((i) => i.title)
    expect(items).toContain('Treatments')
  })

  it('RECEPTIONIST does not see Treatments', () => {
    const nav = getNavigationForRole('RECEPTIONIST')
    const care = nav.find((s) => s.title === 'Patient Care')!
    const items = care.items.map((i) => i.title)
    expect(items).not.toContain('Treatments')
  })

  it('RECEPTIONIST sees Billing', () => {
    const nav = getNavigationForRole('RECEPTIONIST')
    const finance = nav.find((s) => s.title === 'Finance')!
    const items = finance.items.map((i) => i.title)
    expect(items).toContain('Billing')
  })

  it('ACCOUNTANT sees Billing but not Inventory', () => {
    const nav = getNavigationForRole('ACCOUNTANT')
    const finance = nav.find((s) => s.title === 'Finance')!
    expect(finance.items.map((i) => i.title)).toContain('Billing')

    const ops = nav.find((s) => s.title === 'Operations')
    if (ops) {
      expect(ops.items.map((i) => i.title)).not.toContain('Inventory')
    }
  })

  it('LAB_TECH sees Lab Orders', () => {
    const nav = getNavigationForRole('LAB_TECH')
    const ops = nav.find((s) => s.title === 'Operations')!
    const items = ops.items.map((i) => i.title)
    expect(items).toContain('Lab Orders')
  })

  it('LAB_TECH does not see Sterilization', () => {
    const nav = getNavigationForRole('LAB_TECH')
    const ops = nav.find((s) => s.title === 'Operations')
    if (ops) {
      expect(ops.items.map((i) => i.title)).not.toContain('Sterilization')
    }
  })

  it('filters out empty sections', () => {
    const nav = getNavigationForRole('UNKNOWN_ROLE')
    // Should still have Overview (no role restrictions) but may lack restricted sections
    nav.forEach((section) => {
      expect(section.items.length).toBeGreaterThan(0)
    })
  })

  it('filters subItems by role', () => {
    const nav = getNavigationForRole('RECEPTIONIST')
    const care = nav.find((s) => s.title === 'Patient Care')!
    const appointments = care.items.find((i) => i.title === 'Appointments')
    if (appointments?.subItems) {
      const waitlist = appointments.subItems.find((i) => i.title === 'Waitlist')
      expect(waitlist).toBeDefined() // RECEPTIONIST is in waitlist roles
    }
  })

  it('DOCTOR does not see Waitlist subItem', () => {
    const nav = getNavigationForRole('DOCTOR')
    const care = nav.find((s) => s.title === 'Patient Care')!
    const appointments = care.items.find((i) => i.title === 'Appointments')
    if (appointments?.subItems) {
      const waitlist = appointments.subItems.find((i) => i.title === 'Waitlist')
      expect(waitlist).toBeUndefined()
    }
  })

  it('everyone sees Dashboard (no role restriction)', () => {
    const roles = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT', 'LAB_TECH']
    roles.forEach((role) => {
      const nav = getNavigationForRole(role)
      const overview = nav.find((s) => s.title === 'Overview')!
      expect(overview.items.map((i) => i.title)).toContain('Dashboard')
    })
  })
})
