/**
 * Common interface for all payment gateway adapters.
 * Each hospital connects their own merchant account.
 */

export interface GatewayOrder {
  orderId: string          // Gateway's order/transaction ID
  amount: number           // Amount in smallest currency unit (paise)
  currency: string
  receipt: string          // Our invoice reference
  provider: string         // razorpay / phonepe / paytm
  status: string
  metadata?: Record<string, unknown>
}

export interface CreateOrderParams {
  amount: number           // Amount in INR (rupees, not paise)
  currency: string
  invoiceId: string
  receipt: string          // Invoice number
  customerName?: string
  customerEmail?: string
  customerPhone?: string
}

export interface VerifyPaymentParams {
  orderId: string          // Gateway order ID
  paymentId: string        // Gateway payment ID
  signature: string        // Signature for verification
  [key: string]: unknown   // Provider-specific extra fields
}

export interface VerifyPaymentResult {
  verified: boolean
  transactionId: string
  status: string
  amount?: number
  method?: string
}

export interface CheckoutConfig {
  provider: string
  [key: string]: unknown   // Provider-specific config
}

export interface RefundParams {
  paymentId: string
  amount: number           // Amount in INR (rupees)
  reason?: string
}

export interface RefundResult {
  success: boolean
  refundId: string
  status: string
  amount: number
}

export interface GatewayCredentials {
  provider: string
  isLiveMode: boolean
  // Razorpay
  razorpayKeyId?: string
  razorpayKeySecret?: string
  // PhonePe
  phonepeMerchantId?: string
  phonepeSaltKey?: string
  phonepeSaltIndex?: string
  // Paytm
  paytmMid?: string
  paytmMerchantKey?: string
  paytmWebsite?: string
  // Webhook
  webhookSecret?: string
}

export interface PaymentGateway {
  createOrder(params: CreateOrderParams): Promise<GatewayOrder>
  verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult>
  verifyWebhook(body: string, signature: string, secret: string): boolean
  getCheckoutConfig(order: GatewayOrder, credentials: GatewayCredentials): CheckoutConfig
  initiateRefund(params: RefundParams): Promise<RefundResult>
}
