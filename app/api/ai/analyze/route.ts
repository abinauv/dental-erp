import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

/**
 * POST /api/ai/analyze
 *
 * Supported analysis types:
 *   risk_score  – calculate patient risk from medical history
 *   data        – generic text/data analysis
 *
 * Body: { type, patientId?, data? }
 */
export async function POST(req: Request) {
  const { error, user, hospitalId } = await requireAuthAndRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
  if (error || !user || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { type: string; patientId?: string; data?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { type, patientId, data } = body

  if (type === "risk_score") {
    if (!patientId) return NextResponse.json({ error: "patientId is required for risk_score" }, { status: 400 })

    const patient = await prisma.patient.findUnique({
      where: { id: patientId, hospitalId },
      include: { medicalHistory: true },
    })
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    if (!patient.medicalHistory) {
      return NextResponse.json({ error: "No medical history on file for this patient" }, { status: 400 })
    }

    const h = patient.medicalHistory
    const historyText = [
      h.drugAllergies && `Drug allergies: ${h.drugAllergies}`,
      h.hasDiabetes && `Diabetes${h.diabetesType ? ` (${h.diabetesType})` : ""}`,
      h.hasHypertension && "Hypertension",
      h.hasHeartDisease && `Heart disease${h.heartCondition ? `: ${h.heartCondition}` : ""}`,
      h.hasHepatitis && `Hepatitis${h.hepatitisType ? ` (${h.hepatitisType})` : ""}`,
      h.hasHiv && "HIV+",
      h.hasEpilepsy && "Epilepsy",
      h.isPregnant && `Pregnant${h.pregnancyWeeks ? ` (${h.pregnancyWeeks} weeks)` : ""}`,
      h.hasBleedingDisorder && "Bleeding disorder",
      h.smokingStatus !== "NEVER" && `Smoking: ${h.smokingStatus}`,
      h.alcoholConsumption !== "NEVER" && `Alcohol: ${h.alcoholConsumption}`,
      h.currentMedications && `Current medications: ${h.currentMedications}`,
      h.otherConditions && `Other: ${h.otherConditions}`,
    ]
      .filter(Boolean)
      .join("\n")

    const prompt = `You are a dental risk-scoring system. Based on the patient's medical history, calculate a risk score from 0–100 and list specific contraindications for dental treatment.

SCORING GUIDE:
- Drug allergies: +15
- Diabetes (uncontrolled +20, controlled +10)
- Hypertension: +10
- Heart disease: +15
- Hepatitis: +10
- HIV+: +10
- Epilepsy: +15
- Pregnancy: +20 (X-ray contraindication)
- Bleeding disorder: +20
- Heavy smoking/alcohol: +10 each

PATIENT MEDICAL HISTORY:
${historyText || "(none on file)"}

Respond ONLY with JSON:
{
  "overallScore": <0-100>,
  "factors": [{ "factor": "<name>", "score": <points>, "explanation": "<why>" }],
  "contraindications": ["<description>", ...],
  "recommendation": "<one-line summary>"
}`

    const startTime = Date.now()
    let result: any
    try {
      const { content, usage } = await complete(
        [{ role: "system", content: prompt }],
        getModelByTier("clinical") // clinical model for medical reasoning
      )
      result = JSON.parse(extractJSON(content))

      // Persist risk score
      await prisma.patientRiskScore.create({
        data: {
          patientId: patient.id,
          hospitalId,
          overallScore: result.overallScore || 0,
          factors: result.factors || [],
          contraindications: result.contraindications || [],
        },
      })

      // Log execution
      await prisma.aISkillExecution.create({
        data: {
          hospitalId,
          userId: user.id,
          skill: "risk_score",
          input: { patientId } as any,
          output: result as any,
          status: "COMPLETED",
          duration: Date.now() - startTime,
          tokensUsed: usage.totalTokens,
        },
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Analysis failed" },
        { status: 502 }
      )
    }

    return NextResponse.json(result)
  }

  // Generic data analysis
  if (type === "data") {
    if (!data) return NextResponse.json({ error: "data field is required" }, { status: 400 })

    try {
      const { content } = await complete(
        [
          { role: "system", content: "You are an analytical assistant for a dental clinic. Analyse the provided data and return actionable insights." },
          { role: "user", content: data },
        ],
        getModelByTier("insights")
      )
      return NextResponse.json({ analysis: content })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Analysis error" }, { status: 502 })
    }
  }

  return NextResponse.json({ error: `Unsupported analysis type: ${type}` }, { status: 400 })
}
