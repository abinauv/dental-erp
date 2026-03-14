import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { z } from "zod"

const fieldSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "textarea", "number", "date", "select", "checkbox", "radio", "signature", "file", "heading", "paragraph"]),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
  description: z.string().optional(),
  defaultValue: z.string().optional(),
})

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["MEDICAL_HISTORY", "CONSENT", "INTAKE", "FEEDBACK", "CUSTOM"]),
  fields: z.array(fieldSchema).min(1),
  isActive: z.boolean().optional(),
})

// GET: List form templates
export async function GET() {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const templates = await prisma.formTemplate.findMany({
      where: { hospitalId },
      include: {
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ templates })
  } catch (err) {
    console.error("List form templates error:", err)
    return NextResponse.json({ error: "Failed to list templates" }, { status: 500 })
  }
}

// POST: Create form template
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = createTemplateSchema.parse(body)

    const template = await prisma.formTemplate.create({
      data: {
        hospitalId,
        name: data.name,
        description: data.description,
        type: data.type,
        fields: data.fields as any,
        isActive: data.isActive ?? true,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid form data", details: err.errors }, { status: 400 })
    }
    console.error("Create form template error:", err)
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 })
  }
}
