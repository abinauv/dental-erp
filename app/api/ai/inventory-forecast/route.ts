import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

/**
 * GET /api/ai/inventory-forecast
 * Returns AI-generated demand forecast and reorder suggestions.
 */
export async function GET(req: Request) {
  try {
    const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "RECEPTIONIST"])
    if (error || !hospitalId) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Current stock levels
    const items = await prisma.inventoryItem.findMany({
      where: { hospitalId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        reorderLevel: true,
        unit: true,
        purchasePrice: true,
      },
      orderBy: { name: "asc" },
    })

    if (items.length === 0) {
      return NextResponse.json({ forecasts: [], summary: { criticalItems: 0, reorderItems: 0, excessItems: 0, totalReorderValue: 0 } })
    }

    // Consumption data: stock transactions over last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const transactions = await prisma.stockTransaction.findMany({
      where: {
        hospitalId,
        type: { in: ["CONSUMPTION", "SALE", "ADJUSTMENT_OUT"] },
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        itemId: true,
        quantity: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    })

    // Aggregate consumption per item per month
    const consumptionMap: Record<string, { total: number; months: Record<string, number> }> = {}
    for (const tx of transactions) {
      if (!consumptionMap[tx.itemId]) {
        consumptionMap[tx.itemId] = { total: 0, months: {} }
      }
      const qty = Math.abs(Number(tx.quantity))
      consumptionMap[tx.itemId].total += qty
      const monthKey = `${tx.createdAt.getFullYear()}-${String(tx.createdAt.getMonth() + 1).padStart(2, "0")}`
      consumptionMap[tx.itemId].months[monthKey] = (consumptionMap[tx.itemId].months[monthKey] || 0) + qty
    }

    // Build context for AI
    const contextData = items.map((item) => {
      const consumption = consumptionMap[item.id]
      const monthlyBreakdown = consumption?.months || {}
      const totalConsumed = consumption?.total || 0
      const monthCount = Object.keys(monthlyBreakdown).length || 1
      const avgMonthly = Math.round(totalConsumed / monthCount)
      const avgDaily = +(totalConsumed / (monthCount * 30)).toFixed(1)

      return {
        itemId: item.id,
        itemName: item.name,
        itemCode: item.sku,
        currentStock: Number(item.currentStock),
        minimumStock: Number(item.minimumStock),
        reorderLevel: Number(item.reorderLevel),
        unit: item.unit,
        unitPrice: Number(item.purchasePrice),
        totalConsumed6Months: totalConsumed,
        avgMonthlyUsage: avgMonthly,
        avgDailyUsage: avgDaily,
        monthlyBreakdown,
      }
    })

    const model = getModelByTier("insights")
    const response = await complete(
      [
        {
          role: "system",
          content: `You are an inventory demand forecasting AI for a dental clinic. Analyze consumption data and return forecasts as JSON.
Return format: { "forecasts": [...], "summary": { criticalItems, reorderItems, excessItems, totalReorderValue } }
For each item: { itemId, itemName, currentStock, avgDailyUsage, trend (INCREASING/STABLE/DECREASING), projected30Days, projected60Days, projected90Days, daysUntilStockout, reorderRecommended, suggestedOrderQty, urgency (CRITICAL/SOON/NORMAL/EXCESS), notes }.
CRITICAL: stockout <=7d, SOON: <=14d, NORMAL: <=30d, EXCESS: >90d stock.
suggestedOrderQty covers 60 days. Return ONLY valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Forecast demand for these inventory items:\n${JSON.stringify(contextData, null, 2)}`,
        },
      ],
      { ...model, maxTokens: 8192 }
    )

    let result: any
    try {
      const raw = extractJSON(response.content)
      result = JSON.parse(raw)
    } catch {
      // Fallback: compute simple forecast without AI
      const forecasts = contextData.map((item) => {
        const daysUntilStockout = item.avgDailyUsage > 0
          ? Math.round(item.currentStock / item.avgDailyUsage)
          : 999
        const urgency = daysUntilStockout <= 7 ? "CRITICAL"
          : daysUntilStockout <= 14 ? "SOON"
          : daysUntilStockout <= 30 ? "NORMAL"
          : "EXCESS"
        const reorderRecommended = daysUntilStockout <= 30
        const suggestedOrderQty = reorderRecommended ? Math.ceil(item.avgDailyUsage * 60) : 0
        return {
          itemId: item.itemId,
          itemName: item.itemName,
          currentStock: item.currentStock,
          avgDailyUsage: item.avgDailyUsage,
          trend: "STABLE",
          projected30Days: Math.round(item.avgDailyUsage * 30),
          projected60Days: Math.round(item.avgDailyUsage * 60),
          projected90Days: Math.round(item.avgDailyUsage * 90),
          daysUntilStockout,
          reorderRecommended,
          suggestedOrderQty,
          urgency,
          notes: "",
        }
      })
      result = {
        forecasts,
        summary: {
          criticalItems: forecasts.filter((f) => f.urgency === "CRITICAL").length,
          reorderItems: forecasts.filter((f) => f.reorderRecommended).length,
          excessItems: forecasts.filter((f) => f.urgency === "EXCESS").length,
          totalReorderValue: forecasts.reduce((sum, f) => sum + f.suggestedOrderQty * (contextData.find((i) => i.itemId === f.itemId)?.unitPrice || 0), 0),
        },
      }
    }

    return NextResponse.json({ ...result, model: response.model })
  } catch (error: any) {
    console.error("Inventory forecast error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate forecast" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 }
    )
  }
}
