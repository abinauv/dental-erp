import { createHash } from "crypto"
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

export class PhonePeGateway implements PaymentGateway {
  private merchantId: string
  private saltKey: string
  private saltIndex: string
  private baseUrl: string

  constructor(credentials: GatewayCredentials) {
    if (!credentials.phonepeMerchantId || !credentials.phonepeSaltKey) {
      throw new Error("PhonePe credentials (merchantId, saltKey) are required")
    }
    this.merchantId = credentials.phonepeMerchantId
    this.saltKey = credentials.phonepeSaltKey
    this.saltIndex = credentials.phonepeSaltIndex || "1"
    this.baseUrl = credentials.isLiveMode
      ? "https://api.phonepe.com/apis/hermes"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox"
  }

  private generateChecksum(payload: string, endpoint: string): string {
    const string = payload + endpoint + this.saltKey
    return createHash("sha256").update(string).digest("hex") + "###" + this.saltIndex
  }

  async createOrder(params: CreateOrderParams): Promise<GatewayOrder> {
    const amountInPaise = Math.round(params.amount * 100)
    const merchantTransactionId = `TXN_${params.invoiceId}_${Date.now()}`

    const payload = {
      merchantId: this.merchantId,
      merchantTransactionId,
      merchantUserId: params.invoiceId,
      amount: amountInPaise,
      redirectUrl: `${process.env.NEXTAUTH_URL}/api/payments/phonepe-callback?txnId=${merchantTransactionId}`,
      redirectMode: "POST",
      callbackUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/payment/phonepe`,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    }

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64")
    const checksum = this.generateChecksum(base64Payload, "/pg/v1/pay")

    const res = await fetch(`${this.baseUrl}/pg/v1/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
      },
      body: JSON.stringify({ request: base64Payload }),
    })

    const data = await res.json()

    if (!data.success) {
      throw new Error(data.message || "PhonePe order creation failed")
    }

    return {
      orderId: merchantTransactionId,
      amount: amountInPaise,
      currency: params.currency || "INR",
      receipt: params.receipt,
      provider: "phonepe",
      status: "CREATED",
      metadata: {
        redirectUrl: data.data?.instrumentResponse?.redirectInfo?.url,
        merchantTransactionId,
      },
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const endpoint = `/pg/v1/status/${this.merchantId}/${params.orderId}`
    const string = endpoint + this.saltKey
    const checksum = createHash("sha256").update(string).digest("hex") + "###" + this.saltIndex

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
        "X-MERCHANT-ID": this.merchantId,
      },
    })

    const data = await res.json()

    if (data.success && data.code === "PAYMENT_SUCCESS") {
      return {
        verified: true,
        transactionId: data.data?.transactionId || params.orderId as string,
        status: "COMPLETED",
        amount: data.data?.amount ? data.data.amount / 100 : undefined,
        method: data.data?.paymentInstrument?.type,
      }
    }

    return {
      verified: false,
      transactionId: params.orderId as string,
      status: data.code || "FAILED",
    }
  }

  verifyWebhook(body: string, signature: string, _secret: string): boolean {
    // PhonePe uses X-VERIFY header with SHA256 checksum
    try {
      const data = JSON.parse(body)
      const base64Response = data.response
      const string = base64Response + "/pg/v1/status" + this.saltKey
      const expectedChecksum = createHash("sha256").update(string).digest("hex") + "###" + this.saltIndex
      return expectedChecksum === signature
    } catch {
      return false
    }
  }

  getCheckoutConfig(order: GatewayOrder, _credentials: GatewayCredentials): CheckoutConfig {
    return {
      provider: "phonepe",
      redirectUrl: (order.metadata?.redirectUrl as string) || "",
      merchantTransactionId: order.orderId,
    }
  }

  async initiateRefund(params: RefundParams): Promise<RefundResult> {
    const amountInPaise = Math.round(params.amount * 100)
    const merchantRefundId = `REFUND_${params.paymentId}_${Date.now()}`

    const payload = {
      merchantId: this.merchantId,
      merchantUserId: "refund",
      originalTransactionId: params.paymentId,
      merchantTransactionId: merchantRefundId,
      amount: amountInPaise,
      callbackUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/payment/phonepe`,
    }

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64")
    const checksum = this.generateChecksum(base64Payload, "/pg/v1/refund")

    const res = await fetch(`${this.baseUrl}/pg/v1/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
      },
      body: JSON.stringify({ request: base64Payload }),
    })

    const data = await res.json()

    return {
      success: data.success || false,
      refundId: merchantRefundId,
      status: data.code || "PENDING",
      amount: params.amount,
    }
  }
}
