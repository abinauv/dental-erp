import { createHmac } from 'crypto'
import { signaturesMatch } from './signature'
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
} from './types'

export class RazorpayGateway implements PaymentGateway {
  private keyId: string
  private keySecret: string
  private baseUrl: string

  constructor(credentials: GatewayCredentials) {
    if (!credentials.razorpayKeyId || !credentials.razorpayKeySecret) {
      throw new Error('Razorpay credentials (keyId, keySecret) are required')
    }
    this.keyId = credentials.razorpayKeyId
    this.keySecret = credentials.razorpayKeySecret
    this.baseUrl = 'https://api.razorpay.com/v1'
  }

  private async request(path: string, options: RequestInit = {}) {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error?.description || `Razorpay API error: ${res.status}`)
    }
    return data
  }

  async createOrder(params: CreateOrderParams): Promise<GatewayOrder> {
    const amountInPaise = Math.round(params.amount * 100)
    const data = await this.request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: amountInPaise,
        currency: params.currency || 'INR',
        receipt: params.receipt,
        notes: {
          invoiceId: params.invoiceId,
        },
      }),
    })

    return {
      orderId: data.id,
      amount: amountInPaise,
      currency: data.currency,
      receipt: params.receipt,
      provider: 'razorpay',
      status: data.status,
      metadata: { razorpayOrderId: data.id },
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    // Verify signature: HMAC SHA256 of orderId|paymentId with keySecret
    const body = `${params.orderId}|${params.paymentId}`
    const expectedSignature = createHmac('sha256', this.keySecret).update(body).digest('hex')

    if (!signaturesMatch(expectedSignature, params.signature)) {
      return { verified: false, transactionId: '', status: 'FAILED' }
    }

    // Fetch payment details from Razorpay to confirm
    const payment = await this.request(`/payments/${encodeURIComponent(String(params.paymentId))}`)

    // The signature proves the payment belongs to the order, not that it went
    // through: a failed or refunded payment must not settle the invoice.
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return { verified: false, transactionId: params.paymentId as string, status: payment.status }
    }

    return {
      verified: true,
      transactionId: params.paymentId as string,
      status: payment.status === 'captured' ? 'COMPLETED' : payment.status,
      amount: payment.amount / 100, // Convert back from paise to INR
      method: payment.method,
    }
  }

  verifyWebhook(body: string, signature: string, secret: string): boolean {
    const expectedSignature = createHmac('sha256', secret).update(body).digest('hex')
    return signaturesMatch(expectedSignature, signature)
  }

  getCheckoutConfig(order: GatewayOrder, credentials: GatewayCredentials): CheckoutConfig {
    return {
      provider: 'razorpay',
      key: credentials.razorpayKeyId!,
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
    }
  }

  async initiateRefund(params: RefundParams): Promise<RefundResult> {
    const amountInPaise = Math.round(params.amount * 100)
    const data = await this.request(`/payments/${params.paymentId}/refund`, {
      method: 'POST',
      body: JSON.stringify({
        amount: amountInPaise,
        notes: {
          reason: params.reason || 'Refund requested',
        },
      }),
    })

    return {
      success: true,
      refundId: data.id,
      status: data.status,
      amount: data.amount / 100,
    }
  }
}
