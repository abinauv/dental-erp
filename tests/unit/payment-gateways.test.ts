import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac, createHash } from 'crypto'
import { RazorpayGateway } from '@/lib/payment-gateways/razorpay'
import { PhonePeGateway } from '@/lib/payment-gateways/phonepe'
import { PaytmGateway } from '@/lib/payment-gateways/paytm'
import type { CreateOrderParams, GatewayCredentials, GatewayOrder } from '@/lib/payment-gateways/types'

// ---- Shared test fixtures ----

const ORDER_PARAMS: CreateOrderParams = {
  amount: 1500,
  currency: 'INR',
  invoiceId: 'INV-2025-001',
  receipt: 'INV-2025-001',
  customerName: 'Rahul Sharma',
  customerEmail: 'rahul@example.com',
  customerPhone: '9876543210',
}

// ---- fetch mock ----

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

// ==========================================================================
// Razorpay Gateway
// ==========================================================================

describe('RazorpayGateway', () => {
  const creds: GatewayCredentials = {
    provider: 'RAZORPAY',
    isLiveMode: false,
    razorpayKeyId: 'rzp_test_key123',
    razorpayKeySecret: 'rzp_secret_abc',
  }

  // ---------- Constructor ----------
  describe('constructor', () => {
    it('creates instance with valid credentials', () => {
      const gw = new RazorpayGateway(creds)
      expect(gw).toBeDefined()
    })

    it('throws when keyId is missing', () => {
      expect(() => new RazorpayGateway({ ...creds, razorpayKeyId: undefined })).toThrow(
        'Razorpay credentials'
      )
    })

    it('throws when keySecret is missing', () => {
      expect(() => new RazorpayGateway({ ...creds, razorpayKeySecret: undefined })).toThrow(
        'Razorpay credentials'
      )
    })
  })

  // ---------- createOrder ----------
  describe('createOrder', () => {
    it('creates an order with correct amount in paise', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'order_123', currency: 'INR', status: 'created' }),
      })

      const gw = new RazorpayGateway(creds)
      const order = await gw.createOrder(ORDER_PARAMS)

      expect(order.orderId).toBe('order_123')
      expect(order.amount).toBe(150000) // 1500 * 100
      expect(order.currency).toBe('INR')
      expect(order.provider).toBe('razorpay')
      expect(order.metadata?.razorpayOrderId).toBe('order_123')
    })

    it('sends correct auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'order_1', currency: 'INR', status: 'created' }),
      })

      const gw = new RazorpayGateway(creds)
      await gw.createOrder(ORDER_PARAMS)

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('https://api.razorpay.com/v1/orders')
      const expectedAuth = Buffer.from(`${creds.razorpayKeyId}:${creds.razorpayKeySecret}`).toString('base64')
      expect(opts.headers.Authorization).toBe(`Basic ${expectedAuth}`)
    })

    it('sends amount in paise in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'o1', currency: 'INR', status: 'created' }),
      })

      const gw = new RazorpayGateway(creds)
      await gw.createOrder({ ...ORDER_PARAMS, amount: 99.99 })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.amount).toBe(9999) // Math.round(99.99 * 100)
    })

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { description: 'Bad Request' } }),
      })

      const gw = new RazorpayGateway(creds)
      await expect(gw.createOrder(ORDER_PARAMS)).rejects.toThrow('Bad Request')
    })
  })

  // ---------- verifyPayment ----------
  describe('verifyPayment', () => {
    it('verifies valid signature', async () => {
      const orderId = 'order_123'
      const paymentId = 'pay_456'
      const sig = createHmac('sha256', creds.razorpayKeySecret!)
        .update(`${orderId}|${paymentId}`)
        .digest('hex')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'captured',
          amount: 150000,
          method: 'upi',
        }),
      })

      const gw = new RazorpayGateway(creds)
      const result = await gw.verifyPayment({ orderId, paymentId, signature: sig })

      expect(result.verified).toBe(true)
      expect(result.transactionId).toBe(paymentId)
      expect(result.status).toBe('COMPLETED')
      expect(result.amount).toBe(1500)
      expect(result.method).toBe('upi')
    })

    it('rejects invalid signature', async () => {
      const gw = new RazorpayGateway(creds)
      const result = await gw.verifyPayment({
        orderId: 'order_123',
        paymentId: 'pay_456',
        signature: 'invalid_sig',
      })

      expect(result.verified).toBe(false)
      expect(result.status).toBe('FAILED')
    })

    it('returns non-captured status as-is', async () => {
      const orderId = 'order_x'
      const paymentId = 'pay_y'
      const sig = createHmac('sha256', creds.razorpayKeySecret!)
        .update(`${orderId}|${paymentId}`)
        .digest('hex')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'authorized', amount: 50000, method: 'card' }),
      })

      const gw = new RazorpayGateway(creds)
      const result = await gw.verifyPayment({ orderId, paymentId, signature: sig })

      expect(result.verified).toBe(true)
      expect(result.status).toBe('authorized')
    })
  })

  // ---------- verifyWebhook ----------
  describe('verifyWebhook', () => {
    it('verifies valid webhook signature', () => {
      const body = '{"event":"payment.captured"}'
      const secret = 'webhook_secret_123'
      const sig = createHmac('sha256', secret).update(body).digest('hex')

      const gw = new RazorpayGateway(creds)
      expect(gw.verifyWebhook(body, sig, secret)).toBe(true)
    })

    it('rejects invalid webhook signature', () => {
      const gw = new RazorpayGateway(creds)
      expect(gw.verifyWebhook('{"event":"test"}', 'wrong_sig', 'secret')).toBe(false)
    })
  })

  // ---------- getCheckoutConfig ----------
  describe('getCheckoutConfig', () => {
    it('returns correct checkout config', () => {
      const gw = new RazorpayGateway(creds)
      const order: GatewayOrder = {
        orderId: 'order_abc',
        amount: 150000,
        currency: 'INR',
        receipt: 'INV-001',
        provider: 'razorpay',
        status: 'created',
      }

      const config = gw.getCheckoutConfig(order, creds)
      expect(config.provider).toBe('razorpay')
      expect(config.key).toBe(creds.razorpayKeyId)
      expect(config.orderId).toBe('order_abc')
      expect(config.amount).toBe(150000)
      expect(config.currency).toBe('INR')
    })
  })

  // ---------- initiateRefund ----------
  describe('initiateRefund', () => {
    it('initiates refund with correct amount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'refund_001', status: 'processed', amount: 50000 }),
      })

      const gw = new RazorpayGateway(creds)
      const result = await gw.initiateRefund({ paymentId: 'pay_123', amount: 500 })

      expect(result.success).toBe(true)
      expect(result.refundId).toBe('refund_001')
      expect(result.amount).toBe(500)

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.amount).toBe(50000)
    })

    it('sends POST to correct refund URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'r1', status: 'processed', amount: 10000 }),
      })

      const gw = new RazorpayGateway(creds)
      await gw.initiateRefund({ paymentId: 'pay_xyz', amount: 100, reason: 'Customer request' })

      expect(mockFetch.mock.calls[0][0]).toContain('/payments/pay_xyz/refund')
    })
  })
})

