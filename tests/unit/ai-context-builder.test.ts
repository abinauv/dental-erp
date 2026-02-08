import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => import("../__mocks__/prisma"))

import { buildContext, serializeContext } from "@/lib/ai/context-builder"
import type { AIContext } from "@/lib/ai/context-builder"
import { prisma } from "@/lib/prisma"
import { resetPrismaMocks } from "../__mocks__/prisma"

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_PARAMS = {
  hospitalId: "hosp-001",
  userId: "user-001",
  userName: "Dr. Smith",
  userRole: "DOCTOR",
  hospitalName: "Bright Smile Dental",
  hospitalPlan: "PROFESSIONAL",
} as const

const MOCK_MEDICAL_HISTORY = {
  id: "mh-001",
  patientId: "pat-001",
  drugAllergies: "Penicillin",
  hasDiabetes: true,
  diabetesType: "Type 2",
  hasHypertension: true,
  hasHeartDisease: true,
  hasHepatitis: true,
  hepatitisType: "B",
  hasHiv: true,
  hasEpilepsy: true,
  isPregnant: true,
  pregnancyWeeks: 24,
  hasBleedingDisorder: true,
  currentMedications: "Metformin 500mg, Amlodipine 5mg",
}

const MOCK_TREATMENT_PLANS = [
  { title: "Root Canal #14", status: "IN_PROGRESS", createdAt: new Date("2025-12-01") },
  { title: "Crown #14", status: "PLANNED", createdAt: new Date("2025-11-15") },
]

const MOCK_APPOINTMENTS = [
  {
    scheduledDate: new Date("2025-12-10T09:00:00Z"),
    appointmentType: "Follow-up",
    status: "COMPLETED",
  },
  {
    scheduledDate: new Date("2025-11-20T10:30:00Z"),
    appointmentType: "Root Canal",
    status: "COMPLETED",
  },
]

const MOCK_INVOICES = [
  { balanceAmount: 1500.0, status: "PENDING" },
  { balanceAmount: 750.5, status: "OVERDUE" },
]

function makeMockPatient(overrides: Record<string, unknown> = {}) {
  return {
    id: "pat-001",
    patientId: "PAT-2025-001",
    firstName: "Ramesh",
    lastName: "Kumar",
    age: 45,
    gender: "Male",
    hospitalId: "hosp-001",
    medicalHistory: MOCK_MEDICAL_HISTORY,
    treatmentPlans: MOCK_TREATMENT_PLANS,
    appointments: MOCK_APPOINTMENTS,
    invoices: MOCK_INVOICES,
    ...overrides,
  }
}

const MOCK_RISK_SCORE = {
  id: "risk-001",
  patientId: "pat-001",
  overallScore: 72,
  calculatedAt: new Date("2025-12-15"),
}

// ---------------------------------------------------------------------------
// Reset mocks before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetPrismaMocks()
})

// ---------------------------------------------------------------------------
// 1. buildContext without patientId
// ---------------------------------------------------------------------------

