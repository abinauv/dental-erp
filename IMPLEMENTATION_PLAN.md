# Dental ERP — Full Feature Implementation Plan

> 30 features across 10 phases. Each phase is self-contained and builds on the previous.
> Phases are ordered by dependency — foundational infrastructure first, then features that depend on it.

---

## PHASE 1: Multi-Gateway Payment Integration (Hospital-Owned Accounts)

### Why first
Every payment-related feature (patient portal payments, payment plans, online booking with payment) depends on having a working payment gateway.

### Architecture
Each hospital connects their **own** merchant account (Razorpay / PhonePe / Paytm). Payments go directly to the hospital's bank account — the dental-erp platform never touches the money. The hospital admin enters their own API credentials in Settings.

| Gateway | Hospital Signs Up At | Credentials Entered |
|---------|---------------------|-------------------|
| Razorpay | dashboard.razorpay.com | `key_id` + `key_secret` |
| PhonePe PG | business.phonepe.com | `merchantId` + `saltKey` + `saltIndex` |
| Paytm PG | business.paytm.com | `mid` + `merchantKey` + `website` |

### 1.1 Gateway Adapter Pattern (Strategy)
- **File:** `lib/payment-gateways/types.ts` — common interface:
  ```typescript
  interface PaymentGateway {
    createOrder(params: { amount: number; currency: string; invoiceId: string; receipt: string }): Promise<GatewayOrder>
    verifyPayment(params: VerifyParams): Promise<{ verified: boolean; transactionId: string }>
    verifyWebhook(body: string, signature: string, secret: string): boolean
    getCheckoutConfig(order: GatewayOrder): CheckoutConfig  // returns data needed by frontend
    initiateRefund(params: { paymentId: string; amount: number }): Promise<RefundResult>
  }
  ```
- **File:** `lib/payment-gateways/razorpay.ts` — Razorpay adapter implementing the interface
  - `npm i razorpay`
  - Uses hospital's own `key_id` + `key_secret` (fetched from DB per request)
  - `createOrder` → `razorpay.orders.create()`
  - `verifyPayment` → HMAC SHA256 signature check
  - `getCheckoutConfig` → returns `{ provider: 'razorpay', key_id, orderId, amount, currency }`
- **File:** `lib/payment-gateways/phonepe.ts` — PhonePe PG adapter
  - PhonePe uses REST API (no npm package needed — use `fetch`)
  - `createOrder` → POST to PhonePe Pay API, returns redirect URL or payment instrument
  - `verifyPayment` → SHA256 checksum verification with `saltKey` + `saltIndex`
  - `getCheckoutConfig` → returns `{ provider: 'phonepe', redirectUrl, merchantTransactionId }`
- **File:** `lib/payment-gateways/paytm.ts` — Paytm PG adapter
  - `npm i paytmchecksum` (official Paytm checksum utility)
  - `createOrder` → Paytm initiate transaction API
  - `verifyPayment` → checksum verification with `merchantKey`
  - `getCheckoutConfig` → returns `{ provider: 'paytm', txnToken, orderId, mid }`
- **File:** `lib/payment-gateways/index.ts` — factory function:
  ```typescript
  function getGateway(provider: string, credentials: GatewayCredentials): PaymentGateway
  ```
  - Reads hospital's `paymentGateway` + credentials from DB
  - Returns the correct adapter instance initialized with hospital's own credentials

### 1.2 Payment Order API
- **File:** `app/api/payments/create-order/route.ts`
- POST: accepts `invoiceId` + `amount`
- Fetches hospital's active gateway + credentials from `PaymentGatewayConfig` table
- Calls `gateway.createOrder()` using hospital's own credentials
- Returns provider-specific checkout config for the frontend
- Validates: amount matches invoice balance, invoice belongs to hospital

### 1.3 Payment Verification API
- **File:** `app/api/payments/verify/route.ts`
- POST: receives provider-specific verification params
- Fetches hospital's gateway, calls `gateway.verifyPayment()`
- On success: creates Payment record, updates Invoice `paidAmount`/`balanceAmount`/`status`
- Stores `gatewayOrderId`, `gatewayPaymentId` on Payment record

### 1.4 Webhook Handlers (per gateway)
- **File:** `app/api/webhooks/payment/[provider]/route.ts` — dynamic route handles all 3 gateways
- POST: receives webhook from Razorpay/PhonePe/Paytm
- Looks up hospital by `gatewayOrderId` in payment records
- Calls `gateway.verifyWebhook()` to validate signature
- Updates Payment/Invoice status for async confirmations
- Handles: `payment.captured`, `payment.failed`, `refund.processed` equivalent events per provider

### 1.5 Frontend Checkout Component (Multi-Gateway)
- **File:** `components/billing/payment-checkout.tsx`
- Client component that adapts to whichever gateway the hospital uses:
  - **Razorpay:** loads `checkout.js` via script tag → opens modal
  - **PhonePe:** redirects to PhonePe payment page (or opens intent on mobile)
  - **Paytm:** loads Paytm checkout.js → opens modal
- Props: `invoiceId`, `amount`, `patientName`, `patientEmail`, `patientPhone`
- Fetches checkout config from `/api/payments/create-order` → renders correct gateway UI
- On success: calls verify API, shows toast, refreshes invoice
- Handles: payment failure with retry, timeout, user cancellation

### 1.6 Invoice Page Integration
- **Modify:** `app/(dashboard)/billing/invoices/[id]/page.tsx`
- Add "Pay Online" button (only shown when hospital has a gateway configured)
- Opens the multi-gateway checkout component for the invoice balance amount
- After successful payment, refresh invoice data

### 1.7 Payment Gateway Settings (Hospital Admin)
- **Modify:** `app/(dashboard)/settings/billing/page.tsx` — add "Payment Gateway" section:
  - Dropdown: select gateway provider (Razorpay / PhonePe / Paytm / None)
  - Dynamic credential fields based on selected provider:
    - Razorpay: Key ID, Key Secret
    - PhonePe: Merchant ID, Salt Key, Salt Index
    - Paytm: Merchant ID, Merchant Key, Website (WEBSTAGING/DEFAULT)
  - Toggle: Enable/disable online payments
  - Test connection button: makes a small test API call to verify credentials are valid
  - Webhook URL display: shows the URL the hospital must configure in their Razorpay/PhonePe/Paytm dashboard
  - Environment toggle: Test / Live mode