// ==========================================================================
// PhonePe Gateway
// ==========================================================================

describe('PhonePeGateway', () => {
  const creds: GatewayCredentials = {
    provider: 'PHONEPE',
    isLiveMode: false,
    phonepeMerchantId: 'MERCHANT_TEST',
    phonepeSaltKey: 'salt_key_abc',
    phonepeSaltIndex: '1',
  }

  // ---------- Constructor ----------
  describe('constructor', () => {
    it('creates instance with valid credentials', () => {
      const gw = new PhonePeGateway(creds)
      expect(gw).toBeDefined()
    })

    it('throws when merchantId is missing', () => {
      expect(() => new PhonePeGateway({ ...creds, phonepeMerchantId: undefined })).toThrow(
        'PhonePe credentials'
      )
    })

    it('throws when saltKey is missing', () => {
      expect(() => new PhonePeGateway({ ...creds, phonepeSaltKey: undefined })).toThrow(
        'PhonePe credentials'
      )
    })

    it('uses sandbox URL when isLiveMode is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { instrumentResponse: { redirectInfo: { url: 'https://sandbox.phonepe.com/pay' } } },
        }),
      })

      const gw = new PhonePeGateway(creds)
      await gw.createOrder(ORDER_PARAMS)

      expect(mockFetch.mock.calls[0][0]).toContain('api-preprod.phonepe.com')
    })

    it('uses production URL when isLiveMode is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { instrumentResponse: { redirectInfo: { url: 'https://phonepe.com/pay' } } },
        }),
      })

      const gw = new PhonePeGateway({ ...creds, isLiveMode: true })
      await gw.createOrder(ORDER_PARAMS)

      expect(mockFetch.mock.calls[0][0]).toContain('api.phonepe.com')
    })
  })

  // ---------- createOrder ----------
  describe('createOrder', () => {
    it('creates order with correct provider and amount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { instrumentResponse: { redirectInfo: { url: 'https://phonepe.com/redirect' } } },
        }),
      })

      const gw = new PhonePeGateway(creds)
      const order = await gw.createOrder(ORDER_PARAMS)

      expect(order.provider).toBe('phonepe')
      expect(order.amount).toBe(150000)
      expect(order.currency).toBe('INR')
      expect(order.status).toBe('CREATED')
      expect(order.orderId).toContain('TXN_')
      expect(order.metadata?.redirectUrl).toBe('https://phonepe.com/redirect')
    })

    it('sends X-VERIFY checksum header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      })

      const gw = new PhonePeGateway(creds)
      await gw.createOrder(ORDER_PARAMS)

      const headers = mockFetch.mock.calls[0][1].headers
      expect(headers['X-VERIFY']).toBeDefined()
      expect(headers['X-VERIFY']).toContain('###1') // salt index
    })

    it('throws on failed order creation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, message: 'Invalid merchant' }),
      })

      const gw = new PhonePeGateway(creds)
      await expect(gw.createOrder(ORDER_PARAMS)).rejects.toThrow('Invalid merchant')
    })
  })

  // ---------- verifyPayment ----------
  describe('verifyPayment', () => {
    it('returns verified on payment success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          code: 'PAYMENT_SUCCESS',
          data: {
            transactionId: 'txn_abc',
            amount: 150000,
            paymentInstrument: { type: 'UPI' },
          },
        }),
      })

      const gw = new PhonePeGateway(creds)
      const result = await gw.verifyPayment({
        orderId: 'TXN_001',
        paymentId: 'pay_001',
        signature: '',
      })

      expect(result.verified).toBe(true)
      expect(result.transactionId).toBe('txn_abc')
      expect(result.status).toBe('COMPLETED')
      expect(result.amount).toBe(1500)
      expect(result.method).toBe('UPI')
    })

    it('returns unverified on payment failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          code: 'PAYMENT_DECLINED',
        }),
      })

      const gw = new PhonePeGateway(creds)
      const result = await gw.verifyPayment({
        orderId: 'TXN_001',
        paymentId: 'pay_001',
        signature: '',
      })

      expect(result.verified).toBe(false)
      expect(result.status).toBe('PAYMENT_DECLINED')
    })
  })

  // ---------- verifyWebhook ----------
  describe('verifyWebhook', () => {
    it('returns false for invalid JSON body', () => {
      const gw = new PhonePeGateway(creds)
      expect(gw.verifyWebhook('not-json', 'sig', 'secret')).toBe(false)
    })

    it('verifies webhook with matching checksum', () => {
      const response = Buffer.from('{"status":"SUCCESS"}').toString('base64')
      const body = JSON.stringify({ response })
      const string = response + '/pg/v1/status' + creds.phonepeSaltKey
      const expectedChecksum = createHash('sha256').update(string).digest('hex') + '###1'

      const gw = new PhonePeGateway(creds)
      expect(gw.verifyWebhook(body, expectedChecksum, '')).toBe(true)
    })
  })

  // ---------- getCheckoutConfig ----------
  describe('getCheckoutConfig', () => {
    it('returns redirect URL and provider', () => {
      const gw = new PhonePeGateway(creds)
      const order: GatewayOrder = {
        orderId: 'TXN_001',
        amount: 150000,
        currency: 'INR',
        receipt: 'INV-001',
        provider: 'phonepe',
        status: 'CREATED',
        metadata: { redirectUrl: 'https://phonepe.com/redirect' },
      }

      const config = gw.getCheckoutConfig(order, creds)
      expect(config.provider).toBe('phonepe')
      expect(config.redirectUrl).toBe('https://phonepe.com/redirect')
      expect(config.merchantTransactionId).toBe('TXN_001')
    })
  })

  // ---------- initiateRefund ----------
  describe('initiateRefund', () => {
    it('initiates refund and returns result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, code: 'REFUND_INITIATED' }),
      })

      const gw = new PhonePeGateway(creds)
      const result = await gw.initiateRefund({ paymentId: 'pay_123', amount: 500 })

      expect(result.success).toBe(true)
      expect(result.refundId).toContain('REFUND_pay_123')
      expect(result.amount).toBe(500)
    })
  })
})

