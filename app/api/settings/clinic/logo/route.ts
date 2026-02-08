import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir, unlink, readdir } from "fs/promises"
import path from "path"

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

// POST — upload / replace hospital logo
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, GIF and SVG images are allowed" },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 2 MB limit" },
        { status: 400 }
      )
    }

    // Ensure directory exists
    const dir = path.join(process.cwd(), "uploads", hospitalId)
    await mkdir(dir, { recursive: true })

    // Remove any previous logo file (logo.*)
    try {
      const files = await readdir(dir)
      for (const f of files) {
        if (f.startsWith("logo.")) {
          await unlink(path.join(dir, f))
        }
      }
    } catch {
      // directory may not exist yet — that's fine
    }

    // Write new logo
    const ext = path.extname(file.name) || mimeToExt(file.type)
    const fileName = `logo${ext}`
    const filePath = path.join(dir, fileName)
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const logoPath = `/api/uploads/${hospitalId}/${fileName}`

    // Persist in DB
    await prisma.hospital.update({
      where: { id: hospitalId },
      data: { logo: logoPath },
    })

    return NextResponse.json({ success: true, logo: logoPath })
  } catch (err: any) {
    console.error("Logo upload error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to upload logo" },
      { status: 500 }
    )
  }
}

// DELETE — remove hospital logo
export async function DELETE() {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Remove logo files from disk
    const dir = path.join(process.cwd(), "uploads", hospitalId)
    try {
      const files = await readdir(dir)
      for (const f of files) {
        if (f.startsWith("logo.")) {
          await unlink(path.join(dir, f))
        }
      }
    } catch {
      // no files to delete
    }

    // Clear in DB
    await prisma.hospital.update({
      where: { id: hospitalId },
      data: { logo: null },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Logo delete error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to delete logo" },
      { status: 500 }
    )
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
  }
  return map[mime] || ".png"
}