describe("buildContext", () => {
  describe("without patientId", () => {
    it("returns hospital and user context with no patient", async () => {
      const ctx = await buildContext(BASE_PARAMS)

      expect(ctx.hospital).toEqual({
        id: "hosp-001",
        name: "Bright Smile Dental",
        plan: "PROFESSIONAL",
      })
      expect(ctx.user).toEqual({
        id: "user-001",
        name: "Dr. Smith",
        role: "DOCTOR",
      })
      expect(ctx.patient).toBeUndefined()
    })

    it("does not query the database when patientId is absent", async () => {
      await buildContext(BASE_PARAMS)

      expect(prisma.patient.findUnique).not.toHaveBeenCalled()
      expect(prisma.patientRiskScore.findFirst).not.toHaveBeenCalled()
    })

    it("does not query the database when patientId is null", async () => {
      await buildContext({ ...BASE_PARAMS, patientId: null })

      expect(prisma.patient.findUnique).not.toHaveBeenCalled()
      expect(prisma.patientRiskScore.findFirst).not.toHaveBeenCalled()
      const ctx = await buildContext({ ...BASE_PARAMS, patientId: null })
      expect(ctx.patient).toBeUndefined()
    })

    it("passes currentPage through when provided", async () => {
      const ctx = await buildContext({ ...BASE_PARAMS, currentPage: "/patients" })

      expect(ctx.currentPage).toBe("/patients")
    })

    it("leaves currentPage undefined when not provided", async () => {
      const ctx = await buildContext(BASE_PARAMS)

      expect(ctx.currentPage).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. buildContext with patientId — full patient context
  // ---------------------------------------------------------------------------

  describe("with patientId", () => {
    it("queries the database and populates full patient context", async () => {
      const mockPatient = makeMockPatient()
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(prisma.patient.findUnique).toHaveBeenCalledOnce()
      expect(prisma.patient.findUnique).toHaveBeenCalledWith({
        where: { id: "pat-001", hospitalId: "hosp-001" },
        include: {
          medicalHistory: true,
          treatmentPlans: { orderBy: { createdAt: "desc" }, take: 5 },
          appointments: {
            where: { status: { in: ["COMPLETED"] } },
            orderBy: { scheduledDate: "desc" },
            take: 5,
          },
          invoices: {
            where: { status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] } },
          },
        },
      })

      expect(ctx.patient).toBeDefined()
      expect(ctx.patient!.id).toBe("pat-001")
      expect(ctx.patient!.patientId).toBe("PAT-2025-001")
      expect(ctx.patient!.name).toBe("Ramesh Kumar")
      expect(ctx.patient!.age).toBe(45)
      expect(ctx.patient!.gender).toBe("Male")
    })

    it("computes the outstanding balance from invoices", async () => {
      const mockPatient = makeMockPatient()
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      // 1500.0 + 750.5 = 2250.5
      expect(ctx.patient!.outstandingBalance).toBe(2250.5)
    })

    it("maps treatment plans to title + status objects", async () => {
      const mockPatient = makeMockPatient()
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.treatmentPlans).toEqual([
        { title: "Root Canal #14", status: "IN_PROGRESS" },
        { title: "Crown #14", status: "PLANNED" },
      ])
    })

    it("maps recent visits to date + type objects with ISO date strings", async () => {
      const mockPatient = makeMockPatient()
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.recentVisits).toEqual([
        { date: "2025-12-10", type: "Follow-up" },
        { date: "2025-11-20", type: "Root Canal" },
      ])
    })

    it("populates currentMedications from medicalHistory", async () => {
      const mockPatient = makeMockPatient()
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.currentMedications).toBe("Metformin 500mg, Amlodipine 5mg")
    })

    it("handles patient with zero invoices (balance = 0)", async () => {
      const mockPatient = makeMockPatient({ invoices: [] })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.outstandingBalance).toBe(0)
    })

    it("handles patient with no treatment plans", async () => {
      const mockPatient = makeMockPatient({ treatmentPlans: [] })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.treatmentPlans).toEqual([])
    })

    it("handles patient with no completed appointments", async () => {
      const mockPatient = makeMockPatient({ appointments: [] })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.recentVisits).toEqual([])
    })

    it("handles patient with null medicalHistory (no flags, no meds)", async () => {
      const mockPatient = makeMockPatient({ medicalHistory: null })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual([])
      expect(ctx.patient!.currentMedications).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. buildContext medical flags — all flag variants
  // ---------------------------------------------------------------------------

  describe("medical flags", () => {
    it("adds Allergy flag with drug allergies detail", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          hasDiabetes: false,
          hasHypertension: false,
          hasHeartDisease: false,
          hasHepatitis: false,
          hasHiv: false,
          hasEpilepsy: false,
          isPregnant: false,
          hasBleedingDisorder: false,
          drugAllergies: "Sulfa drugs",
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["Allergy: Sulfa drugs"])
    })

    it("adds Diabetes flag with type when provided", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: true,
          diabetesType: "Type 1",
          hasHypertension: false,
          hasHeartDisease: false,
          hasHepatitis: false,
          hasHiv: false,
          hasEpilepsy: false,
          isPregnant: false,
          hasBleedingDisorder: false,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["Diabetes (Type 1)"])
    })

    it("adds Diabetes flag without type when diabetesType is null", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: true,
          diabetesType: null,
          hasHypertension: false,
          hasHeartDisease: false,
          hasHepatitis: false,
          hasHiv: false,
          hasEpilepsy: false,
          isPregnant: false,
          hasBleedingDisorder: false,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["Diabetes"])
    })

    it("adds Hypertension flag", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: false,
          hasHypertension: true,
          hasHeartDisease: false,
          hasHepatitis: false,
          hasHiv: false,
          hasEpilepsy: false,
          isPregnant: false,
          hasBleedingDisorder: false,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["Hypertension"])
    })

    it("adds Heart Disease flag", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: false,
          hasHypertension: false,
          hasHeartDisease: true,
          hasHepatitis: false,
          hasHiv: false,
          hasEpilepsy: false,
          isPregnant: false,
          hasBleedingDisorder: false,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["Heart Disease"])
    })

    it("adds Hepatitis flag with type when provided", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: false,
          hasHypertension: false,
          hasHeartDisease: false,
          hasHepatitis: true,
          hepatitisType: "C",
          hasHiv: false,
          hasEpilepsy: false,
          isPregnant: false,
          hasBleedingDisorder: false,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["Hepatitis (C)"])
    })

    it("adds Hepatitis flag without type when hepatitisType is null", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: false,
          hasHypertension: false,
          hasHeartDisease: false,
          hasHepatitis: true,
          hepatitisType: null,
          hasHiv: false,
          hasEpilepsy: false,
          isPregnant: false,
          hasBleedingDisorder: false,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["Hepatitis"])
    })

    it("adds HIV+ flag", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: false,
          hasHypertension: false,
          hasHeartDisease: false,
          hasHepatitis: false,
          hasHiv: true,
          hasEpilepsy: false,
          isPregnant: false,
          hasBleedingDisorder: false,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["HIV+"])
    })

    it("adds Epilepsy flag", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: false,
          hasHypertension: false,
          hasHeartDisease: false,
          hasHepatitis: false,
          hasHiv: false,
          hasEpilepsy: true,
          isPregnant: false,
          hasBleedingDisorder: false,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["Epilepsy"])
    })

    it("adds Pregnant flag with weeks when provided", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: false,
          hasHypertension: false,
          hasHeartDisease: false,
          hasHepatitis: false,
          hasHiv: false,
          hasEpilepsy: false,
          isPregnant: true,
          pregnancyWeeks: 16,
          hasBleedingDisorder: false,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["Pregnant (16w)"])
    })

    it("adds Pregnant flag without weeks when pregnancyWeeks is null", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: false,
          hasHypertension: false,
          hasHeartDisease: false,
          hasHepatitis: false,
          hasHiv: false,
          hasEpilepsy: false,
          isPregnant: true,
          pregnancyWeeks: null,
          hasBleedingDisorder: false,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["Pregnant"])
    })

    it("adds Bleeding Disorder flag", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: false,
          hasHypertension: false,
          hasHeartDisease: false,
          hasHepatitis: false,
          hasHiv: false,
          hasEpilepsy: false,
          isPregnant: false,
          hasBleedingDisorder: true,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual(["Bleeding Disorder"])
    })

    it("accumulates ALL flags when all conditions are true", async () => {
      const mockPatient = makeMockPatient()
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      // Order matches source: allergy, diabetes, hypertension, heart, hepatitis, hiv, epilepsy, pregnant, bleeding
      expect(ctx.patient!.medicalFlags).toEqual([
        "Allergy: Penicillin",
        "Diabetes (Type 2)",
        "Hypertension",
        "Heart Disease",
        "Hepatitis (B)",
        "HIV+",
        "Epilepsy",
        "Pregnant (24w)",
        "Bleeding Disorder",
      ])
    })

    it("produces empty flags when all conditions are false", async () => {
      const mockPatient = makeMockPatient({
        medicalHistory: {
          ...MOCK_MEDICAL_HISTORY,
          drugAllergies: null,
          hasDiabetes: false,
          hasHypertension: false,
          hasHeartDisease: false,
          hasHepatitis: false,
          hasHiv: false,
          hasEpilepsy: false,
          isPregnant: false,
          hasBleedingDisorder: false,
        },
      })
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.medicalFlags).toEqual([])
    })
  })

  // ---------------------------------------------------------------------------
  // 4. buildContext with risk score
  // ---------------------------------------------------------------------------

  describe("with risk score", () => {
    it("fetches and populates riskScore when available", async () => {
      const mockPatient = makeMockPatient()
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(MOCK_RISK_SCORE as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(prisma.patientRiskScore.findFirst).toHaveBeenCalledOnce()
      expect(prisma.patientRiskScore.findFirst).toHaveBeenCalledWith({
        where: { patientId: "pat-001" },
        orderBy: { calculatedAt: "desc" },
      })
      expect(ctx.patient!.riskScore).toBe(72)
    })

    it("leaves riskScore undefined when no score exists", async () => {
      const mockPatient = makeMockPatient()
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient as never)
      vi.mocked(prisma.patientRiskScore.findFirst).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-001" })

      expect(ctx.patient!.riskScore).toBeUndefined()
    })

    it("does not query risk score when patient is not found", async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(null as never)

      await buildContext({ ...BASE_PARAMS, patientId: "pat-nonexistent" })

      expect(prisma.patientRiskScore.findFirst).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // 5. buildContext patient not found
  // ---------------------------------------------------------------------------

  describe("patient not found", () => {
    it("returns no patient in context when findUnique returns null", async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-nonexistent" })

      expect(prisma.patient.findUnique).toHaveBeenCalledOnce()
      expect(ctx.patient).toBeUndefined()
    })

    it("still returns hospital and user context when patient is not found", async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(null as never)

      const ctx = await buildContext({ ...BASE_PARAMS, patientId: "pat-nonexistent" })

      expect(ctx.hospital).toEqual({
        id: "hosp-001",
        name: "Bright Smile Dental",
        plan: "PROFESSIONAL",
      })
      expect(ctx.user).toEqual({
        id: "user-001",
        name: "Dr. Smith",
        role: "DOCTOR",
      })
    })
  })
})