// ==========================================================================
// Paytm Gateway
// ==========================================================================

describe('PaytmGateway', () => {
  const creds: GatewayCredentials = {
    provider: 'PAYTM',
    isLiveMode: false,
    paytmMid: 'MID_TEST_001',
    paytmMerchantKey: 'merchant_key_abc',
    paytmWebsite: 'WEBSTAGING',
  }

  // ---------- Constructor ----------
  describe('constructor', () => {
    it('creates instance with valid credentials', () => {
      const gw = new PaytmGateway(creds)
      expect(gw).toBeDefined()
    })

    it('throws when mid is missing', () => {
      expect(() => new PaytmGateway({ ...creds, paytmMid: undefined })).toThrow(
        'Paytm credentials'
      )
    })

    it('throws when merchantKey is missing', () => {
      expect(() => new PaytmGateway({ ...creds, paytmMerchantKey: undefined })).toThrow(
        'Paytm credentials'
      )
    })
  })

  // ---------- createOrder ----------
  describe('createOrder', () => {
    it('creates order with correct provider and metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: {
            resultInfo: { resultStatus: 'S' },
            txnToken: 'token_xyz',
          },
        }),
      })

      const gw = new PaytmGateway(creds)
      const order = await gw.createOrder(ORDER_PARAMS)

      expect(order.provider).toBe('paytm')
      expect(order.amount).toBe(150000)
      expect(order.currency).toBe('INR')
      expect(order.status).toBe('CREATED')
      expect(order.orderId).toContain('ORDER_')
      expect(order.metadata?.txnToken).toBe('token_xyz')
      expect(order.metadata?.mid).toBe('MID_TEST_001')
    })

    it('uses staging URL when isLiveMode is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: { resultInfo: { resultStatus: 'S' }, txnToken: 'tok' },
        }),
      })

      const gw = new PaytmGateway(creds)
      await gw.createOrder(ORDER_PARAMS)

      expect(mockFetch.mock.calls[0][0]).toContain('securegw-stage.paytm.in')
    })

    it('uses production URL when isLiveMode is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: { resultInfo: { resultStatus: 'S' }, txnToken: 'tok' },
        }),
      })

      const gw = new PaytmGateway({ ...creds, isLiveMode: true })
      await gw.createOrder(ORDER_PARAMS)

      expect(mockFetch.mock.calls[0][0]).toContain('securegw.paytm.in')
    })

    it('throws on failed transaction initiation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: { resultInfo: { resultStatus: 'F', resultMsg: 'Invalid MID' } },
        }),
      })

      const gw = new PaytmGateway(creds)
      await expect(gw.createOrder(ORDER_PARAMS)).rejects.toThrow('Invalid MID')
    })
  })

  // ---------- verifyPayment ----------
  describe('verifyPayment', () => {
    it('returns verified on TXN_SUCCESS', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: {
            resultInfo: { resultStatus: 'TXN_SUCCESS' },
            txnId: 'txn_paytm_001',
            txnAmount: '1500.00',
            paymentMode: 'UPI',
          },
        }),
      })

      const gw = new PaytmGateway(creds)
      const result = await gw.verifyPayment({
        orderId: 'ORDER_001',
        paymentId: 'pay_001',
        signature: '',
      })

      expect(result.verified).toBe(true)
      expect(result.transactionId).toBe('txn_paytm_001')
      expect(result.status).toBe('COMPLETED')
      expect(result.amount).toBe(1500)
      expect(result.method).toBe('UPI')
    })

    it('returns unverified on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: {
            resultInfo: { resultStatus: 'TXN_FAILURE' },
          },
        }),
      })

      const gw = new PaytmGateway(creds)
      const result = await gw.verifyPayment({
        orderId: 'ORDER_001',
        paymentId: 'pay_001',
        signature: '',
      })

      expect(result.verified).toBe(false)
      expect(result.status).toBe('TXN_FAILURE')
    })
  })

  // ---------- verifyWebhook ----------
  describe('verifyWebhook', () => {
    it('returns false for invalid JSON body', () => {
      const gw = new PaytmGateway(creds)
      expect(gw.verifyWebhook('not-json', '', '')).toBe(false)
    })

    it('returns false when no signature in body', () => {
      const gw = new PaytmGateway(creds)
      const body = JSON.stringify({ body: { txnId: '123' } })
      expect(gw.verifyWebhook(body, '', '')).toBe(false)
    })
  })

  // ---------- getCheckoutConfig ----------
  describe('getCheckoutConfig', () => {
    it('returns correct checkout config with txnToken', () => {
      const gw = new PaytmGateway(creds)
      const order: GatewayOrder = {
        orderId: 'ORDER_001',
        amount: 150000,
        currency: 'INR',
        receipt: 'INV-001',
        provider: 'paytm',
        status: 'CREATED',
        metadata: { txnToken: 'token_abc', mid: 'MID_TEST_001', orderId: 'ORDER_001' },
      }

      const config = gw.getCheckoutConfig(order, creds)
      expect(config.provider).toBe('paytm')
      expect(config.txnToken).toBe('token_abc')
      expect(config.orderId).toBe('ORDER_001')
      expect(config.mid).toBe('MID_TEST_001')
      expect(config.amount).toBe(1500) // converted back from paise
    })
  })

  // ---------- initiateRefund ----------
  describe('initiateRefund', () => {
    it('initiates refund and returns pending status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: { resultInfo: { resultStatus: 'PENDING' } },
        }),
      })

      const gw = new PaytmGateway(creds)
      const result = await gw.initiateRefund({ paymentId: 'txn_001', amount: 500, reason: 'Overcharge' })

      expect(result.success).toBe(true)
      expect(result.refundId).toContain('REFUND_txn_001')
      expect(result.amount).toBe(500)
      expect(result.status).toBe('PENDING')
    })

    it('sends POST to refund/apply endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: { resultInfo: { resultStatus: 'PENDING' } },
        }),
      })

      const gw = new PaytmGateway(creds)
      await gw.initiateRefund({ paymentId: 'txn_002', amount: 100 })

      expect(mockFetch.mock.calls[0][0]).toContain('/refund/apply')
    })
  })
})

// ==========================================================================
// Gateway Factory / Types
// ==========================================================================

describe('Gateway Types', () => {
  it('all gateways implement the PaymentGateway interface', () => {
    const methods = ['createOrder', 'verifyPayment', 'verifyWebhook', 'getCheckoutConfig', 'initiateRefund']

    const razorpay = new RazorpayGateway({
      provider: 'RAZORPAY', isLiveMode: false,
      razorpayKeyId: 'k', razorpayKeySecret: 's',
    })
    const phonepe = new PhonePeGateway({
      provider: 'PHONEPE', isLiveMode: false,
      phonepeMerchantId: 'm', phonepeSaltKey: 's',
    })
    const paytm = new PaytmGateway({
      provider: 'PAYTM', isLiveMode: false,
      paytmMid: 'm', paytmMerchantKey: 'k',
    })

    for (const method of methods) {
      expect(typeof (razorpay as any)[method]).toBe('function')
      expect(typeof (phonepe as any)[method]).toBe('function')
      expect(typeof (paytm as any)[method]).toBe('function')
    }
  })
})
