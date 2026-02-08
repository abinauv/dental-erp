import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"
import { RazorpayGateway } from "./razorpay"
import { PhonePeGateway } from "./phonepe"
import { PaytmGateway } from "./paytm"
import type { PaymentGateway, GatewayCredentials } from "./types"

export type { PaymentGateway, GatewayCredentials }
export type { GatewayOrder, CheckoutConfig, VerifyPaymentParams, VerifyPaymentResult } from "./types"

/**
 * Get the payment gateway adapter for a hospital.
 * Reads credentials from DB, decrypts secrets, returns the correct adapter.
 */
export async function getGateway(hospitalId: string): Promise<{
  gateway: PaymentGateway
  credentials: GatewayCredentials
} | null> {
  const config = await prisma.paymentGatewayConfig.findUnique({
    where: { hospitalId },
  })

  if (!config || !config.isEnabled) {
    return null
  }

  const credentials: GatewayCredentials = {
    provider: config.provider,
    isLiveMode: config.isLiveMode,
    webhookSecret: config.webhookSecret || undefined,
  }

  // Decrypt secrets based on provider
  switch (config.provider) {
    case "RAZORPAY":
      credentials.razorpayKeyId = config.razorpayKeyId || undefined
      credentials.razorpayKeySecret = config.razorpayKeySecret
        ? decrypt(config.razorpayKeySecret)
        : undefined
      break
    case "PHONEPE":
      credentials.phonepeMerchantId = config.phonepeMerchantId || undefined
      credentials.phonepeSaltKey = config.phonepeSaltKey
        ? decrypt(config.phonepeSaltKey)
        : undefined
      credentials.phonepeSaltIndex = config.phonepeSaltIndex || undefined
      break
    case "PAYTM":
      credentials.paytmMid = config.paytmMid || undefined
      credentials.paytmMerchantKey = config.paytmMerchantKey
        ? decrypt(config.paytmMerchantKey)
        : undefined
      credentials.paytmWebsite = config.paytmWebsite || undefined
      break
  }

  const gateway = createGateway(credentials)
  return { gateway, credentials }
}

/**
 * Create a gateway adapter instance from credentials.
 */
function createGateway(credentials: GatewayCredentials): PaymentGateway {
  switch (credentials.provider) {
    case "RAZORPAY":
      return new RazorpayGateway(credentials)
    case "PHONEPE":
      return new PhonePeGateway(credentials)
    case "PAYTM":
      return new PaytmGateway(credentials)
    default:
      throw new Error(`Unsupported payment provider: ${credentials.provider}`)
  }
}
