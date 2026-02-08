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

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(["MEDICAL_HISTORY", "CONSENT", "INTAKE", "FEEDBACK", "CUSTOM"]).optional(),
  fields: z.array(fieldSchema).min(1).optional(),
  isActive: z.boolean().optional(),
})

// GET: Single template
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const template = await prisma.formTemplate.findFirst({
      where: { id, hospitalId },
      include: {
        submissions: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            patientId: true,
            appointmentId: true,
            status: true,
            createdAt: true,
            signedAt: true,
          },
        },
        _count: { select: { submissions: true } },
      },
    })

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (err) {
    console.error("Get form template error:", err)
    return NextResponse.json({ error: "Failed to get template" }, { status: 500 })
  }
}

// PUT: Update template
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const existing = await prisma.formTemplate.findFirst({
      where: { id, hospitalId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const body = await req.json()
    const data = updateTemplateSchema.parse(body)

    const template = await prisma.formTemplate.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type && { type: data.type }),
        ...(data.fields && { fields: data.fields as any }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })

    return NextResponse.json({ template })
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid form data", details: err.errors }, { status: 400 })
    }
    console.error("Update form template error:", err)
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
  }
}

// DELETE: Delete template
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const existing = await prisma.formTemplate.findFirst({
      where: { id, hospitalId },
      include: { _count: { select: { submissions: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    if (existing._count.submissions > 0) {
      // Soft-delete by deactivating
      await prisma.formTemplate.update({
        where: { id },
        data: { isActive: false },
      })
      return NextResponse.json({ message: "Template deactivated (has submissions)" })
    }

    await prisma.formTemplate.delete({ where: { id } })
    return NextResponse.json({ message: "Template deleted" })
  } catch (err) {
    console.error("Delete form template error:", err)
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
  }
}
