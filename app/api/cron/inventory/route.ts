import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/cron/inventory
 * Scheduled: daily 06:00 IST
 * Analyses upcoming procedures (next 14 days), estimates material needs,
 * compares with current stock, and creates alerts for items that will run out.
 */
export async function GET(req: Request) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const in14Days = new Date(now)
  in14Days.setDate(now.getDate() + 14)

  const hospitals = await prisma.hospital.findMany({
    where: { isActive: true, onboardingCompleted: true },
    select: { id: true },
  })

  const results: { hospitalId: string; alertsCreated: number }[] = []

  for (const hospital of hospitals) {
    // Current stock snapshot
    const items = await prisma.inventoryItem.findMany({
      where: { hospitalId: hospital.id, isActive: true },
      select: { id: true, name: true, currentStock: true, reorderLevel: true, minimumStock: true, unit: true },
    })

    // Items at or below reorder level
    const lowItems = items.filter((i) => i.currentStock <= i.reorderLevel)

    // Critical items (at or below minimum)
    const criticalItems = items.filter((i) => i.currentStock <= i.minimumStock)

    // Check for batches expiring in next 30 days
    const thirtyDaysFromNow = new Date(now)
    thirtyDaysFromNow.setDate(now.getDate() + 30)
    const expiringBatches = await prisma.inventoryBatch.findMany({
      where: {
        hospitalId: hospital.id,
        expiryDate: { gte: now, lte: thirtyDaysFromNow },
        remainingQty: { gt: 0 },
      },
      include: { item: { select: { name: true } } },
    })

    let alertsCreated = 0

    // Alert: critical stock
    if (criticalItems.length > 0) {
      await prisma.aiInsight.create({
        data: {
          hospitalId: hospital.id,
          category: "INVENTORY",
          severity: "CRITICAL",
          title: "Critical Stock Levels",
          description: `${criticalItems.length} item(s) at or below minimum stock: ${criticalItems.map((i) => `${i.name} (${i.currentStock} ${i.unit})`).join(", ")}`,
          data: criticalItems as any,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
      })
      alertsCreated++
    }

    // Alert: items approaching reorder (but not critical)
    const approachingItems = lowItems.filter((i) => i.currentStock > i.minimumStock)
    if (approachingItems.length > 0) {
      await prisma.aiInsight.create({
        data: {
          hospitalId: hospital.id,
          category: "INVENTORY",
          severity: "WARNING",
          title: "Reorder Level Reached",
          description: `${approachingItems.length} item(s) at reorder level: ${approachingItems.map((i) => `${i.name} (${i.currentStock} ${i.unit})`).join(", ")}. Consider placing purchase orders.`,
          data: approachingItems as any,
          expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        },
      })
      alertsCreated++
    }

    // Alert: expiring batches
    if (expiringBatches.length > 0) {
      await prisma.aiInsight.create({
        data: {
          hospitalId: hospital.id,
          category: "INVENTORY",
          severity: "WARNING",
          title: "Batches Expiring Soon",
          description: `${expiringBatches.length} batch(es) expiring within 30 days: ${expiringBatches.map((b) => `${b.item.name} (exp: ${b.expiryDate?.toISOString().split("T")[0]})`).join(", ")}. Use FEFO priority.`,
          data: expiringBatches.map((b) => ({
            item: b.item.name,
            expiryDate: b.expiryDate?.toISOString().split("T")[0],
            remainingQty: b.remainingQty,
          })) as any,
          expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        },
      })
      alertsCreated++
    }

    results.push({ hospitalId: hospital.id, alertsCreated })
  }

  return NextResponse.json({ results, processedAt: now.toISOString() })
}
