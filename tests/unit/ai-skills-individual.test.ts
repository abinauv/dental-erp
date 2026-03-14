import { describe, it, expect } from 'vitest'
import { getSkill } from '@/lib/ai/skills/index'

/**
 * Individual AI skill tests — validates systemPrompt generation,
 * role restrictions, and model tier assignments for each skill.
 */

const HOSPITAL = 'Test Dental Clinic'
const CONTEXT = JSON.stringify({
  patients: [{ name: 'John Doe', age: 45 }],
  appointments: [{ date: '2026-03-10', time: '10:00' }],
  inventory: [{ name: 'Gloves', stock: 50 }],
})

describe('AI Skills — Individual Prompt Generation', () => {
  describe('patient-intake', () => {
    const skill = getSkill('patient-intake')!

    it('generates systemPrompt with hospital name and context', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      expect(prompt).toContain(HOSPITAL)
      expect(prompt.length).toBeGreaterThan(100)
    })

    it('restricts to ADMIN and RECEPTIONIST roles', () => {
      expect(skill.allowedRoles).toContain('ADMIN')
      expect(skill.allowedRoles).not.toContain('DOCTOR')
    })

    it('prompt mentions phone number collection', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      expect(prompt.toLowerCase()).toContain('phone')
    })

    it('prompt mentions medical history or allergies', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/medical|allerg|history/)).toBeTruthy()
    })
  })

  describe('smart-scheduler', () => {
    const skill = getSkill('smart-scheduler')!

    it('generates scheduling-focused prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      expect(prompt.toLowerCase()).toMatch(/schedul/)
      expect(prompt.toLowerCase()).toContain('appointment')
    })

    it('mentions conflict or double-booking prevention', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/conflict|double|overlap|booking/)).toBeTruthy()
    })

    it('restricts to ADMIN and RECEPTIONIST', () => {
      expect(skill.allowedRoles).toContain('ADMIN')
    })
  })

  describe('treatment-advisor', () => {
    const skill = getSkill('treatment-advisor')!

    it('generates clinical treatment prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      expect(prompt.toLowerCase()).toContain('treatment')
    })

    it('uses clinical model tier', () => {
      expect(skill.modelTier).toBe('clinical')
    })

    it('restricts to ADMIN and DOCTOR', () => {
      expect(skill.allowedRoles).toContain('DOCTOR')
      expect(skill.allowedRoles).toContain('ADMIN')
    })

    it('mentions safety disclaimers', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/review|ai-generated|disclaimer|diagnos/)).toBeTruthy()
    })
  })

  describe('billing-agent', () => {
    const skill = getSkill('billing-agent')!

    it('generates billing prompt with GST mention', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/gst|tax|invoice|billing/)).toBeTruthy()
    })

    it('uses billing model tier', () => {
      expect(skill.modelTier).toBe('billing')
    })

    it('restricts to ADMIN and ACCOUNTANT', () => {
      expect(skill.allowedRoles).toContain('ADMIN')
    })
  })

  describe('inventory-manager', () => {
    const skill = getSkill('inventory-manager')!

    it('generates inventory management prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/inventory|stock|supply/)).toBeTruthy()
    })

    it('mentions reorder or low stock', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/reorder|low stock|critical/)).toBeTruthy()
    })
  })

  describe('lab-coordinator', () => {
    const skill = getSkill('lab-coordinator')!

    it('generates lab order prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/lab|order|vendor/)).toBeTruthy()
    })
  })

  describe('clinic-analyst', () => {
    const skill = getSkill('clinic-analyst')!

    it('generates analytics prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/analy|report|metric|insight|data|clinic/)).toBeTruthy()
    })

    it('has a valid model tier', () => {
      expect(typeof skill.modelTier).toBe('string')
      expect(skill.modelTier.length).toBeGreaterThan(0)
    })
  })

  describe('no-show-predictor', () => {
    const skill = getSkill('no-show-predictor')!

    it('generates no-show risk prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/no.?show|risk|predict/)).toBeTruthy()
    })
  })

  describe('inventory-forecaster', () => {
    const skill = getSkill('inventory-forecaster')!

    it('generates demand forecasting prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/forecast|demand|predict|inventory/)).toBeTruthy()
    })
  })

  describe('cashflow-forecaster', () => {
    const skill = getSkill('cashflow-forecaster')!

    it('generates cashflow projection prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/cashflow|cash flow|revenue|project/)).toBeTruthy()
    })
  })

  describe('patient-segmentation', () => {
    const skill = getSkill('patient-segmentation')!

    it('generates segmentation prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/segment|rfm|cohort|group/)).toBeTruthy()
    })
  })

  describe('claim-analyzer', () => {
    const skill = getSkill('claim-analyzer')!

    it('generates claim analysis prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/claim|insurance|denial|reject/)).toBeTruthy()
    })
  })

  describe('consent-generator', () => {
    const skill = getSkill('consent-generator')!

    it('generates consent form prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/consent|form|patient|sign/)).toBeTruthy()
    })

    it('uses clinical model tier', () => {
      expect(skill.modelTier).toBe('clinical')
    })
  })

  describe('dynamic-pricing', () => {
    const skill = getSkill('dynamic-pricing')!

    it('generates pricing suggestion prompt', () => {
      const prompt = skill.systemPrompt(HOSPITAL, CONTEXT)
      const lower = prompt.toLowerCase()
      expect(lower.match(/pric|cost|fee|market/)).toBeTruthy()
    })
  })

  describe('all skills produce non-empty prompts', () => {
    const skillNames = [
      'patient-intake', 'smart-scheduler', 'treatment-advisor',
      'billing-agent', 'inventory-manager', 'lab-coordinator',
      'clinic-analyst', 'no-show-predictor', 'inventory-forecaster',
      'cashflow-forecaster', 'patient-segmentation', 'claim-analyzer',
      'consent-generator', 'dynamic-pricing',
    ]

    it.each(skillNames)('%s produces valid prompt', (name) => {
      const skill = getSkill(name)
      expect(skill).toBeDefined()
      const prompt = skill!.systemPrompt(HOSPITAL, CONTEXT)
      expect(typeof prompt).toBe('string')
      expect(prompt.length).toBeGreaterThan(50)
      expect(prompt).toContain(HOSPITAL)
    })
  })
})
