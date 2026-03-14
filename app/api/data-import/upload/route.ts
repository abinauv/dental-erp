import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { parseFile } from "@/lib/import/parsers"
import { ENTITY_SCHEMAS } from "@/lib/import/schema-definitions"

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_EXTENSIONS = ["csv", "xlsx", "xls", "pdf"]
const PREVIEW_ROWS = 100

export async function POST(req: NextRequest) {
  const { error, session, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const entityType = formData.get("entityType") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (!entityType || !ENTITY_SCHEMAS[entityType]) {
      return NextResponse.json(
        { error: `Invalid entity type. Must be one of: ${Object.keys(ENTITY_SCHEMAS).join(", ")}` },
        { status: 400 }
      )
    }

    // Validate file extension
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type ".${ext}". Accepted: .csv, .xlsx, .xls, .pdf` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 20MB limit" }, { status: 400 })
    }

    // Save file to disk
    const fileId = crypto.randomUUID()
    const dir = path.join(process.cwd(), "uploads", hospitalId, "imports")
    await mkdir(dir, { recursive: true })
    const fileName = `${fileId}.${ext}`
    const filePath = path.join(dir, fileName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    // Parse the file
    let parsed
    try {
      parsed = await parseFile(buffer, ext)
    } catch (parseErr: any) {
      return NextResponse.json({ error: parseErr.message }, { status: 400 })
    }

    if (parsed.columns.length === 0) {
      return NextResponse.json({ error: "No column headers detected in the file" }, { status: 400 })
    }
    if (parsed.totalRows === 0) {
      return NextResponse.json({ error: "File contains no data rows" }, { status: 400 })
    }

    // Create import job record
    const job = await prisma.dataImportJob.create({
      data: {
        hospitalId,
        userId: session!.user.id,
        fileName: file.name,
        fileType: ext,
        filePath: `uploads/${hospitalId}/imports/${fileName}`,
        entityType,
        status: "UPLOADED",
        sourceColumns: parsed.columns,
        previewData: parsed.rows.slice(0, PREVIEW_ROWS),
        totalRows: parsed.totalRows,
      },
    })

    return NextResponse.json({
      jobId: job.id,
      columns: parsed.columns,
      sampleData: parsed.rows.slice(0, 5),
      totalRows: parsed.totalRows,
    })
  } catch (err: any) {
    console.error("Data import upload error:", err)
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 })
  }
}