- **Modify:** `app/api/settings/billing/route.ts` — save gateway config (credentials encrypted before storage)

### 1.8 Schema Changes
```prisma
model PaymentGatewayConfig {
  id              String   @id @default(cuid())
  hospitalId      String   @unique
  provider        PaymentProvider
  isEnabled       Boolean  @default(false)
  isLiveMode      Boolean  @default(false)  // false = test/sandbox

  // Razorpay
  razorpayKeyId       String?
  razorpayKeySecret   String?  // Encrypted at rest

  // PhonePe
  phonepeMerchantId   String?
  phonepeSaltKey      String?  // Encrypted at rest
  phonepeSaltIndex    String?

  // Paytm
  paytmMid            String?
  paytmMerchantKey    String?  // Encrypted at rest
  paytmWebsite        String?  // WEBSTAGING or DEFAULT

  webhookSecret       String?  // For verifying incoming webhooks
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  hospital            Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
}

enum PaymentProvider {
  RAZORPAY
  PHONEPE
  PAYTM
}

// Add to Payment model:
  gateway           String?    // razorpay / phonepe / paytm
  gatewayOrderId    String?    // Provider's order/transaction ID
  gatewayPaymentId  String?    // Provider's payment ID
  gatewayStatus     String?    // Provider-reported status
```

### 1.9 Credential Encryption
- **File:** `lib/encryption.ts`
- AES-256-GCM encryption for gateway secrets at rest
- Uses `ENCRYPTION_KEY` env var (32-byte key)
- `encrypt(plaintext)` → `iv:ciphertext:tag` string
- `decrypt(encrypted)` → plaintext
- Applied when saving/reading gateway credentials to/from DB

### 1.10 Payment Link Generation (Share with Patient)
- **File:** `app/api/payments/link/route.ts`
- POST: generates a short-lived payment link for an invoice
- Returns URL: `/pay/{token}` — patient opens in browser, sees invoice summary, pays
- **File:** `app/pay/[token]/page.tsx` — public payment page (no auth required)
  - Shows: clinic name, invoice number, amount, patient name
  - Opens correct gateway checkout
  - On success: shows receipt, sends confirmation SMS
- Staff can copy link and share via WhatsApp/SMS from the invoice page

---

## PHASE 2: Patient Portal & Online Booking

### Why second
Patient portal is the foundation for self-service booking, intake forms, bill pay, and prescription access.

### 2.1 Patient Authentication System
- **File:** `lib/patient-auth.ts`
- Separate auth flow from staff auth (patients are NOT User records)
- OTP-based login: patient enters phone → receives OTP via SMS → verifies → gets JWT
- JWT stored in httpOnly cookie, contains `patientId`, `hospitalId`
- Helper: `getAuthenticatedPatient()` — validates JWT, returns patient context

### 2.2 Patient Auth API Routes
- **File:** `app/api/patient-portal/auth/send-otp/route.ts` — POST: sends OTP to patient phone
- **File:** `app/api/patient-portal/auth/verify-otp/route.ts` — POST: verifies OTP, returns JWT
- **File:** `app/api/patient-portal/auth/logout/route.ts` — POST: clears cookie

### 2.3 Schema Changes
```prisma
model PatientOTP {
  id          String   @id @default(cuid())
  hospitalId  String
  phone       String
  otp         String
  expiresAt   DateTime
  verified    Boolean  @default(false)
  attempts    Int      @default(0)
  createdAt   DateTime @default(now())

  @@index([phone, hospitalId])
  @@index([expiresAt])
}
```

### 2.4 Patient Portal Pages
- **File:** `app/portal/login/page.tsx` — Phone + OTP login (no layout chrome, branded with clinic logo)
- **File:** `app/portal/layout.tsx` — Portal layout with clinic branding, patient nav (Dashboard, Appointments, Records, Bills, Prescriptions)
- **File:** `app/portal/page.tsx` — Patient dashboard: upcoming appointments, recent prescriptions, outstanding bills
- **File:** `app/portal/appointments/page.tsx` — View appointments + Book New button
- **File:** `app/portal/records/page.tsx` — View treatment history, dental chart (read-only), documents
- **File:** `app/portal/bills/page.tsx` — View invoices, pay online (Razorpay from Phase 1)
- **File:** `app/portal/prescriptions/page.tsx` — View/download prescriptions

### 2.5 Patient Portal API Routes
- **File:** `app/api/patient-portal/dashboard/route.ts` — GET: upcoming appts, recent treatments, balance
- **File:** `app/api/patient-portal/appointments/route.ts` — GET: list appointments; POST: book new
- **File:** `app/api/patient-portal/records/route.ts` — GET: treatments, chart entries, documents
- **File:** `app/api/patient-portal/bills/route.ts` — GET: invoices with balance
- **File:** `app/api/patient-portal/prescriptions/route.ts` — GET: prescriptions list
- All routes use `getAuthenticatedPatient()`, scoped to patient's own data only

