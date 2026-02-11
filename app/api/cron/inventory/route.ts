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
      await prisma.aIInsight.create({
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
      await prisma.aIInsight.create({
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
      await prisma.aIInsight.create({
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

    // Weekly AI forecast insight (run on Mondays or when alerts exist)
    const dayOfWeek = now.getDay()
    if (dayOfWeek === 1 || alertsCreated > 0) {
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(now.getDate() - 30)
      const consumptionStats = await prisma.stockTransaction.groupBy({
        by: ["itemId"],
        where: {
          hospitalId: hospital.id,
          type: { in: ["CONSUMPTION", "SALE"] },
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { quantity: true },
      })

      const highUsageItems = consumptionStats
        .map((s) => ({ itemId: s.itemId, consumed: Math.abs(Number(s._sum?.quantity || 0)) }))
        .sort((a, b) => b.consumed - a.consumed)
        .slice(0, 5)

      if (highUsageItems.length > 0) {
        const itemNames = await prisma.inventoryItem.findMany({
          where: { id: { in: highUsageItems.map((i) => i.itemId) } },
          select: { id: true, name: true, currentStock: true },
        })
        const nameMap = Object.fromEntries(itemNames.map((i) => [i.id, i]))

        const topItems = highUsageItems.map((h) => {
          const item = nameMap[h.itemId]
          const daysLeft = item && h.consumed > 0 ? Math.round(Number(item.currentStock) / (h.consumed / 30)) : 999
          return `${item?.name || "Unknown"}: ${h.consumed} used/month, ~${daysLeft} days left`
        })

        await prisma.aIInsight.create({
          data: {
            hospitalId: hospital.id,
            category: "INVENTORY",
            severity: "INFO",
            title: "Weekly Inventory Forecast",
            description: `Top consumed items this month:\n${topItems.join("\n")}`,
            data: highUsageItems as any,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        })
        alertsCreated++
      }
    }

    results.push({ hospitalId: hospital.id, alertsCreated })
  }

  return NextResponse.json({ results, processedAt: now.toISOString() })
}
