import { createHash, createHmac } from "crypto"
import type {
  PaymentGateway,
  CreateOrderParams,
  VerifyPaymentParams,
  VerifyPaymentResult,
  GatewayOrder,
  GatewayCredentials,
  CheckoutConfig,
  RefundParams,
  RefundResult,
} from "./types"

/**
 * Generate Paytm checksum (simplified — no paytmchecksum dependency).
 * Uses HMAC SHA256 of sorted params.
 */
function generatePaytmChecksum(
  params: Record<string, string>,
  merchantKey: string
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("|")
  return createHmac("sha256", merchantKey).update(sorted).digest("hex")
}

function verifyPaytmChecksum(
  params: Record<string, string>,
  checksum: string,
  merchantKey: string
): boolean {
  const generated = generatePaytmChecksum(params, merchantKey)
  return generated === checksum
}

export class PaytmGateway implements PaymentGateway {
  private mid: string
  private merchantKey: string
  private website: string
  private baseUrl: string

  constructor(credentials: GatewayCredentials) {
    if (!credentials.paytmMid || !credentials.paytmMerchantKey) {
      throw new Error("Paytm credentials (mid, merchantKey) are required")
    }
    this.mid = credentials.paytmMid
    this.merchantKey = credentials.paytmMerchantKey
    this.website = credentials.paytmWebsite || "DEFAULT"
    this.baseUrl = credentials.isLiveMode
      ? "https://securegw.paytm.in"
      : "https://securegw-stage.paytm.in"
  }

  async createOrder(params: CreateOrderParams): Promise<GatewayOrder> {
    const orderId = `ORDER_${params.invoiceId}_${Date.now()}`
    const amountStr = params.amount.toFixed(2)

    const paytmParams: Record<string, string> = {
      MID: this.mid,
      WEBSITE: this.website,
      INDUSTRY_TYPE_ID: "Retail",
      CHANNEL_ID: "WEB",
      ORDER_ID: orderId,
      CUST_ID: params.invoiceId,
      TXN_AMOUNT: amountStr,
      CALLBACK_URL: `${process.env.NEXTAUTH_URL}/api/webhooks/payment/paytm`,
    }

    // Initiate transaction to get txnToken
    const body = {
      body: {
        requestType: "Payment",
        mid: this.mid,
        websiteName: this.website,
        orderId,
        txnAmount: {
          value: amountStr,
          currency: params.currency || "INR",
        },
        userInfo: {
          custId: params.invoiceId,
        },
        callbackUrl: paytmParams.CALLBACK_URL,
      },
      head: {
        signature: generatePaytmChecksum(paytmParams, this.merchantKey),
      },
    }

    const res = await fetch(
      `${this.baseUrl}/theia/api/v1/initiateTransaction?mid=${this.mid}&orderId=${orderId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    )

    const data = await res.json()

    if (data.body?.resultInfo?.resultStatus !== "S") {
      throw new Error(
        data.body?.resultInfo?.resultMsg || "Paytm order creation failed"
      )
    }

    return {
      orderId,
      amount: Math.round(params.amount * 100),
      currency: params.currency || "INR",
      receipt: params.receipt,
      provider: "paytm",
      status: "CREATED",
      metadata: {
        txnToken: data.body.txnToken,
        mid: this.mid,
        orderId,
      },
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const paytmParams: Record<string, string> = {
      MID: this.mid,
      ORDER_ID: params.orderId as string,
    }

    const body = {
      body: {
        mid: this.mid,
        orderId: params.orderId,
      },
      head: {
        signature: generatePaytmChecksum(paytmParams, this.merchantKey),
      },
    }

    const res = await fetch(
      `${this.baseUrl}/v3/order/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    )

    const data = await res.json()

    if (data.body?.resultInfo?.resultStatus === "TXN_SUCCESS") {
      return {
        verified: true,
        transactionId: data.body.txnId || params.orderId as string,
        status: "COMPLETED",
        amount: parseFloat(data.body.txnAmount) || undefined,
        method: data.body.paymentMode,
      }
    }

    return {
      verified: false,
      transactionId: params.orderId as string,
      status: data.body?.resultInfo?.resultStatus || "FAILED",
    }
  }

  verifyWebhook(body: string, _signature: string, _secret: string): boolean {
    try {
      const data = JSON.parse(body)
      const checksumReceived = data.head?.signature
      if (!checksumReceived) return false

      // Re-compute checksum from body params
      const txnParams: Record<string, string> = {}
      for (const [key, value] of Object.entries(data.body || {})) {
        if (typeof value === "string") {
          txnParams[key] = value
        }
      }
      return verifyPaytmChecksum(txnParams, checksumReceived, this.merchantKey)
    } catch {
      return false
    }
  }

  getCheckoutConfig(order: GatewayOrder, _credentials: GatewayCredentials): CheckoutConfig {
    return {
      provider: "paytm",
      txnToken: (order.metadata?.txnToken as string) || "",
      orderId: order.orderId,
      mid: this.mid,
      amount: order.amount / 100, // Convert back to rupees for frontend display
    }
  }

  async initiateRefund(params: RefundParams): Promise<RefundResult> {
    const refundId = `REFUND_${params.paymentId}_${Date.now()}`
    const amountStr = params.amount.toFixed(2)

    const paytmParams: Record<string, string> = {
      MID: this.mid,
      TXNID: params.paymentId,
      ORDERID: refundId,
      REFUNDAMOUNT: amountStr,
      TXNTYPE: "REFUND",
    }

    const body = {
      body: {
        mid: this.mid,
        txnType: "REFUND",
        orderId: refundId,
        txnId: params.paymentId,
        refId: refundId,
        refundAmount: amountStr,
      },
      head: {
        signature: generatePaytmChecksum(paytmParams, this.merchantKey),
      },
    }

    const res = await fetch(`${this.baseUrl}/refund/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    return {
      success: data.body?.resultInfo?.resultStatus === "PENDING" || data.body?.resultInfo?.resultStatus === "TXN_SUCCESS",
      refundId,
      status: data.body?.resultInfo?.resultStatus || "FAILED",
      amount: params.amount,
    }
  }
}