### 2.6 Public Booking Widget
- **File:** `app/portal/book/page.tsx`
- Step 1: Select doctor (from hospital's active staff with DOCTOR role)
- Step 2: Select date → fetch available slots from `/api/appointments/slots` (make this endpoint public with hospital slug)
- Step 3: Confirm → creates appointment with status REQUESTED (staff must approve)
- **File:** `app/api/public/[slug]/slots/route.ts` — public slot availability by hospital slug
- **File:** `app/api/public/[slug]/book/route.ts` — public booking endpoint (requires patient phone verification)

### 2.7 Portal Access Settings
- **Modify:** `app/(dashboard)/settings/page.tsx` — toggle: "Enable Patient Portal"
- **Modify:** Hospital model: add `patientPortalEnabled Boolean @default(false)`
- Show portal URL to staff: `{domain}/portal?clinic={slug}`

---

## PHASE 3: Online Intake Forms & Digital Consent

### 3.1 Form Builder Schema
```prisma
model FormTemplate {
  id          String         @id @default(cuid())
  hospitalId  String
  name        String
  type        FormType
  fields      Json           // Array of field definitions
  isActive    Boolean        @default(true)
  isDefault   Boolean        @default(false)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  hospital    Hospital       @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  submissions FormSubmission[]

  @@index([hospitalId])
  @@index([type])
}

model FormSubmission {
  id            String       @id @default(cuid())
  hospitalId    String
  templateId    String
  patientId     String?
  appointmentId String?

  data          Json         // Submitted form data
  signature     String?      @db.Text  // Base64 signature image
  signedAt      DateTime?
  ipAddress     String?

  status        FormSubmissionStatus @default(SUBMITTED)
  reviewedBy    String?
  reviewedAt    DateTime?

  createdAt     DateTime     @default(now())

  hospital      Hospital     @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  template      FormTemplate @relation(fields: [templateId], references: [id])

  @@index([hospitalId])
  @@index([patientId])
  @@index([appointmentId])
}

enum FormType {
  MEDICAL_HISTORY
  CONSENT
  INTAKE
  FEEDBACK
  CUSTOM
}

enum FormSubmissionStatus {
  SUBMITTED
  REVIEWED
  APPROVED
  REJECTED
}
```

### 3.2 Form Template Builder (Admin)
- **File:** `app/(dashboard)/settings/forms/page.tsx` — list all form templates
- **File:** `app/(dashboard)/settings/forms/new/page.tsx` — drag-and-drop form builder
  - Field types: text, textarea, number, date, select, checkbox, radio, signature, file upload
  - Each field: label, placeholder, required flag, validation rules
  - Preview mode
- **File:** `app/api/settings/forms/route.ts` — CRUD for form templates
- **File:** `app/api/settings/forms/[id]/route.ts` — GET/PUT/DELETE single template

### 3.3 Digital Signature Component
- **File:** `components/forms/signature-pad.tsx`
- Canvas-based signature capture (use HTML5 Canvas API — no external library needed)
- Touch and mouse support
- Clear/redo controls
- Outputs base64 PNG string
- "I agree" checkbox + date stamp

### 3.4 Form Renderer Component
- **File:** `components/forms/form-renderer.tsx`
- Takes a FormTemplate `fields` JSON array, renders each field dynamically
- Validates required fields before submission
- Includes SignaturePad at bottom for consent forms
- Generates FormSubmission on submit

### 3.5 Patient Portal Integration
- **File:** `app/portal/forms/page.tsx` — list pending forms for the patient
- **File:** `app/portal/forms/[id]/page.tsx` — fill and submit a form
- After patient books appointment → automatically assign intake + consent forms
- Reminder SMS: "Please complete your forms before your visit"

### 3.6 Staff-Side Form Review
- **Modify:** `app/(dashboard)/patients/[id]/page.tsx` — add "Forms" tab showing all submissions
- **Modify:** `app/(dashboard)/appointments/[id]/page.tsx` — show form completion status
- Review/approve workflow for submitted forms

### 3.7 Consent Form Templates (Pre-built)
- Seed 3 default templates per hospital:
  1. General Dental Consent
  2. Extraction / Surgical Consent
  3. Patient Registration / Intake Form
- Each with standard fields (procedure description, risks, alternatives, signature, date)

### 3.8 Nav Update
- **Modify:** `config/nav.ts` — add "Forms" under Settings subItems

---

## PHASE 4: Insurance Eligibility & Enhanced Claims

### 4.1 Insurance Provider Master
```prisma
model InsuranceProvider {
  id              String   @id @default(cuid())
  hospitalId      String
  name            String
  code            String?              // Provider code for API integration
  contactPhone    String?
  contactEmail    String?
  website         String?
  claimSubmissionUrl String?
  portalUsername   String?
  portalPassword  String?              // Encrypted
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  hospital        Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  policies        PatientInsurance[]

  @@index([hospitalId])
}

model PatientInsurance {
  id                  String    @id @default(cuid())
  hospitalId          String
  patientId           String
  providerId          String
  policyNumber        String
  groupNumber         String?
  memberId            String
  subscriberName      String
  subscriberRelation  String    @default("Self")
  effectiveDate       DateTime
  expiryDate          DateTime?
  coverageType        String?   // Individual / Family
  annualMaximum       Decimal?  @db.Decimal(10, 2)
  usedAmount          Decimal?  @db.Decimal(10, 2)
  remainingAmount     Decimal?  @db.Decimal(10, 2)
  deductible          Decimal?  @db.Decimal(10, 2)
  deductibleMet       Boolean   @default(false)
  copayPercentage     Decimal?  @db.Decimal(5, 2)
  isActive            Boolean   @default(true)
  lastVerifiedAt      DateTime?
  verificationStatus  String?   // VERIFIED / EXPIRED / PENDING

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  hospital            Hospital  @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  patient             Patient   @relation(fields: [patientId], references: [id])
  provider            InsuranceProvider @relation(fields: [providerId], references: [id])

  @@index([hospitalId])
  @@index([patientId])
}

model PreAuthorization {
  id              String   @id @default(cuid())
  hospitalId      String
  patientId       String
  insurancePolicyId String
  treatmentPlanId String?

  authNumber      String?
  requestDate     DateTime @default(now())
  procedures      Json     // Array of procedure codes + descriptions
  estimatedCost   Decimal  @db.Decimal(10, 2)
  status          PreAuthStatus @default(PENDING)
  approvedAmount  Decimal? @db.Decimal(10, 2)
  approvedDate    DateTime?
  expiryDate      DateTime?
  denialReason    String?
  notes           String?  @db.Text

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  hospital        Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)

  @@index([hospitalId])
  @@index([patientId])
  @@index([status])
}

enum PreAuthStatus {
  PENDING
  SUBMITTED
  APPROVED
  DENIED
  EXPIRED
}
```

### 4.2 Insurance Provider Management
- **File:** `app/(dashboard)/billing/insurance/providers/page.tsx` — CRUD for insurance companies
- **File:** `app/api/insurance-providers/route.ts` — GET/POST
- **File:** `app/api/insurance-providers/[id]/route.ts` — GET/PUT/DELETE

### 4.3 Patient Insurance Profile
- **Modify:** `app/(dashboard)/patients/[id]/page.tsx` — add "Insurance" tab
- Shows active policies, coverage limits, remaining benefits
- Add/edit insurance information linked to InsuranceProvider master
- **File:** `app/api/patients/[id]/insurance/route.ts` — CRUD for PatientInsurance

### 4.4 Eligibility Verification
- **File:** `lib/services/insurance-verification.ts`
- Manual verification: staff enters details, marks as verified with date
- Automated placeholder: structured to accept future API integration (e.g., Vericle, DentalXChange)
- Stores verification result on PatientInsurance record
- **File:** `app/api/patients/[id]/insurance/verify/route.ts` — POST: trigger verification

### 4.5 Pre-Authorization Workflow
- **File:** `app/(dashboard)/billing/insurance/pre-auth/page.tsx` — list pre-auths with status filters
- **File:** `app/(dashboard)/billing/insurance/pre-auth/new/page.tsx` — create pre-auth request
  - Select patient → select insurance policy → select procedures from treatment plan
  - Auto-calculate estimated cost from procedure prices
  - Generate pre-auth document (PDF-ready)
- **File:** `app/api/pre-authorizations/route.ts` — GET/POST
- **File:** `app/api/pre-authorizations/[id]/route.ts` — GET/PUT (update status)

### 4.6 Enhanced Claims Workflow
- **Modify:** `app/(dashboard)/billing/insurance/page.tsx` — add denial management section
- Denial tracking: reason codes, appeal deadline, appeal status
- Claims aging report: 0-30, 31-60, 61-90, 90+ days
- **Modify:** InsuranceClaim model — add `denialCode`, `appealDeadline`, `appealStatus`, `appealDate`, `appealNotes` fields

### 4.7 Insurance Dashboard Widget
- **Modify:** `app/(dashboard)/billing/page.tsx` — add insurance summary card
- Shows: pending claims count, total outstanding, denial rate, avg settlement time

### 4.8 Nav Update
- **Modify:** `config/nav.ts` — expand Insurance under Billing subItems: "Claims", "Pre-Auth", "Providers"

---

## PHASE 5: CRM, Loyalty & Referral Program

### 5.1 Schema Changes
```prisma
model MembershipPlan {
  id            String   @id @default(cuid())
  hospitalId    String
  name          String
  description   String?  @db.Text
  price         Decimal  @db.Decimal(10, 2)
  duration      Int      // months
  benefits      Json     // Array of { procedureId?, category?, discountPercent, description }
  maxMembers    Int?     // family plan limit
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  hospital      Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  memberships   PatientMembership[]

  @@index([hospitalId])
}

model PatientMembership {
  id            String   @id @default(cuid())
  hospitalId    String
  patientId     String
  planId        String
  startDate     DateTime
  endDate       DateTime
  status        MembershipStatus @default(ACTIVE)
  paymentId     String?  // Link to Payment record
  autoRenew     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  hospital      Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  patient       Patient  @relation(fields: [patientId], references: [id])
  plan          MembershipPlan @relation(fields: [planId], references: [id])

  @@index([hospitalId])
  @@index([patientId])
  @@index([status])
}

model Referral {
  id              String   @id @default(cuid())
  hospitalId      String
  referrerPatientId String
  referredPatientId String?
  referredName    String
  referredPhone   String
  referralCode    String   @unique
  status          ReferralStatus @default(PENDING)
  rewardType      String?  // DISCOUNT / CREDIT / POINTS
  rewardValue     Decimal? @db.Decimal(10, 2)
  rewardGiven     Boolean  @default(false)
  rewardGivenAt   DateTime?
  convertedAt     DateTime?
  createdAt       DateTime @default(now())

  hospital        Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)

  @@index([hospitalId])
  @@index([referrerPatientId])
  @@index([referralCode])
}

model LoyaltyTransaction {
  id            String   @id @default(cuid())
  hospitalId    String
  patientId     String
  points        Int      // positive = earned, negative = redeemed
  type          String   // VISIT, REFERRAL, TREATMENT, REDEMPTION, BIRTHDAY, SIGNUP
  description   String
  referenceId   String?  // appointmentId, referralId, etc.
  createdAt     DateTime @default(now())

  hospital      Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)

  @@index([hospitalId])
  @@index([patientId])
}

enum MembershipStatus {
  ACTIVE
  EXPIRED
  CANCELLED
  SUSPENDED
}

enum ReferralStatus {
  PENDING
  CONVERTED
  EXPIRED
  REWARDED
}
```

### 5.2 Membership Plans (Admin)
- **File:** `app/(dashboard)/crm/memberships/page.tsx` — list/create membership plans
- **File:** `app/(dashboard)/crm/memberships/[id]/page.tsx` — plan details + enrolled patients
- **File:** `app/api/memberships/plans/route.ts` — CRUD for plans
- **File:** `app/api/memberships/enroll/route.ts` — POST: enroll patient in plan
- Auto-apply discounts during billing when patient has active membership

### 5.3 Loyalty Points System
- **File:** `app/(dashboard)/crm/loyalty/page.tsx` — loyalty settings + transaction log
- **File:** `app/api/loyalty/route.ts` — GET patient points; POST earn/redeem
- **File:** `lib/services/loyalty.service.ts`
  - Rules engine: points per visit, points per treatment amount, birthday bonus, referral bonus
  - Redemption: points → discount on invoice
  - Auto-award on appointment completion (hook into existing appointment flow)

### 5.4 Referral Program
- **File:** `app/(dashboard)/crm/referrals/page.tsx` — referral dashboard + tracking
- **File:** `app/api/referrals/route.ts` — GET/POST referrals
- Generate unique referral codes per patient
- Track conversion: when referred person becomes a patient, mark as converted
- Auto-reward referrer (discount credit or loyalty points)
- **Modify:** `app/(dashboard)/patients/new/page.tsx` — referral code field on registration

### 5.5 Patient Segmentation
- **File:** `app/(dashboard)/crm/segments/page.tsx` — create/view segments
- **File:** `app/api/crm/segments/route.ts`
- Segment criteria: visit frequency, last visit date, age range, treatment types, spend amount, membership status
- Use segments for targeted communications (link to existing bulk SMS/email)

### 5.6 CRM Dashboard
- **File:** `app/(dashboard)/crm/page.tsx` — overview dashboard
  - Active memberships count + revenue
  - Loyalty points in circulation
  - Referral conversion rate
  - Patient retention rate (visited in last 6 months / total active)
  - At-risk patients (no visit in 6+ months)

### 5.7 Nav Update
- **Modify:** `config/nav.ts` — add "CRM" section with icon `Heart`:
  - Dashboard, Memberships, Loyalty, Referrals, Segments

---

## PHASE 6: Image Viewer & Annotation Tools

### 6.1 Image Viewer Component
- **File:** `components/imaging/image-viewer.tsx`
- Full-screen modal viewer for X-rays, photos, CT scans
- Features: zoom (scroll wheel), pan (drag), rotate, flip, brightness/contrast sliders
- Navigation: previous/next image arrows
- Uses native HTML5 Canvas for transformations (no external library)
- Fullscreen toggle

### 6.2 Image Annotation Component
- **File:** `components/imaging/image-annotator.tsx`
- Built on top of image-viewer with annotation layer (second canvas overlay)
- Tools: freehand draw, line, arrow, circle, rectangle, text label
- Color picker for annotation color
- Save annotations as JSON (array of annotation objects with type, coordinates, color, text)
- Load/display existing annotations

### 6.3 Annotation Storage
```prisma
// Add to Document model:
  annotations   Json?    // Array of annotation objects
  annotatedBy   String?  // userId who annotated
  annotatedAt   DateTime?
```
- **File:** `app/api/patients/[id]/documents/[documentId]/annotations/route.ts` — PUT: save annotations

### 6.4 Before/After Comparison
- **File:** `components/imaging/image-compare.tsx`
- Side-by-side mode: two images with synchronized zoom/pan
- Slider overlay mode: drag slider to reveal before/after
- Select two images from patient's documents to compare

### 6.5 Integration Points
- **Modify:** `app/(dashboard)/patients/[id]/page.tsx` — replace simple document list with image viewer
- Click any X-ray/photo document → opens image viewer modal
- "Compare" button to select two images
- "Annotate" button to open annotation mode (DOCTOR/ADMIN only)

---

## PHASE 7: Calendar Sync & Smart Scheduling

### 7.1 Google Calendar Integration
- **Install:** `npm i googleapis`
- **File:** `lib/services/google-calendar.ts`
  - OAuth2 flow for Google Calendar access
  - Sync appointments → Google Calendar events (two-way)
  - Create/update/delete events when appointments change
- **File:** `app/api/integrations/google-calendar/auth/route.ts` — OAuth redirect
- **File:** `app/api/integrations/google-calendar/callback/route.ts` — OAuth callback, store refresh token
- **File:** `app/api/integrations/google-calendar/sync/route.ts` — POST: trigger sync

### 7.2 Schema Changes
```prisma
model CalendarIntegration {
  id             String   @id @default(cuid())
  hospitalId     String
  userId         String
  provider       String   // GOOGLE / OUTLOOK
  accessToken    String   @db.Text
  refreshToken   String   @db.Text
  calendarId     String?
  syncEnabled    Boolean  @default(true)
  lastSyncAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  hospital       Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  user           User     @relation(fields: [userId], references: [id])

  @@unique([userId, provider])
  @@index([hospitalId])
}
```

### 7.3 Smart Scheduling — Auto-Fill Cancellations
- **File:** `lib/services/smart-scheduler.ts`
  - When appointment is cancelled: find patients on waitlist for same doctor/time window
  - Auto-send SMS: "A slot opened up on {date} at {time} with Dr. {name}. Reply YES to book."
  - Track responses, auto-book first YES
- **Modify:** `app/api/appointments/[id]/route.ts` — on cancellation, trigger smart-scheduler

### 7.4 Waitlist
```prisma
model Waitlist {
  id          String   @id @default(cuid())
  hospitalId  String
  patientId   String
  doctorId    String?
  preferredDays  Json?  // ["MONDAY", "WEDNESDAY"]
  preferredTime  String? // "MORNING" | "AFTERNOON" | "EVENING"
  procedureId String?
  notes       String?
  status      WaitlistStatus @default(ACTIVE)
  notifiedAt  DateTime?
  bookedAt    DateTime?
  createdAt   DateTime @default(now())

  hospital    Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)

  @@index([hospitalId])
  @@index([status])
}

enum WaitlistStatus {
  ACTIVE
  NOTIFIED
  BOOKED
  CANCELLED
  EXPIRED
}
```
- **File:** `app/(dashboard)/appointments/waitlist/page.tsx` — manage waitlist
- **File:** `app/api/appointments/waitlist/route.ts` — GET/POST/DELETE

### 7.5 Settings
- **Modify:** `app/(dashboard)/settings/page.tsx` — add "Integrations" section
- Google Calendar connect/disconnect toggle per user

---

## PHASE 8: Payment Plans & Revenue Cycle

### 8.1 Payment Plan Schema
```prisma
model PaymentPlan {
  id              String   @id @default(cuid())
  hospitalId      String
  invoiceId       String
  patientId       String
  totalAmount     Decimal  @db.Decimal(10, 2)
  downPayment     Decimal  @default(0) @db.Decimal(10, 2)
  installments    Int
  frequency       PlanFrequency @default(MONTHLY)
  interestRate    Decimal  @default(0) @db.Decimal(5, 2)
  status          PaymentPlanStatus @default(ACTIVE)
  startDate       DateTime
  nextDueDate     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  hospital        Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  invoice         Invoice  @relation(fields: [invoiceId], references: [id])
  schedules       PaymentPlanSchedule[]

  @@index([hospitalId])
  @@index([patientId])
  @@index([status])
}

model PaymentPlanSchedule {
  id            String   @id @default(cuid())
  planId        String
  installmentNo Int
  amount        Decimal  @db.Decimal(10, 2)
  dueDate       DateTime
  paidDate      DateTime?
  paymentId     String?
  status        InstallmentStatus @default(PENDING)

  plan          PaymentPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@index([planId])
  @@index([dueDate])
}

enum PlanFrequency {
  WEEKLY
  BIWEEKLY
  MONTHLY
}

enum PaymentPlanStatus {
  ACTIVE
  COMPLETED
  DEFAULTED
  CANCELLED
}

enum InstallmentStatus {
  PENDING
  PAID
  OVERDUE
  WAIVED
}
```

### 8.2 Payment Plan UI
- **File:** `app/(dashboard)/billing/payment-plans/page.tsx` — list active plans
- **File:** `app/(dashboard)/billing/payment-plans/new/page.tsx` — create plan for invoice
  - Select invoice → enter installment count, frequency, down payment, interest
  - Auto-generate schedule with due dates
  - Preview schedule before confirming
- **File:** `app/(dashboard)/billing/payment-plans/[id]/page.tsx` — plan detail + schedule + payment history
- **File:** `app/api/payment-plans/route.ts` — GET/POST
- **File:** `app/api/payment-plans/[id]/route.ts` — GET/PUT

### 8.3 Auto-Reminders for Payment Plans
- **Modify:** `app/api/cron/collections/route.ts` — add payment plan installment reminders
- 3 days before due: SMS reminder
- On due date: SMS + email
- 3 days overdue: escalation notification

### 8.4 Revenue Cycle Dashboard
- **Modify:** `app/(dashboard)/billing/page.tsx` — add revenue cycle section
  - Claims aging chart (0-30, 31-60, 61-90, 90+ days)
  - Denial rate trend
  - Collection rate
  - Outstanding payment plans
  - Cash flow timeline (daily/weekly/monthly)

---

## PHASE 9: Tele-Dentistry & Video Consultation

### 9.1 Video Call Infrastructure
- **Option A (Recommended):** Daily.co — simple embed API, no WebRTC complexity
  - `npm i @daily-co/daily-js`
  - Create rooms via Daily REST API
  - Embed video in an iframe or use Daily's React component
- **Option B:** Jitsi Meet — open-source, self-hostable, iframe embed
- **Env vars:** `DAILY_API_KEY` (or `JITSI_DOMAIN`)

### 9.2 Schema Changes
```prisma
model VideoConsultation {
  id              String   @id @default(cuid())
  hospitalId      String
  appointmentId   String?  @unique
  patientId       String
  doctorId        String
  roomUrl         String              // Video room URL
  roomName        String
  status          ConsultationStatus  @default(SCHEDULED)
  scheduledAt     DateTime
  startedAt       DateTime?
  endedAt         DateTime?
  duration        Int?                // minutes
  notes           String?  @db.Text   // Doctor's consultation notes
  recordingUrl    String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  hospital        Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)

  @@index([hospitalId])
  @@index([doctorId])
  @@index([patientId])
  @@index([status])
}

enum ConsultationStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
}
```
- **Modify:** Appointment model — add `isVirtual Boolean @default(false)`, `videoConsultationId String?`

### 9.3 Video Room Management
- **File:** `lib/services/video.service.ts`
  - `createRoom(appointmentId)` — creates Daily.co room, returns URL
  - `deleteRoom(roomName)` — cleanup after consultation ends
  - `getRoomToken(roomName, isDoctor)` — generate meeting token with role
- **File:** `app/api/video/room/route.ts` — POST: create room; DELETE: cleanup
- **File:** `app/api/video/token/route.ts` — GET: generate join token for participant

### 9.4 Video Consultation UI
- **File:** `components/video/video-room.tsx`
  - Embeds Daily.co prebuilt UI (or custom controls: mute, camera, screen share, end call)
  - Doctor view: patient info sidebar, notes area, dental chart quick reference
  - Timer showing call duration
- **File:** `app/(dashboard)/video/[id]/page.tsx` — doctor's video consultation page
- **File:** `app/portal/video/[id]/page.tsx` — patient's video consultation page

### 9.5 Appointment Integration
- **Modify:** `app/(dashboard)/appointments/new/page.tsx` — add "Virtual Visit" toggle
- When virtual: auto-create video room, include room URL in confirmation SMS
- **Modify:** `app/(dashboard)/appointments/[id]/page.tsx` — "Join Video Call" button for virtual appointments

### 9.6 Patient Photo Upload for Triage
- **File:** `app/portal/upload-photo/page.tsx` — patient uploads intraoral photo
- **File:** `app/api/patient-portal/upload-photo/route.ts` — stores as Document, notifies doctor
- Doctor reviews photo → decides if in-person visit needed

---

## PHASE 10: Advanced AI Features

### 10.1 Predictive No-Show Management
- **File:** `lib/ai/skills/no-show-predictor.ts`
  - Analyzes per-patient: past no-show rate, appointment day/time, weather (optional), gap since last visit
  - Assigns risk score (0-100) per upcoming appointment
  - For high-risk (>70): auto-send extra reminder, suggest overbooking
- **File:** `app/api/ai/no-show-risk/route.ts` — GET: returns risk scores for upcoming appointments
- **Modify:** `app/(dashboard)/appointments/page.tsx` — show risk badge on high-risk appointments
- **Modify:** `app/api/cron/reminders/route.ts` — send extra reminder for high-risk appointments

### 10.2 AI Inventory Demand Forecasting
- **File:** `lib/ai/skills/inventory-forecaster.ts`
  - Analyzes consumption history (StockTransaction) over past 6 months
  - Projects next 30/60/90 day usage per item
  - Generates reorder suggestions with quantities
  - Considers seasonal patterns and appointment volume trends
- **File:** `app/api/ai/inventory-forecast/route.ts` — GET: forecasted demand + reorder suggestions
- **Modify:** `app/(dashboard)/inventory/page.tsx` — add "AI Forecast" tab with predicted usage chart and reorder list
- **Modify:** `app/api/cron/inventory/route.ts` — generate weekly forecast insight

### 10.3 AI Cash-Flow Forecasting
- **File:** `lib/ai/skills/cashflow-forecaster.ts`
  - Analyzes: past revenue, payment patterns, upcoming appointments, pending claims, payment plan schedules
  - Projects daily/weekly income for next 30 days
  - Flags potential cash shortfalls
- **File:** `app/api/ai/cashflow-forecast/route.ts` — GET: forecast data
- **Modify:** `app/(dashboard)/billing/page.tsx` — add cash flow forecast chart

### 10.4 AI Patient Segmentation & Churn Prediction
- **File:** `lib/ai/skills/patient-segmentation.ts`
  - RFM analysis: Recency, Frequency, Monetary value per patient
  - Segments: VIP, Loyal, At-Risk, Lost, New
  - Churn risk score: probability of not returning
- **File:** `app/api/ai/patient-segments/route.ts` — GET: segmented patient lists
- **Modify:** `app/(dashboard)/crm/segments/page.tsx` — display AI-generated segments with counts

### 10.5 AI Claim Denial Analysis
- **File:** `lib/ai/skills/claim-analyzer.ts`
  - Analyzes denied claims: common denial codes, provider patterns, procedure correlations
  - Suggests corrections for resubmission
  - Generates appeal letter drafts
- **File:** `app/api/ai/claim-analysis/route.ts` — POST: analyze denied claim → suggestions
- **Modify:** `app/(dashboard)/billing/insurance/page.tsx` — "AI Analyze" button on denied claims

### 10.6 Voice Input for Clinical Notes
- **File:** `components/clinical/voice-input.tsx`
  - Uses Web Speech API (`window.SpeechRecognition`) — no external service needed
  - Continuous recognition mode for hands-free dictation
  - Real-time transcription display
  - Insert button to add transcribed text to any textarea
  - Language: English (en-IN for Indian accent support)
- **Modify:** `app/(dashboard)/treatments/[id]/page.tsx` — add microphone icon on clinical notes textarea
- **Modify:** `app/(dashboard)/treatments/new/page.tsx` — voice input on treatment notes

---

## PHASE 11: Campaign Analytics & Marketing Automation

### 11.1 Campaign Analytics Dashboard
- **File:** `app/(dashboard)/communications/analytics/page.tsx`
  - SMS delivery rate, failure breakdown
  - Email open rate (track via pixel), click rate
  - Campaign comparison charts
  - Cost per message tracking
- **File:** `app/api/communications/analytics/route.ts` — GET: aggregated stats from SMSLog/EmailLog

### 11.2 Schema Changes
```prisma
// Add to EmailLog model:
  openedAt      DateTime?
  clickedAt     DateTime?
  trackingId    String?    @unique  // UUID for open tracking pixel

// Add to SMSLog model:
  costAmount    Decimal?   @db.Decimal(6, 4)  // Per-message cost
```

### 11.3 Email Open Tracking
- **File:** `app/api/track/email/[id]/route.ts` — GET: 1x1 transparent pixel, updates `openedAt`
- Embed tracking pixel URL in outgoing HTML emails

### 11.4 Marketing Automation Workflows
- **File:** `app/(dashboard)/communications/automations/page.tsx`
  - Rule builder: IF trigger THEN action
  - Triggers: no visit in X days, birthday in X days, treatment plan pending, membership expiring
  - Actions: send SMS, send email, create notification, add to segment
  - Enable/disable per workflow
- **File:** `app/api/communications/automations/route.ts` — CRUD for automation rules
- **File:** `app/api/cron/automations/route.ts` — runs daily, evaluates all active automation rules

### 11.5 Schema
```prisma
model MarketingAutomation {
  id          String   @id @default(cuid())
  hospitalId  String
  name        String
  trigger     Json     // { type, params } — e.g. { type: "NO_VISIT", params: { days: 180 } }
  action      Json     // { type, params } — e.g. { type: "SEND_SMS", params: { templateId: "..." } }
  isActive    Boolean  @default(true)
  lastRunAt   DateTime?
  runCount    Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  hospital    Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)

  @@index([hospitalId])
  @@index([isActive])
}
```

---

## PHASE 12: Google Reviews & Patient Feedback Analytics

### 12.1 Review Request Automation
- **Modify:** `lib/services/communication-triggers.service.ts`
  - After appointment completion: auto-send SMS with Google Review link
  - Google review URL configurable in clinic settings
  - Only send to patients who rated satisfaction >= 4/5 (from survey) — "review gating"

### 12.2 Feedback Analytics Dashboard
- **File:** `app/(dashboard)/communications/feedback/page.tsx`
  - NPS score trend chart
  - Satisfaction score breakdown by doctor, procedure type, time period
  - Word cloud from open-text feedback
  - Response rate tracking
- **File:** `app/api/communications/feedback/analytics/route.ts` — GET: aggregated survey data

### 12.3 Settings
- **Modify:** `app/(dashboard)/settings/communications/page.tsx`
  - Google Review URL input
  - Toggle: auto-request reviews after appointments
  - Review request delay (hours after appointment)

---

## PHASE 13: Sterilization & Instrument Tracking

### 13.1 Schema
```prisma
model Instrument {
  id            String   @id @default(cuid())
  hospitalId    String
  name          String
  category      String
  serialNumber  String?
  rfidTag       String?
  status        InstrumentStatus @default(AVAILABLE)
  location      String?
  lastSterilizedAt  DateTime?
  sterilizationCycleCount Int @default(0)
  maxCycles     Int?
  purchaseDate  DateTime?
  warrantyDate  DateTime?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  hospital      Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  sterilizationLogs SterilizationLog[]

  @@index([hospitalId])
  @@index([status])
  @@index([rfidTag])
}

model SterilizationLog {
  id            String   @id @default(cuid())
  hospitalId    String
  instrumentId  String
  cycleNumber   Int
  method        String   // AUTOCLAVE, CHEMICAL, DRY_HEAT, UV
  machineId     String?
  temperature   Decimal? @db.Decimal(5, 1)
  pressure      Decimal? @db.Decimal(5, 2)
  duration      Int?     // minutes
  operatorId    String
  result        SterilizationResult @default(PASS)
  biologicalIndicator Boolean @default(false)
  chemicalIndicator   Boolean @default(false)
  notes         String?
  startedAt     DateTime
  completedAt   DateTime?
  createdAt     DateTime @default(now())

  hospital      Hospital   @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  instrument    Instrument @relation(fields: [instrumentId], references: [id])

  @@index([hospitalId])
  @@index([instrumentId])
  @@index([startedAt])
}

enum InstrumentStatus {
  AVAILABLE
  IN_USE
  STERILIZING
  CONTAMINATED
  MAINTENANCE
  RETIRED
}

enum SterilizationResult {
  PASS
  FAIL
  PENDING
}
```

### 13.2 Instrument Management
- **File:** `app/(dashboard)/sterilization/page.tsx` — instrument inventory + sterilization dashboard
- **File:** `app/(dashboard)/sterilization/instruments/page.tsx` — instrument CRUD
- **File:** `app/(dashboard)/sterilization/logs/page.tsx` — sterilization cycle history
- **File:** `app/api/sterilization/instruments/route.ts` — GET/POST
- **File:** `app/api/sterilization/instruments/[id]/route.ts` — GET/PUT/DELETE
- **File:** `app/api/sterilization/logs/route.ts` — GET/POST

### 13.3 Sterilization Workflow
- Staff scans/selects instruments used in procedure
- After procedure: mark instruments as CONTAMINATED
- Record sterilization cycle: method, temperature, duration, indicators
- Auto-update instrument status and cycle count
- Alert when instrument approaching max sterilization cycles

### 13.4 Compliance Reports
- **File:** `app/(dashboard)/sterilization/reports/page.tsx`
  - Sterilization compliance rate
  - Instruments due for maintenance/retirement
  - Cycle history per instrument
  - Biological/chemical indicator pass rates

### 13.5 Nav Update
- **Modify:** `config/nav.ts` — add "Sterilization" under Operations with icon `Shield`

---

## PHASE 14: Consent Form Template Builder (Enhanced)

### 14.1 AI-Powered Consent Generation
- **Modify:** `lib/ai/skills/` — add consent form skill
- Input: procedure name, patient details
- Output: formatted consent document with:
  - Procedure description in plain language
  - Risks and complications
  - Alternative treatments
  - Post-operative instructions
  - Patient acknowledgement statements

### 14.2 PDF Generation
- **Install:** `npm i @react-pdf/renderer` (or use existing approach with print CSS)
- **File:** `lib/services/pdf-generator.ts`
  - Generate PDF from form submissions (consent forms, intake forms)
  - Include clinic letterhead, patient info, signature image, date
  - Store generated PDF as Document
- **File:** `app/api/forms/[id]/pdf/route.ts` — GET: generate and download PDF

### 14.3 E-Signature Audit Trail
- Every signature captured with: timestamp, IP address, user agent, form version
- Immutable audit log entry created on each signature
- **File:** `app/api/forms/[id]/verify/route.ts` — GET: verify signature authenticity (hash check)

---

## PHASE 15: Visionary Features (Future-Ready)

### 15.1 Digital Dental Twin (3D Visualization) — Placeholder Architecture
- **Note:** Full 3D requires Three.js and 3D tooth models — complex but achievable
- **File:** `components/imaging/dental-3d-viewer.tsx` — placeholder component
  - Load pre-built 3D jaw model (GLTF format)
  - Color individual teeth based on DentalChartEntry conditions
  - Interactive rotation/zoom
  - Tooltip: click tooth → show conditions, treatments, notes
- **Install:** `npm i three @react-three/fiber @react-three/drei` (when implementing)
- Start with: 2D SVG interactive tooth map as stepping stone (enhance existing dental chart)

### 15.2 Smart Device / IoT Integration — API Contracts
- **File:** `app/api/devices/register/route.ts` — POST: register a device (ID, type, location)
- **File:** `app/api/devices/data/route.ts` — POST: receive sensor data (vital signs, chair position)
- **File:** `app/api/devices/status/route.ts` — GET: device statuses
- Schema:
```prisma
model Device {
  id          String   @id @default(cuid())
  hospitalId  String
  name        String
  type        String   // DENTAL_CHAIR, PULSE_OXIMETER, BP_MONITOR, AUTOCLAVE
  serialNumber String?
  location    String?
  status      String   @default("OFFLINE")  // ONLINE, OFFLINE, ERROR
  lastPingAt  DateTime?
  metadata    Json?
  createdAt   DateTime @default(now())

  hospital    Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  dataLogs    DeviceDataLog[]

  @@index([hospitalId])
}

model DeviceDataLog {
  id        String   @id @default(cuid())
  deviceId  String
  data      Json     // { heartRate: 72, bp: "120/80", spo2: 98, ... }
  timestamp DateTime @default(now())

  device    Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@index([deviceId])
  @@index([timestamp])
}
```
- This is API-ready; actual device integration depends on hardware vendor SDKs

### 15.3 Dynamic Pricing / Demand-Based Scheduling — AI Skill
- **File:** `lib/ai/skills/dynamic-pricing.ts`
  - Analyze: peak hours (appointments per hour/day), procedure demand, doctor utilization
  - Suggest: off-peak discounts, premium pricing for high-demand slots
  - Generate pricing recommendations (advisory only — not auto-applied)
- **File:** `app/api/ai/pricing-suggestions/route.ts` — GET: pricing recommendations

---

## Implementation Order Summary

| Phase | Features | New Models | New Pages | Priority |
|-------|----------|-----------|-----------|----------|
| 1 | Multi-Gateway Payments (Razorpay/PhonePe/Paytm — hospital-owned) | PaymentGatewayConfig | 1 public pay page | Critical |
| 2 | Patient Portal + Online Booking | PatientOTP | 8 portal pages | Critical |
| 3 | Intake Forms + Digital Consent | FormTemplate, FormSubmission | 4 pages | High |
| 4 | Insurance Eligibility & Claims | InsuranceProvider, PatientInsurance, PreAuthorization | 4 pages | High |
| 5 | CRM, Loyalty & Referrals | MembershipPlan, PatientMembership, Referral, LoyaltyTransaction | 6 pages | High |
| 6 | Image Viewer & Annotations | 0 (modify Document) | 0 (components) | High |
| 7 | Calendar Sync + Smart Scheduling | CalendarIntegration, Waitlist | 2 pages | Medium |
| 8 | Payment Plans & Revenue Cycle | PaymentPlan, PaymentPlanSchedule | 3 pages | Medium |
| 9 | Tele-Dentistry (Video) | VideoConsultation | 3 pages | Medium |
| 10 | Advanced AI Features | 0 | 0 (modify existing) | Medium |
| 11 | Campaign Analytics & Marketing | MarketingAutomation | 2 pages | Medium |
| 12 | Reviews & Feedback Analytics | 0 (modify EmailLog) | 1 page | Low |
| 13 | Sterilization Tracking | Instrument, SterilizationLog | 4 pages | Low |
| 14 | Consent Template Builder + PDF | 0 | 0 (enhance Phase 3) | Low |
| 15 | Visionary (3D, IoT, Dynamic Pricing) | Device, DeviceDataLog | API stubs | Future |

---

## Estimated Totals

- **New Prisma models:** ~25
- **New API routes:** ~50
- **New pages:** ~35
- **New components:** ~15
- **Modified existing files:** ~30
- **New npm packages:** razorpay, paytmchecksum, googleapis, @daily-co/daily-js (or jitsi), three (future)

---

## How To Use This Plan

1. Start with Phase 1 and tell Claude: "Implement Phase 1 — Payment Gateway Integration"
2. After each phase, run `npx prisma generate && npx prisma db push` to apply schema changes
3. Test the feature, then move to the next phase
4. Phases can be done in order or you can skip to any phase — but note dependencies:
   - Phase 2 (Portal) depends on Phase 1 (Payments) for bill pay
   - Phase 3 (Forms) depends on Phase 2 (Portal) for patient-facing forms
   - Phase 5 (CRM) is independent
   - Phase 8 (Payment Plans) depends on Phase 1 (Payments)
   - Phase 10 (AI) depends on Phases 4, 5, 7 for data to analyze
   - All other phases are independent

---

*Generated: 2026-02-08 | Total Features: 30 | Phases: 15*