// ---------------------------------------------------------------------------
// 6. serializeContext without patient
// ---------------------------------------------------------------------------

describe("serializeContext", () => {
  describe("without patient", () => {
    it("outputs hospital and user info only", () => {
      const ctx: AIContext = {
        hospital: { id: "hosp-001", name: "Bright Smile Dental", plan: "PROFESSIONAL" },
        user: { id: "user-001", name: "Dr. Smith", role: "DOCTOR" },
      }

      const result = serializeContext(ctx)

      expect(result).toContain("Hospital: Bright Smile Dental (Plan: PROFESSIONAL)")
      expect(result).toContain("Logged-in user: Dr. Smith (Role: DOCTOR)")
      expect(result).not.toContain("Patient:")
    })

    it("does not include patient or current page sections", () => {
      const ctx: AIContext = {
        hospital: { id: "hosp-001", name: "Test Clinic", plan: "BASIC" },
        user: { id: "user-002", name: "Admin", role: "ADMIN" },
      }

      const result = serializeContext(ctx)
      const lines = result.split("\n")

      expect(lines).toHaveLength(2)
      expect(lines[0]).toBe("Hospital: Test Clinic (Plan: BASIC)")
      expect(lines[1]).toBe("Logged-in user: Admin (Role: ADMIN)")
    })
  })

  // ---------------------------------------------------------------------------
  // 7. serializeContext with patient
  // ---------------------------------------------------------------------------

  describe("with patient", () => {
    const fullCtx: AIContext = {
      hospital: { id: "hosp-001", name: "Bright Smile Dental", plan: "PROFESSIONAL" },
      user: { id: "user-001", name: "Dr. Smith", role: "DOCTOR" },
      patient: {
        id: "pat-001",
        patientId: "PAT-2025-001",
        name: "Ramesh Kumar",
        age: 45,
        gender: "Male",
        medicalFlags: ["Diabetes (Type 2)", "Hypertension"],
        currentMedications: "Metformin 500mg",
        outstandingBalance: 2250.5,
        treatmentPlans: [
          { title: "Root Canal #14", status: "IN_PROGRESS" },
          { title: "Crown #14", status: "PLANNED" },
        ],
        recentVisits: [
          { date: "2025-12-10", type: "Follow-up" },
        ],
        riskScore: 72,
      },
    }

    it("includes patient name and ID", () => {
      const result = serializeContext(fullCtx)

      expect(result).toContain("Patient: Ramesh Kumar | ID: PAT-2025-001")
    })

    it("includes age and gender", () => {
      const result = serializeContext(fullCtx)

      expect(result).toContain("Age: 45, Gender: Male")
    })

    it("includes medical flags", () => {
      const result = serializeContext(fullCtx)

      expect(result).toContain("Medical flags: Diabetes (Type 2), Hypertension")
    })

    it("includes current medications", () => {
      const result = serializeContext(fullCtx)

      expect(result).toContain("Current medications: Metformin 500mg")
    })

    it("includes outstanding balance with rupee formatting", () => {
      const result = serializeContext(fullCtx)

      expect(result).toMatch(/Outstanding balance: ₹[\d,]+/)
    })

    it("includes risk score out of 100", () => {
      const result = serializeContext(fullCtx)

      expect(result).toContain("Risk score: 72/100")
    })

    it("includes treatment plans with statuses", () => {
      const result = serializeContext(fullCtx)

      expect(result).toContain("Treatment plans: Root Canal #14 (IN_PROGRESS), Crown #14 (PLANNED)")
    })

    it("omits age line when age is null", () => {
      const ctx: AIContext = {
        ...fullCtx,
        patient: { ...fullCtx.patient!, age: null },
      }

      const result = serializeContext(ctx)

      expect(result).not.toContain("Age:")
    })

    it("omits medical flags line when flags array is empty", () => {
      const ctx: AIContext = {
        ...fullCtx,
        patient: { ...fullCtx.patient!, medicalFlags: [] },
      }

      const result = serializeContext(ctx)

      expect(result).not.toContain("Medical flags:")
    })

    it("omits current medications line when null", () => {
      const ctx: AIContext = {
        ...fullCtx,
        patient: { ...fullCtx.patient!, currentMedications: null },
      }

      const result = serializeContext(ctx)

      expect(result).not.toContain("Current medications:")
    })

    it("omits outstanding balance line when balance is 0", () => {
      const ctx: AIContext = {
        ...fullCtx,
        patient: { ...fullCtx.patient!, outstandingBalance: 0 },
      }

      const result = serializeContext(ctx)

      expect(result).not.toContain("Outstanding balance:")
    })

    it("omits risk score line when riskScore is undefined", () => {
      const ctx: AIContext = {
        ...fullCtx,
        patient: { ...fullCtx.patient!, riskScore: undefined },
      }

      const result = serializeContext(ctx)

      expect(result).not.toContain("Risk score:")
    })

    it("omits treatment plans line when plans array is empty", () => {
      const ctx: AIContext = {
        ...fullCtx,
        patient: { ...fullCtx.patient!, treatmentPlans: [] },
      }

      const result = serializeContext(ctx)

      expect(result).not.toContain("Treatment plans:")
    })

    it("shows 'N/A' for gender when gender is null", () => {
      const ctx: AIContext = {
        ...fullCtx,
        patient: { ...fullCtx.patient!, gender: null },
      }

      const result = serializeContext(ctx)

      expect(result).toContain("Age: 45, Gender: N/A")
    })
  })

  // ---------------------------------------------------------------------------
  // 8. serializeContext with currentPage
  // ---------------------------------------------------------------------------

  describe("with currentPage", () => {
    it("includes page line when currentPage is set", () => {
      const ctx: AIContext = {
        hospital: { id: "hosp-001", name: "Bright Smile Dental", plan: "PROFESSIONAL" },
        user: { id: "user-001", name: "Dr. Smith", role: "DOCTOR" },
        currentPage: "/patients/pat-001",
      }

      const result = serializeContext(ctx)

      expect(result).toContain("Current page: /patients/pat-001")
    })

    it("includes page line after patient section when both are present", () => {
      const ctx: AIContext = {
        hospital: { id: "hosp-001", name: "Bright Smile Dental", plan: "PROFESSIONAL" },
        user: { id: "user-001", name: "Dr. Smith", role: "DOCTOR" },
        patient: {
          id: "pat-001",
          patientId: "PAT-2025-001",
          name: "Ramesh Kumar",
          age: 45,
          gender: "Male",
          medicalFlags: [],
          outstandingBalance: 0,
          treatmentPlans: [],
          recentVisits: [],
        },
        currentPage: "/treatments/new",
      }

      const result = serializeContext(ctx)
      const lines = result.split("\n")

      // Current page should be the last non-empty content
      const lastNonEmpty = lines.filter((l) => l.trim().length > 0).pop()
      expect(lastNonEmpty).toBe("Current page: /treatments/new")
    })

    it("omits page line when currentPage is undefined", () => {
      const ctx: AIContext = {
        hospital: { id: "hosp-001", name: "Bright Smile Dental", plan: "PROFESSIONAL" },
        user: { id: "user-001", name: "Dr. Smith", role: "DOCTOR" },
      }

      const result = serializeContext(ctx)

      expect(result).not.toContain("Current page:")
    })
  })
})
