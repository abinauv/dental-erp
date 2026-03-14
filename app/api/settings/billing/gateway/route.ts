import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { encrypt, decrypt } from "@/lib/encryption"

/**
 * GET: Fetch payment gateway configuration for the hospital.
 * Secrets are masked in response.
 */
export async function GET() {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = await prisma.paymentGatewayConfig.findUnique({
    where: { hospitalId },
  })

  if (!config) {
    return NextResponse.json({ config: null })
  }

  // Mask secrets — only show last 4 chars
  const mask = (val: string | null) =>
    val ? `****${val.slice(-4)}` : null

  return NextResponse.json({
    config: {
      provider: config.provider,
      isEnabled: config.isEnabled,
      isLiveMode: config.isLiveMode,
      razorpayKeyId: config.razorpayKeyId,
      razorpayKeySecret: config.razorpayKeySecret ? mask(decrypt(config.razorpayKeySecret)) : null,
      phonepeMerchantId: config.phonepeMerchantId,
      phonepeSaltKey: config.phonepeSaltKey ? mask(decrypt(config.phonepeSaltKey)) : null,
      phonepeSaltIndex: config.phonepeSaltIndex,
      paytmMid: config.paytmMid,
      paytmMerchantKey: config.paytmMerchantKey ? mask(decrypt(config.paytmMerchantKey)) : null,
      paytmWebsite: config.paytmWebsite,
      webhookUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/payment/${config.provider.toLowerCase()}`,
    },
  })
}

/**
 * PUT: Create or update payment gateway configuration.
 */
export async function PUT(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const {
    provider,
    isEnabled,
    isLiveMode,
    razorpayKeyId,
    razorpayKeySecret,
    phonepeMerchantId,
    phonepeSaltKey,
    phonepeSaltIndex,
    paytmMid,
    paytmMerchantKey,
    paytmWebsite,
  } = body

  if (!provider || !["RAZORPAY", "PHONEPE", "PAYTM"].includes(provider)) {
    return NextResponse.json(
      { error: "Valid provider is required (RAZORPAY, PHONEPE, PAYTM)" },
      { status: 400 }
    )
  }

  // Build update data — only encrypt secrets that are actually new (not masked)
  const existing = await prisma.paymentGatewayConfig.findUnique({
    where: { hospitalId },
  })

  const data: Record<string, unknown> = {
    provider,
    isEnabled: isEnabled ?? false,
    isLiveMode: isLiveMode ?? false,
  }

  // Razorpay fields
  if (provider === "RAZORPAY") {
    data.razorpayKeyId = razorpayKeyId || null
    // Only encrypt if it's a new value (not masked)
    if (razorpayKeySecret && !razorpayKeySecret.startsWith("****")) {
      data.razorpayKeySecret = encrypt(razorpayKeySecret)
    } else if (existing?.provider === "RAZORPAY") {
      data.razorpayKeySecret = existing.razorpayKeySecret
    }
    // Clear other provider fields
    data.phonepeMerchantId = null
    data.phonepeSaltKey = null
    data.phonepeSaltIndex = null
    data.paytmMid = null
    data.paytmMerchantKey = null
    data.paytmWebsite = null
  }

  // PhonePe fields
  if (provider === "PHONEPE") {
    data.phonepeMerchantId = phonepeMerchantId || null
    if (phonepeSaltKey && !phonepeSaltKey.startsWith("****")) {
      data.phonepeSaltKey = encrypt(phonepeSaltKey)
    } else if (existing?.provider === "PHONEPE") {
      data.phonepeSaltKey = existing.phonepeSaltKey
    }
    data.phonepeSaltIndex = phonepeSaltIndex || null
    // Clear other provider fields
    data.razorpayKeyId = null
    data.razorpayKeySecret = null
    data.paytmMid = null
    data.paytmMerchantKey = null
    data.paytmWebsite = null
  }

  // Paytm fields
  if (provider === "PAYTM") {
    data.paytmMid = paytmMid || null
    if (paytmMerchantKey && !paytmMerchantKey.startsWith("****")) {
      data.paytmMerchantKey = encrypt(paytmMerchantKey)
    } else if (existing?.provider === "PAYTM") {
      data.paytmMerchantKey = existing.paytmMerchantKey
    }
    data.paytmWebsite = paytmWebsite || null
    // Clear other provider fields
    data.razorpayKeyId = null
    data.razorpayKeySecret = null
    data.phonepeMerchantId = null
    data.phonepeSaltKey = null
    data.phonepeSaltIndex = null
  }

  const config = await prisma.paymentGatewayConfig.upsert({
    where: { hospitalId },
    create: { hospitalId, ...data } as never,
    update: data as never,
  })

  return NextResponse.json({
    success: true,
    config: {
      provider: config.provider,
      isEnabled: config.isEnabled,
      isLiveMode: config.isLiveMode,
      webhookUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/payment/${config.provider.toLowerCase()}`,
    },
  })
}
