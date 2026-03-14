import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/communications/feedback/analytics
 * Aggregated survey/feedback analytics: NPS trend, satisfaction breakdown,
 * word frequencies from open-text responses, response rates.
 * Query params: ?period=7d|30d|90d|all
 */
export async function GET(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error) return error

  const { searchParams } = new URL(req.url)
  const period = searchParams.get("period") || "30d"

  const now = new Date()
  let since: Date | null = null
  if (period === "7d") since = new Date(now.getTime() - 7 * 86400000)
  else if (period === "30d") since = new Date(now.getTime() - 30 * 86400000)
  else if (period === "90d") since = new Date(now.getTime() - 90 * 86400000)

  const dateFilter = since ? { gte: since } : undefined

  // Get all surveys for this hospital
  const surveys = await prisma.survey.findMany({
    where: { hospitalId: hospitalId! },
    select: { id: true, title: true, surveyType: true },
  })
  const surveyIds = surveys.map((s) => s.id)

  if (surveyIds.length === 0) {
    return NextResponse.json({
      period,
      totalSurveys: 0,
      totalResponses: 0,
      responseRate: 0,
      avgRating: 0,
      nps: { score: 0, promoters: 0, passives: 0, detractors: 0, trend: [] },
      satisfaction: { byDoctor: [], byProcedure: [], byMonth: [] },
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
      wordFrequencies: [],
    })
  }

  // Fetch all responses in the period
  const responses = await prisma.surveyResponse.findMany({
    where: {
      surveyId: { in: surveyIds },
      createdAt: dateFilter,
      isComplete: true,
    },
    select: {
      id: true,
      surveyId: true,
      patientId: true,
      answers: true,
      rating: true,
      sentiment: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const totalResponses = responses.length
  const ratedResponses = responses.filter((r) => r.rating !== null)
  const avgRating =
    ratedResponses.length > 0
      ? Math.round(
          (ratedResponses.reduce((sum, r) => sum + (r.rating || 0), 0) / ratedResponses.length) * 10
        ) / 10
      : 0

  // NPS calculation (for NPS-type surveys, scale 0-10 mapped from 1-5: 1-2=detractor, 3=passive, 4-5=promoter)
  const promoters = ratedResponses.filter((r) => (r.rating || 0) >= 4).length
  const passives = ratedResponses.filter((r) => r.rating === 3).length
  const detractors = ratedResponses.filter((r) => (r.rating || 0) <= 2).length
  const npsScore =
    ratedResponses.length > 0
      ? Math.round(((promoters - detractors) / ratedResponses.length) * 100)
      : 0

  // NPS trend by month
  const npsByMonth: Record<string, { promoters: number; detractors: number; total: number }> = {}
  for (const r of ratedResponses) {
    const monthKey = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, "0")}`
    if (!npsByMonth[monthKey]) npsByMonth[monthKey] = { promoters: 0, detractors: 0, total: 0 }
    npsByMonth[monthKey].total++
    if ((r.rating || 0) >= 4) npsByMonth[monthKey].promoters++
    if ((r.rating || 0) <= 2) npsByMonth[monthKey].detractors++
  }
  const npsTrend = Object.entries(npsByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      score: data.total > 0 ? Math.round(((data.promoters - data.detractors) / data.total) * 100) : 0,
      responses: data.total,
    }))

  // Sentiment breakdown
  const sentimentBreakdown = {
    positive: responses.filter((r) => r.sentiment === "positive").length,
    neutral: responses.filter((r) => r.sentiment === "neutral").length,
    negative: responses.filter((r) => r.sentiment === "negative").length,
  }

  // Satisfaction by doctor — join through patientId → appointments → doctor
  const patientIds = [...new Set(responses.filter((r) => r.patientId).map((r) => r.patientId!))]
  let byDoctor: Array<{ doctorName: string; avgRating: number; count: number }> = []
  let byProcedure: Array<{ procedureName: string; avgRating: number; count: number }> = []

  if (patientIds.length > 0) {
    // Get recent appointments for these patients to link feedback to doctors
    const recentAppointments = await prisma.appointment.findMany({
      where: {
        hospitalId: hospitalId!,
        patientId: { in: patientIds },
        status: "COMPLETED",
        scheduledDate: dateFilter,
      },
      select: {
        patientId: true,
        doctor: { select: { firstName: true, lastName: true } },
      },
    })

    // Map patients to their most recent doctor
    const patientDoctorMap: Record<string, string> = {}
    for (const appt of recentAppointments) {
      patientDoctorMap[appt.patientId] = `Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}`
    }

    // Aggregate ratings by doctor
    const doctorRatings: Record<string, { total: number; count: number }> = {}
    for (const r of ratedResponses) {
      if (!r.patientId || !patientDoctorMap[r.patientId]) continue
      const doctor = patientDoctorMap[r.patientId]
      if (!doctorRatings[doctor]) doctorRatings[doctor] = { total: 0, count: 0 }
      doctorRatings[doctor].total += r.rating || 0
      doctorRatings[doctor].count++
    }
    byDoctor = Object.entries(doctorRatings)
      .map(([doctorName, data]) => ({
        doctorName,
        avgRating: Math.round((data.total / data.count) * 10) / 10,
        count: data.count,
      }))
      .sort((a, b) => b.avgRating - a.avgRating)

    // Get treatments for these patients to link feedback to procedures
    const treatments = await prisma.treatment.findMany({
      where: {
        hospitalId: hospitalId!,
        patientId: { in: patientIds },
        createdAt: dateFilter,
      },
      select: {
        patientId: true,
        procedure: { select: { name: true } },
      },
    })

    const patientProcedureMap: Record<string, string> = {}
    for (const t of treatments) {
      if (t.procedure?.name) patientProcedureMap[t.patientId] = t.procedure.name
    }

    const procedureRatings: Record<string, { total: number; count: number }> = {}
    for (const r of ratedResponses) {
      if (!r.patientId || !patientProcedureMap[r.patientId]) continue
      const proc = patientProcedureMap[r.patientId]
      if (!procedureRatings[proc]) procedureRatings[proc] = { total: 0, count: 0 }
      procedureRatings[proc].total += r.rating || 0
      procedureRatings[proc].count++
    }
    byProcedure = Object.entries(procedureRatings)
      .map(([procedureName, data]) => ({
        procedureName,
        avgRating: Math.round((data.total / data.count) * 10) / 10,
        count: data.count,
      }))
      .sort((a, b) => b.avgRating - a.avgRating)
  }

  // Satisfaction by month
  const ratingByMonth: Record<string, { total: number; count: number }> = {}
  for (const r of ratedResponses) {
    const monthKey = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, "0")}`
    if (!ratingByMonth[monthKey]) ratingByMonth[monthKey] = { total: 0, count: 0 }
    ratingByMonth[monthKey].total += r.rating || 0
    ratingByMonth[monthKey].count++
  }
  const byMonth = Object.entries(ratingByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      avgRating: Math.round((data.total / data.count) * 10) / 10,
      count: data.count,
    }))

  // Word frequency from open-text answers
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
    "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such", "no",
    "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "but", "and", "or", "if", "while", "that", "this",
    "it", "its", "i", "me", "my", "we", "our", "you", "your", "he", "him",
    "she", "her", "they", "them", "their", "what", "which", "who", "whom",
  ])

  const wordCounts: Record<string, number> = {}
  for (const r of responses) {
    try {
      const answers = JSON.parse(r.answers)
      // answers could be an object { "question": "answer" } or array
      const textValues = typeof answers === "object"
        ? Object.values(answers).filter((v): v is string => typeof v === "string")
        : []

      for (const text of textValues) {
        const words = text
          .toLowerCase()
          .replace(/[^a-zA-Z\s]/g, "")
          .split(/\s+/)
          .filter((w) => w.length > 2 && !stopWords.has(w))

        for (const word of words) {
          wordCounts[word] = (wordCounts[word] || 0) + 1
        }
      }
    } catch {
      // Invalid JSON — skip
    }
  }

  const wordFrequencies = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word, count]) => ({ word, count }))

  // Response rate: total complete responses / total surveys sent (approximation)
  const totalSurveySent = await prisma.surveyResponse.count({
    where: { surveyId: { in: surveyIds }, createdAt: dateFilter },
  })
  const responseRate =
    totalSurveySent > 0 ? Math.round((totalResponses / totalSurveySent) * 1000) / 10 : 0

  return NextResponse.json({
    period,
    totalSurveys: surveys.length,
    totalResponses,
    responseRate,
    avgRating,
    nps: {
      score: npsScore,
      promoters,
      passives,
      detractors,
      trend: npsTrend,
    },
    satisfaction: {
      byDoctor,
      byProcedure,
      byMonth,
    },
    sentimentBreakdown,
    wordFrequencies,
  })
}
