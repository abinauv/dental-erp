import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { AI_MODELS } from "@/lib/ai/models"
import { ENTITY_SCHEMAS } from "@/lib/import/schema-definitions"

export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { jobId } = await req.json()
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 })

    // Load the import job
    const job = await prisma.dataImportJob.findFirst({
      where: { id: jobId, hospitalId },
    })
    if (!job) return NextResponse.json({ error: "Import job not found" }, { status: 404 })

    const schema = ENTITY_SCHEMAS[job.entityType]
    if (!schema) return NextResponse.json({ error: "Invalid entity type" }, { status: 400 })

    const sourceColumns = job.sourceColumns as string[]
    const sampleData = (job.previewData as Record<string, string>[])?.slice(0, 3) || []

    // Build target field definitions for the AI
    const targetFields = schema.fields.map((f) => ({
      name: f.name,
      type: f.type,
      required: f.required,
      description: f.description,
      ...(f.enumValues ? { validValues: f.enumValues } : {}),
    }))

    const systemPrompt = `You are a data mapping assistant for a dental clinic management system.
Your task is to map source spreadsheet columns to target database fields.

Rules:
- Match columns based on semantic meaning, not just exact name matches
- Consider common aliases (e.g., "DOB" = "dateOfBirth", "Mobile" = "phone", "Name" = could be "firstName" or combined full name)
- If a source column contains full names (e.g., "Patient Name", "Name"), map it to "firstName" and note that splitting is needed
- If no reasonable match exists for a source column, set targetField to null
- For each mapping, provide a confidence score from 0.0 to 1.0
- Respond ONLY with valid JSON, no explanation text

Output format:
{
  "mappings": {
    "<sourceColumn>": {
      "targetField": "<targetFieldName>" | null,
      "confidence": <0.0-1.0>,
      "notes": "<optional note about transformation needed>"
    }
  },
  "splitFields": [
    {
      "sourceColumn": "<column that needs splitting>",
      "targetFields": ["firstName", "lastName"],
      "splitStrategy": "space"
    }
  ]
}`

    const userPrompt = `Source columns from uploaded ${schema.label} file:
${JSON.stringify(sourceColumns)}

Sample data (first 3 rows):
${JSON.stringify(sampleData, null, 2)}

Target fields for "${schema.label}":
${JSON.stringify(targetFields, null, 2)}

Map each source column to the most appropriate target field.`

    // Call AI with Flash Lite (cheapest tier)
    let aiResult
    try {
      aiResult = await complete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { ...AI_MODELS.fast, maxTokens: 4096, temperature: 0.1 }
      )
    } catch (aiErr: any) {
      console.error("AI mapping error:", aiErr)
      // Fallback: return empty mapping so user can map manually
      const emptyMapping: Record<string, string | null> = {}
      const emptyConfidence: Record<string, number> = {}
      sourceColumns.forEach((col) => {
        emptyMapping[col] = null
        emptyConfidence[col] = 0
      })

      return NextResponse.json({
        mapping: emptyMapping,
        confidence: emptyConfidence,
        unmappedRequired: schema.fields.filter((f) => f.required).map((f) => f.name),
        splitFields: [],
        aiError: "AI mapping unavailable. Please map columns manually.",
      })
    }

    // Parse AI response
    let parsed: any
    try {
      const jsonStr = extractJSON(aiResult.content)
      parsed = JSON.parse(jsonStr)
    } catch {
      // Try parsing the raw content
      try {
        parsed = JSON.parse(aiResult.content)
      } catch {
        // Return empty mapping on parse failure
        const emptyMapping: Record<string, string | null> = {}
        sourceColumns.forEach((col) => { emptyMapping[col] = null })
        return NextResponse.json({
          mapping: emptyMapping,
          confidence: {},
          unmappedRequired: schema.fields.filter((f) => f.required).map((f) => f.name),
          splitFields: [],
          aiError: "Could not parse AI response. Please map columns manually.",
        })
      }
    }

    // Extract mapping and confidence
    const mapping: Record<string, string | null> = {}
    const confidence: Record<string, number> = {}
    const validFieldNames = new Set(schema.fields.map((f) => f.name))

    for (const col of sourceColumns) {
      const m = parsed.mappings?.[col]
      if (m && m.targetField && validFieldNames.has(m.targetField)) {
        mapping[col] = m.targetField
        confidence[col] = m.confidence ?? 0.5
      } else {
        mapping[col] = null
        confidence[col] = 0
      }
    }

    // Find unmapped required fields
    const mappedTargets = new Set(Object.values(mapping).filter(Boolean))
    const unmappedRequired = schema.fields
      .filter((f) => f.required && !mappedTargets.has(f.name))
      .map((f) => f.name)

    // Update the job
    await prisma.dataImportJob.update({
      where: { id: jobId },
      data: { columnMapping: mapping, status: "MAPPED" },
    })

    return NextResponse.json({
      mapping,
      confidence,
      unmappedRequired,
      splitFields: parsed.splitFields || [],
    })
  } catch (err: any) {
    console.error("AI mapping route error:", err)
    return NextResponse.json({ error: err.message || "Mapping failed" }, { status: 500 })
  }
}
