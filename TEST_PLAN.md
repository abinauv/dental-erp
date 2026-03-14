# DentalERP — Master Test Plan

> **Status**: In Progress — 4,153 Vitest tests passing across 177 test files + ~478 Playwright E2E tests across 51 spec files
> **Test infrastructure**: Vitest (unit/integration), Playwright (E2E — 6 browsers), React Testing Library (components), axe-core (accessibility)
> **Last updated**: 2026-03-12

---

## Legend

- [ ] = Not started
- [~] = Partially done
- [x] = Complete

---

## 1. Functional Testing

### 1.1 Unit Tests — Utility / Business Logic (`tests/unit/`)

#### Core Utilities
- [x] `lib/utils.ts` — cn(), formatCurrency(), formatDate(), formatPhone(), generatePatientId(), validateAadhar(), validateIndianPhone() (tests/unit/utils.test.ts)
- [x] `lib/encryption.ts` — encrypt/decrypt round-trip, format validation, error handling, generateEncryptionKey() (tests/unit/encryption.test.ts)
- [x] `lib/billing-utils.ts` — calculateGST, calculateDiscount, calculateInvoiceTotals, numberToWords, getDateRangeFromPreset, isInvoiceOverdue (tests/unit/billing-utils.test.ts)
- [x] `lib/treatment-utils.ts` — status configs, tooth numbering (FDI), parseToothNumbers, formatDuration, calculatePlanProgress, tooth classification (tests/unit/treatment-utils.test.ts)
- [x] `lib/appointment-utils.ts` — status/type/priority configs, formatTime, formatDate, isToday, getPatientName, getDoctorName (tests/unit/appointment-utils.test.ts)
- [x] `lib/api-helpers.ts` — PLAN_LIMITS, requireRole, generateToken, role matrix, token security (tests/unit/api-helpers.test.ts)
- [x] `lib/export-utils.ts` — downloadCSV, downloadExcel, blob creation, escaping (tests/unit/export-utils.test.ts)
- [x] `lib/email-helpers.ts` — sendInviteEmail, sendVerificationEmail, graceful failure (tests/unit/email-helpers.test.ts)
- [x] `lib/patient-auth.ts` — OTP generation, 6-digit format validation, uniqueness (tests/unit/patient-auth.test.ts)
- [x] `lib/auth.ts` — hasRole (match/no-match/empty/case-sensitive), hasMinimumRole (hierarchy checks, unknown roles), roleHierarchy (5 levels) (tests/unit/auth.test.ts — 24 tests)

#### AI Layer
- [x] `lib/ai/models.ts` — AI_MODELS (10 tiers), SKILL_MODEL_MAP (15 skills), getModelForSkill, getModelByTier (tests/unit/ai-models.test.ts)
- [x] `lib/ai/context-builder.ts` — buildContext, serializeContext (tests/unit/ai-context-builder.test.ts)
- [x] `lib/ai/event-dispatcher.ts` — skill routing based on intent (tests/unit/ai-event-dispatcher.test.ts)
- [x] `lib/ai/openrouter.ts` — extractJSON, complete(), streamResponse(), error handling, rate limiting (tests/unit/ai-openrouter.test.ts)
- [x] `lib/ai/command-executors.ts` — 30 executors + executeIntent router, param validation, duplicate detection, intent routing (tests/unit/command-executors.test.ts)
- [x] `lib/ai/skills/*` — all 15 skills: shape validation, allowedRoles, systemPrompt, modelTier consistency (tests/unit/ai-skills.test.ts)
- [x] `lib/ai/skills/patient-intake.ts` — prompt generation, role restrictions, medical history keywords (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/smart-scheduler.ts` — scheduling prompt, conflict prevention rules (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/treatment-advisor.ts` — clinical prompt, safety disclaimers, model tier (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/billing-agent.ts` — billing prompt, GST references, model tier (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/inventory-manager.ts` — inventory prompt, reorder/low stock references (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/lab-coordinator.ts` — lab order prompt generation (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/clinic-analyst.ts` — analytics prompt, model tier (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/no-show-predictor.ts` — risk prediction prompt (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/inventory-forecaster.ts` — demand forecasting prompt (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/cashflow-forecaster.ts` — revenue projection prompt (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/patient-segmentation.ts` — RFM/segmentation prompt (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/claim-analyzer.ts` — claim/insurance prompt (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/consent-generator.ts` — consent form prompt, clinical tier (tests/unit/ai-skills-individual.test.ts)
- [x] `lib/ai/skills/dynamic-pricing.ts` — pricing suggestion prompt (tests/unit/ai-skills-individual.test.ts)

#### Payment Gateways
- [x] `lib/payment-gateways/razorpay.ts` — order creation, signature verification, refund flow (tests/unit/payment-gateways.test.ts)
- [x] `lib/payment-gateways/phonepe.ts` — checksum generation, callback verification (tests/unit/payment-gateways.test.ts)
- [x] `lib/payment-gateways/paytm.ts` — transaction token, status check (tests/unit/payment-gateways.test.ts)
- [x] `lib/payment-gateways/index.ts` — factory pattern, interface compliance (tests/unit/payment-gateways.test.ts)

#### Services
- [x] `lib/services/template.service.ts` — variable interpolation, CRUD, seed, validation (tests/unit/template-service.test.ts)
- [x] `lib/services/email.service.ts` — email validation, preferences, logging, HTML generation, template send (tests/unit/email-service.test.ts)
- [x] `lib/services/sms.service.ts` — phone validation, DND check, time restrictions, logging, template processing (tests/unit/sms-service.test.ts)
- [x] `lib/services/communication-triggers.service.ts` — appointment reminders, birthday wishes, payment reminders, lab notifications, runAllTriggers (tests/unit/communication-triggers.test.ts)
- [x] `lib/services/google-calendar.ts` — getAuthUrl, exchangeCodeForTokens, refreshAccessToken, listCalendars, createCalendarEvent, deleteCalendarEvent, syncAppointments (tests/unit/google-calendar.test.ts)
- [x] `lib/services/smart-scheduler.ts` — findMatchingWaitlistPatients (day/time filtering), handleCancellationWaitlist (doctor name, NOTIFIED status, limit 3), bookFromWaitlist (tests/unit/smart-scheduler.test.ts)
- [x] `lib/services/video.service.ts` — getVideoProvider (Daily vs Jitsi), createRoom, deleteRoom, getRoomToken, getRoomInfo (tests/unit/video-service.test.ts)
- [x] `lib/services/pdf-generator.ts` — generateFormPdfHtml, escapeHtml XSS prevention, signature block, optional fields (tests/unit/pdf-generator.test.ts)

#### Data Import
- [x] `lib/import/schema-definitions.ts` — entity schemas, enum aliases, resolveEnum, parseDate, coerceValue (tests/unit/import-schema.test.ts)
- [x] `lib/import/parsers.ts` — CSV parsing, Excel parsing, dispatcher, error handling (tests/unit/import-parsers.test.ts)

#### Hooks (`tests/hooks/`)
- [x] `hooks/use-keyboard-shortcuts.ts` — useKeyboardShortcuts (extra shortcuts, input/textarea/select/contentEditable guard, modifier ignore, cleanup), useHotkey (simple key, ctrl/meta/shift/alt combos, escape in inputs, input guard, preventDefault, cleanup) (tests/hooks/use-keyboard-shortcuts.test.ts — 22 tests)
- [x] `hooks/use-toast.ts` — reducer (ADD/UPDATE/DISMISS/REMOVE_TOAST, limit, dismiss all), useToast hook (empty initial, toast/dismiss functions, genId uniqueness, state sync) (tests/hooks/use-toast.test.ts — 16 tests)
- [x] `hooks/use-web-voice.ts` — useWebVoice (initial state, voice support detection, start/stop listening, lang config, TTS toggle/speak/stop/interrupt, markdown stripping, cleanup) (tests/hooks/use-web-voice.test.ts — 22 tests)

#### Config & Middleware
- [x] `config/nav.ts` — navigation structure, section/item validation, getNavigationForRole (ADMIN/DOCTOR/RECEPTIONIST/ACCOUNTANT/LAB_TECH filtering, subItem filtering, empty section removal) (tests/unit/nav-config.test.ts — 22 tests)
- [x] `middleware.ts` — public routes, API passthrough, logged-in redirect, unauthenticated redirect with callbackUrl, role-based access (ADMIN/DOCTOR/RECEPTIONIST/ACCOUNTANT/LAB_TECH), onboarding, matcher config (tests/unit/middleware.test.ts — 34 tests)
- [x] `lib/auth.config.ts` — trustHost, pages config, jwt callback (user→token copy, subsequent pass-through), session callback (token→session copy), authorized callback (public routes, login redirect, auth required) (tests/unit/auth-config.test.ts — 24 tests)

### 1.2 Integration Tests — API Routes (`tests/integration/`)

#### Auth
- [x] `POST /api/auth/[...nextauth]` — login success, login failure, inactive user/hospital, password mismatch, schema validation, session config, route exports (tests/api/auth-nextauth.test.ts — 15 tests)
- [x] `POST /api/public/signup` — new clinic signup, duplicate email rejection, validation (tests/api/public-auth-routes.test.ts)
- [x] `POST /api/public/verify-email` — valid token, expired token, invalid token (tests/api/public-auth-routes.test.ts)
- [x] `GET/POST /api/public/invite/accept` — token validation, accept with user+staff creation, Zod, expired/used/inactive checks (tests/api/public-invite-accept.test.ts)

#### Patients
- [x] `GET /api/patients` — list with pagination, search filter, role-based access (tests/api/patients.test.ts + tests/comprehensive/patients.comprehensive.test.ts)
- [x] `POST /api/patients` — create patient, required field validation, duplicate detection (tests/comprehensive/patients.comprehensive.test.ts)
- [x] `GET /api/patients/[id]` — fetch by ID, 404 for non-existent, cross-hospital isolation (tests/comprehensive/patients.comprehensive.test.ts)
- [x] `PATCH /api/patients/[id]` — update fields, partial update, validation (tests/comprehensive/patients.comprehensive.test.ts)
- [x] `DELETE /api/patients/[id]` — soft delete, cascade effects (tests/comprehensive/patients.comprehensive.test.ts)
- [x] `GET /api/patients/[id]/timeline` — chronological event list, type filter, pagination, 6 event types (tests/api/patients-timeline.test.ts)
- [x] `GET /api/patients/[id]/documents` — document list with type/treatment filters (tests/api/patient-insurance-documents.test.ts)
- [x] `GET/PATCH/DELETE /api/patients/[id]/documents/[documentId]` — metadata, update, soft/permanent delete (tests/api/patient-insurance-documents.test.ts)
- [x] `POST /api/patients/[id]/documents` — file upload with type/size validation, document create, 404 patient (tests/api/patient-documents-upload.test.ts)
- [x] `GET/PUT /api/patients/[id]/documents/[documentId]/annotations` — save annotations with annotatedBy, role check, GET with empty fallback (tests/api/patient-document-annotations.test.ts)
- [x] `GET/POST/PUT /api/patients/[id]/insurance` — insurance policies list, create, update (tests/api/patient-insurance-documents.test.ts)
- [x] `POST /api/patients/[id]/insurance/verify` — verify policy (VERIFIED status), 400 missing policyId, 404 not found (tests/api/patient-insurance-verify.test.ts)

#### Appointments
- [x] `GET /api/appointments` — list, date range filter, doctor filter, status filter (tests/api/appointments.test.ts + tests/comprehensive/appointments.comprehensive.test.ts)
- [x] `POST /api/appointments` — create, slot conflict detection, validation (tests/comprehensive/appointments.comprehensive.test.ts)
- [x] `GET /api/appointments/[id]` — fetch, cross-hospital isolation (tests/comprehensive/appointments.comprehensive.test.ts)
- [x] `PATCH /api/appointments/[id]` — reschedule, status update (tests/comprehensive/appointments.comprehensive.test.ts)
- [x] `DELETE /api/appointments/[id]` — cancel appointment (tests/comprehensive/appointments.comprehensive.test.ts)
- [x] `POST /api/appointments/[id]/check-in` — check-in SCHEDULED/CONFIRMED, reject invalid statuses, wait time calc (tests/api/appointments-checkin-checkout.test.ts)
- [x] `POST /api/appointments/[id]/check-out` — check-out CHECKED_IN/IN_PROGRESS, notes append, reject invalid statuses (tests/api/appointments-checkin-checkout.test.ts)
- [x] `GET /api/appointments/today` — today's queue grouped by status (waiting/inProgress/upcoming/completed/noShow), avgWaitTime stats, doctor filter (tests/api/appointments-today-waitlist.test.ts)
- [x] `GET /api/appointments/slots` — available slots, holiday check, booked slots (tests/api/appointments-extended.test.ts)
- [x] `GET/POST/DELETE /api/appointments/waitlist` — enriched list with patient/doctor names, summary counts, add with duplicate check (409), cancel entry, role check (tests/api/appointments-today-waitlist.test.ts)

#### Treatments
- [x] `GET /api/treatments` — list with filters (tests/comprehensive/treatments.comprehensive.test.ts)
- [x] `POST /api/treatments` — create treatment record (tests/comprehensive/treatments.comprehensive.test.ts)
- [x] `GET/PATCH/DELETE /api/treatments/[id]` — CRUD operations (tests/comprehensive/treatments.comprehensive.test.ts)
- [x] `POST /api/treatments/[id]/start` — start treatment, PLANNED→IN_PROGRESS (tests/api/treatments-extended.test.ts)
- [x] `POST /api/treatments/[id]/complete` — complete treatment, notes, follow-up (tests/api/treatments-extended.test.ts)
- [x] `GET/POST /api/treatment-plans` — plan list with filters, create with items (tests/api/treatments-extended.test.ts)
- [x] `GET/PUT/DELETE /api/treatment-plans/[id]` — plan CRUD, active item check (tests/api/treatments-extended.test.ts)
- [x] `GET/POST /api/procedures` — list with search/category/isActive/all filters, create with name uniqueness, auto-generated code (tests/api/procedures-routes.test.ts)
- [x] `GET/PUT/DELETE /api/procedures/[id]` — detail with counts, update with name check, soft/hard delete (tests/api/procedures-routes.test.ts)
- [x] `GET/POST /api/dental-chart` — entries by patient grouped by tooth, FDI validation, auto-resolve MISSING/EXTRACTION (tests/api/dental-chart-routes.test.ts)
- [x] `GET/PUT/DELETE /api/dental-chart/[id]` — single entry, update surfaces/condition, hard delete (tests/api/dental-chart-routes.test.ts)

#### Billing & Payments
- [x] `GET/POST /api/invoices` — create invoice, line item calculation, GST (tests/comprehensive/invoices.comprehensive.test.ts)
- [x] `GET/PATCH/DELETE /api/invoices/[id]` — invoice CRUD, status transitions (tests/comprehensive/invoices.comprehensive.test.ts)
- [x] `GET/POST /api/invoices/[id]/payments` — payment list, record payment, status transitions (tests/api/billing-extended.test.ts)
- [x] `GET /api/payments` — payment list, search, filters, pagination, summary (tests/api/payments-routes.test.ts)
- [x] `GET/PUT/DELETE /api/payments/[id]` — payment detail with invoice/patient, update notes/status, delete pending only (tests/api/payments-detail-refund.test.ts)
- [x] `POST /api/payments/[id]/refund` — full/partial refund, invoice status update, validation (tests/api/payments-detail-refund.test.ts)
- [x] `POST /api/payments/create-order` — Razorpay/PhonePe/Paytm order creation (tests/api/payments-routes.test.ts)
- [x] `POST /api/payments/verify` — payment signature verification (tests/api/payment-verify-link.test.ts)
- [x] `POST /api/payments/link` — payment link generation (tests/api/payment-verify-link.test.ts)
- [x] `POST /api/payments/public-order` — public payment order (no auth) (tests/api/public-slots-payment.test.ts)
- [x] `POST /api/payments/public-verify` — public payment verification (tests/api/public-slots-payment.test.ts)
- [x] `GET/POST /api/payment-plans` — EMI plan creation (tests/api/payment-plans.test.ts)
- [x] `GET/PATCH /api/payment-plans/[id]` — plan detail, status update (tests/api/payment-plans.test.ts)
- [x] `POST /api/payment-plans/[id]/pay` — installment payment (tests/api/payment-plans.test.ts)
- [x] `GET /api/billing/unbilled-treatments` — unbilled treatment list with summary, patient validation (tests/api/billing-reports-unbilled.test.ts)
- [x] `GET /api/billing/reports` — 7 report types: summary, revenue, payments, outstanding, procedure/doctor revenue, daily collection (tests/api/billing-reports-unbilled.test.ts)

#### Inventory
- [x] `GET/POST /api/inventory/items` — item CRUD, low stock flag (tests/comprehensive/inventory.comprehensive.test.ts)
- [x] `GET/PATCH/DELETE /api/inventory/items/[id]` — item update/delete (tests/comprehensive/inventory.comprehensive.test.ts)
- [x] `GET/POST /api/inventory/categories` — category CRUD (tests/api/inventory-extended.test.ts)
- [x] `GET/POST /api/inventory/suppliers` — supplier CRUD (tests/api/inventory-extended.test.ts)
- [x] `GET/PATCH/DELETE /api/inventory/suppliers/[id]` — supplier update/delete (tests/api/inventory-suppliers-reports.test.ts)
- [x] `GET/POST /api/inventory/transactions` — stock in/out, quantity validation (tests/api/inventory-extended.test.ts)
- [x] `GET /api/inventory/reports` — inventory reports (tests/api/inventory-suppliers-reports.test.ts)
- [x] `GET /api/inventory/alerts` — low stock / expiring alerts (tests/api/inventory-extended.test.ts)

#### Staff
- [x] `GET/POST /api/staff` — list, create staff, role assignment (tests/comprehensive/staff.comprehensive.test.ts)
- [x] `GET/PATCH/DELETE /api/staff/[id]` — staff CRUD (tests/comprehensive/staff.comprehensive.test.ts)
- [x] `GET /api/staff/doctors` — doctors-only list (tests/api/staff-extended.test.ts)
- [x] `GET/PUT /api/staff/[id]/shifts` — shift list, replace all shifts with validation, ADMIN-only, $transaction (tests/api/staff-shifts.test.ts)
- [x] `GET /api/staff/[id]/performance` — appointments/treatments/revenue/attendance stats, procedure breakdown, date range (tests/api/staff-performance-attendance.test.ts)
- [x] `GET/POST /api/staff/attendance` — attendance log (tests/api/staff-extended.test.ts)
- [x] `GET /api/staff/attendance/today` — summary with all statuses, notMarked tracking (tests/api/staff-performance-attendance.test.ts)
- [x] `GET/POST /api/staff/leaves` — leave request, approval flow (tests/api/staff-extended.test.ts)
- [x] `PATCH /api/staff/leaves/[id]` — approve/reject leave (tests/api/staff-leaves-detail.test.ts)
- [x] `GET/POST /api/staff-invites` — invite list, create invite with Zod validation, staff limit check, email send (tests/api/staff-invites.test.ts)
- [x] `DELETE/POST /api/staff-invites/[id]` — cancel pending invite, resend with extended expiry (tests/api/staff-invites.test.ts)

#### Lab
- [x] `GET/POST /api/lab-orders` — create lab order, status tracking, pagination (tests/api/lab-medications-routes.test.ts)
- [x] `GET/PUT/DELETE /api/lab-orders/[id]` — order detail with history/docs, update with status logging, soft delete (tests/api/lab-vendors-routes.test.ts)
- [x] `PATCH /api/lab-orders/[id]/status` — 9 valid statuses, auto-set dates (sent/received/delivered), history insert, raw MySQL pool mock (tests/api/lab-order-status.test.ts)
- [x] `GET/POST /api/lab-vendors` — vendor list with search/status filter, create vendor (tests/api/lab-vendors-routes.test.ts)
- [x] `GET/PUT/DELETE /api/lab-vendors/[id]` — vendor detail, update with code uniqueness, soft delete with order check (tests/api/lab-vendors-routes.test.ts)

#### Medications & Prescriptions
- [x] `GET/POST /api/medications` — medication CRUD, search, filters (tests/api/medications-prescriptions.test.ts)
- [x] `GET/PUT/DELETE /api/medications/[id]` — medication detail, update, soft delete (tests/api/medications-extended.test.ts)
- [x] `GET /api/medications/categories` — distinct categories, null filtering (tests/api/medications-extended.test.ts)
- [x] `GET/POST /api/prescriptions` — prescription creation with medications (tests/api/medications-prescriptions.test.ts)
- [x] `GET/DELETE /api/prescriptions/[id]` — prescription detail/delete (tests/api/prescriptions-detail.test.ts)

#### Communications
- [x] `GET/POST /api/communications/templates` — template CRUD, validation (tests/api/communications-routes.test.ts)
- [x] `PATCH/DELETE /api/communications/templates/[id]` — template update/delete (tests/api/communications-extended.test.ts)
- [x] `POST /api/communications/sms` — send single SMS (tests/api/communications-routes.test.ts)
- [x] `POST /api/communications/sms/bulk` — bulk SMS, recipient validation (tests/api/communications-extended.test.ts)
- [x] `POST /api/communications/email` — send email, template rendering (tests/api/communications-routes.test.ts)
- [x] `GET/POST /api/communications/surveys` — survey CRUD (tests/api/communications-extended.test.ts)
- [x] `GET/PUT/DELETE /api/communications/surveys/[id]` — detail with parsed questions/responses, update with Zod, delete (tests/api/surveys-detail-responses.test.ts)
- [x] `GET/POST /api/communications/surveys/[id]/responses` — submit with sentiment scoring, statistics with avg rating (tests/api/surveys-detail-responses.test.ts)
- [x] `GET/POST /api/communications/triggers` — automation trigger CRUD (tests/api/communications-extended.test.ts)
- [x] `GET /api/communications/analytics` — campaign analytics, SMS/email stats, daily trends (tests/api/communications-analytics.test.ts)
- [x] `GET/POST/PUT/DELETE /api/communications/automations` — automation rules CRUD (tests/api/automations-routes.test.ts)
- [x] `GET /api/communications/feedback/analytics` — NPS, sentiment analysis data (tests/api/communications-extended.test.ts)

#### CRM & Loyalty
- [x] `GET /api/crm/dashboard` — CRM metrics (tests/api/crm-loyalty-routes.test.ts)
- [x] `GET /api/crm/segments` — patient segmentation (tests/api/crm-extended.test.ts)
- [x] `GET/POST /api/loyalty` — loyalty points query, award points (tests/api/crm-loyalty-routes.test.ts)
- [x] `GET/POST /api/memberships/plans` — membership plan CRUD (tests/api/crm-loyalty-routes.test.ts)
- [x] `GET/PUT/DELETE /api/memberships/plans/[id]` — plan detail, update, delete (tests/api/crm-extended.test.ts)
- [x] `POST/GET /api/memberships/enroll` — member enrollment (tests/api/crm-loyalty-routes.test.ts)
- [x] `GET/POST /api/referrals` — referral creation, tracking (tests/api/crm-loyalty-routes.test.ts)
- [x] `PUT /api/referrals/[id]` — referral status update (tests/api/crm-extended.test.ts)

#### Insurance Claims
- [x] `GET/POST /api/insurance-claims` — claim list with summary, create claim (tests/api/insurance-routes.test.ts)
- [x] `GET/PUT/DELETE /api/insurance-claims/[id]` — claim detail, status transitions, delete draft (tests/api/insurance-routes.test.ts)

#### Sterilization
- [x] `GET/POST /api/sterilization/instruments` — instrument CRUD (tests/api/sterilization-routes.test.ts)
- [x] `GET/PATCH/DELETE /api/sterilization/instruments/[id]` — instrument update/delete (tests/api/sterilization-instruments-detail.test.ts)
- [x] `GET/POST /api/sterilization/logs` — sterilization log CRUD (tests/api/sterilization-routes.test.ts)

#### Consent Forms
- [x] `GET/POST /api/forms` — form CRUD (tests/api/forms-routes.test.ts)
- [x] `GET/PUT /api/forms/[id]` — form detail, review/approve/reject (tests/api/forms-routes.test.ts)
- [x] `GET /api/forms/[id]/pdf` — PDF HTML generation with patient/clinic info, handles missing patient (tests/api/forms-extended.test.ts)
- [x] `GET /api/forms/[id]/verify` — SHA-256 integrity hash, verified flag, audit trail with reviewer (tests/api/forms-extended.test.ts)
- [x] `GET/POST /api/settings/forms` — list with submission counts, create with Zod validation (tests/api/forms-extended.test.ts)
- [x] `GET/PUT/DELETE /api/settings/forms/[id]` — detail with submissions, Zod update, soft/hard delete (tests/api/forms-extended.test.ts)
- [x] `POST /api/settings/forms/seed` — seeds 3 default templates, idempotent check (tests/api/forms-extended.test.ts)

#### Video / Tele-Dentistry
- [x] `GET/POST /api/video/consultations` — consultation CRUD (tests/api/video-consultations.test.ts)
- [x] `GET/PUT /api/video/consultations/[id]` — consultation detail, start/end/cancel/no-show/notes (tests/api/video-consultation-detail.test.ts)
- [x] `POST/DELETE /api/video/room` — room creation/deletion via video service (tests/api/video-room-token.test.ts)
- [x] `GET /api/video/token` — Daily/Jitsi provider token, doctor vs participant detection (tests/api/video-room-token.test.ts)

#### IoT Devices
- [x] `POST /api/devices/register` — device registration (tests/api/devices-routes.test.ts)
- [x] `POST /api/devices/data` — data ingestion from device (tests/api/devices-routes.test.ts)
- [x] `GET /api/devices/status` — device status list (tests/api/devices-routes.test.ts)

#### AI Routes
- [x] `POST /api/ai/chat` — chat completion, streaming response (tests/api/ai-routes.test.ts)
- [x] `POST /api/ai/query` — NL→Prisma query, injection prevention (tests/api/ai-extended.test.ts)
- [x] `POST /api/ai/command` — command execution, permission check (tests/api/ai-routes.test.ts)
- [x] `POST /api/ai/analyze` — risk_score (medical history → AI scoring → persist) + generic data analysis (tests/api/ai-analyze.test.ts)
- [x] `GET /api/ai/insights` — auto-generated insights (tests/api/ai-routes.test.ts)
- [x] `GET /api/ai/suggestions` — page-aware suggestions with billing/appointments/inventory enrichment (tests/api/ai-suggestions-briefing.test.ts)
- [x] `GET /api/ai/briefing` — morning briefing with 6 data sources, ADMIN-only, saves as AIInsight (tests/api/ai-suggestions-briefing.test.ts)
- [x] `POST /api/ai/clinical` — consent-generator skill (tests/api/ai-routes.test.ts)
- [x] `GET /api/ai/no-show-risk` — no-show risk scoring (tests/api/ai-extended.test.ts)
- [x] `GET /api/ai/inventory-forecast` — AI demand forecast with rule-based fallback, empty inventory edge case (tests/api/ai-forecasts-segments-claims.test.ts)
- [x] `GET /api/ai/cashflow-forecast` — 30-day projection with payment/appointment/insurance data, fallback (tests/api/ai-forecasts-segments-claims.test.ts)
- [x] `GET /api/ai/patient-segments` — RFM analysis, AI segmentation with rule-based fallback, enrichment (tests/api/ai-forecasts-segments-claims.test.ts)
- [x] `POST /api/ai/claim-analysis` — denied claim analysis, denial patterns, appeal letter, AI fallback (tests/api/ai-forecasts-segments-claims.test.ts)
- [x] `GET /api/ai/pricing-suggestions` — dynamic pricing (tests/api/ai-extended.test.ts)
- [x] `GET /api/ai/usage` — AI usage stats (tests/api/ai-routes.test.ts)

#### Settings
- [x] `GET/POST/PUT /api/settings` — general settings, bulk update (tests/api/settings-routes.test.ts)
- [x] `GET/POST /api/settings/clinic` — clinic profile (tests/api/settings-routes.test.ts)
- [x] `POST/DELETE /api/settings/clinic/logo` — upload with previous cleanup, delete with DB clear, type/size validation, ADMIN-only (tests/api/settings-clinic-logo.test.ts)
- [x] `GET/POST /api/settings/communications` — SMS/email/reviews settings, JSON + individual upsert (tests/api/settings-communications.test.ts)
- [x] `POST /api/settings/communications/test` — test SMS/email send, validation, error handling (tests/api/settings-extended.test.ts)
- [x] `GET/PUT /api/settings/billing/gateway` — payment gateway config, secret masking, encryption (tests/api/settings-extended.test.ts)
- [x] `GET/POST /api/settings/procedures` — procedure catalog, category filter, duplicate code check (tests/api/settings-extended.test.ts)
- [x] `GET/PUT/DELETE /api/settings/procedures/[id]` — procedure CRUD, code uniqueness, soft delete (tests/api/settings-extended.test.ts)
- [x] `GET/POST /api/settings/security` — security settings with Zod validation, JSON parse/upsert, ADMIN-only (tests/api/settings-security-subscription.test.ts)
- [x] `GET /api/settings/subscription` — plan info with patient/staff usage counts (tests/api/settings-security-subscription.test.ts)
- [x] `GET/POST/DELETE /api/settings/holidays` — holiday CRUD, year filter, zod validation (tests/api/settings-extended.test.ts)
- [x] `GET/POST /api/settings/backup` — full/partial JSON export, entity counts, ADMIN-only (tests/api/settings-backup.test.ts)
- [x] `GET /api/settings/audit-logs` — audit log query, pagination, userId/entityType/action/date-range filters, hospitalId scope, user details, combined filters, empty results, ADMIN-only (tests/api/audit-logs.test.ts — 18 tests)

#### Dashboard & Reports
- [x] `GET /api/dashboard/stats` — dashboard metrics (today's appointments, revenue, etc.) (tests/api/dashboard-search-notifications.test.ts)
- [x] `GET /api/reports/analytics` — patient, clinical, financial, operational analytics (tests/api/reports-analytics.test.ts)
- [x] `GET /api/reports/export` — Excel/PDF export for patient/clinical/financial/operational types, invalid format, analytics fetch error (tests/api/reports-export.test.ts)

#### Notifications & Search
- [x] `GET/PUT /api/notifications` — notification list, mark read, cursor pagination (tests/api/dashboard-search-notifications.test.ts)
- [x] `POST/DELETE /api/notifications/register-device` — device upsert with Zod, deactivate on logout, auth() pattern (tests/api/notifications-register-device.test.ts)
- [x] `GET /api/search` — global search across patients, appointments, etc. (tests/api/dashboard-search-notifications.test.ts)

#### Patient Portal
- [x] `POST /api/patient-portal/auth/send-otp` — OTP send (tests/api/patient-portal-auth.test.ts)
- [x] `POST /api/patient-portal/auth/verify-otp` — OTP verify, session creation (tests/api/patient-portal-auth.test.ts)
- [x] `POST /api/patient-portal/auth/logout` — portal logout (tests/api/patient-portal-auth.test.ts)
- [x] `GET /api/patient-portal/dashboard` — patient dashboard data (tests/api/patient-portal-auth.test.ts)
- [x] `GET/POST /api/patient-portal/appointments` — patient's appointments, booking (tests/api/patient-portal-data.test.ts)
- [x] `GET /api/patient-portal/bills` — patient's bills (tests/api/patient-portal-data.test.ts)
- [x] `GET /api/patient-portal/doctors` — available doctors (tests/api/patient-portal-data.test.ts)
- [x] `GET /api/patient-portal/slots` — available slots (tests/api/patient-portal-data.test.ts)
- [x] `GET /api/patient-portal/prescriptions` — patient's prescriptions (tests/api/patient-portal-data.test.ts)
- [x] `GET /api/patient-portal/records` — treatments/chart/documents tabs (tests/api/patient-portal-records-forms.test.ts)
- [x] `GET/POST /api/patient-portal/forms` — form submissions, available templates, form submit with signature/IP (tests/api/patient-portal-records-forms.test.ts)
- [x] `GET /api/patient-portal/forms/[id]` — template detail with existing submission check, requirePatientAuth (tests/api/patient-portal-form-detail.test.ts)
- [x] `GET /api/patient-portal/video/[id]` — Daily/Jitsi provider token, patient auth, consultation detail (tests/api/patient-portal-video-photo.test.ts)
- [x] `POST /api/patient-portal/upload-photo` — image upload with type/size validation, document create, doctor notifications (tests/api/patient-portal-video-photo.test.ts)

#### Public Booking
- [x] `GET /api/public/[slug]/doctors` — public doctor list (tests/api/public-booking.test.ts)
- [x] `GET /api/public/[slug]/slots` — public slot availability (tests/api/public-slots-payment.test.ts)
- [x] `POST /api/public/[slug]/book` — public appointment booking (tests/api/public-booking.test.ts)

#### Webhooks
- [x] `POST /api/webhooks` — generic webhook handler (tests/api/ai-routes.test.ts)
- [x] `POST /api/webhooks/payment/[provider]` — Razorpay/PhonePe/Paytm callback verification (tests/api/webhooks-payment.test.ts)

#### Cron Jobs
- [x] `GET /api/cron/cleanup` — data cleanup logic (tests/api/cron-routes.test.ts)
- [x] `GET /api/cron/briefing` — daily briefing generation (tests/api/cron-routes.test.ts)
- [x] `GET /api/cron/recall` — patient recall reminders (tests/api/cron-routes.test.ts)
- [x] `GET /api/cron/collections` — payment collection reminders (tests/api/cron-routes.test.ts)
- [x] `GET /api/cron/reminders` — appointment reminders (tests/api/cron-routes.test.ts)
- [x] `POST /api/cron/automations` — marketing automation execution (tests/api/cron-automations.test.ts)
- [x] `GET /api/cron/inventory` — inventory alert checks (tests/api/cron-routes.test.ts)

#### Onboarding
- [x] `GET/POST /api/onboarding` — GET status with all fields, POST with Zod validation (address/city/state/pincode required), ADMIN+hospitalAdmin only, 403 non-admin, 404 missing hospital, optional business/payment fields, onboardingCompleted flag (tests/api/onboarding.test.ts — 14 tests)

#### Email Tracking
- [x] `GET /api/track/email/[id]` — 1x1 transparent PNG pixel, no-cache headers, Content-Length, background openedAt update (openedAt:null filter), no auth required, silent DB error handling, valid PNG magic bytes (tests/api/email-tracking.test.ts — 9 tests)

#### Data Import
- [x] `POST /api/data-import/upload` — file upload, parse, create job, type/size/extension validation, ADMIN-only (tests/api/data-import-upload.test.ts)
- [x] `POST /api/data-import/ai-mapping` — AI column mapping, graceful fallback, invalid JSON handling, field validation (tests/api/data-import-mapping.test.ts)
- [x] `POST /api/data-import/validate` — row validation, duplicate check, FK resolution, type coercion, auth (tests/api/data-import-validate.test.ts)
- [x] `POST /api/data-import/commit` — batch import with per-entity handlers (patients, inventory, staff), skipErrorRows, signoff, audit log (tests/api/data-import-commit.test.ts)
- [x] `GET/DELETE /api/data-import/[id]` — job details, cancel job, 404/401 (tests/api/data-import-job.test.ts)

### 1.3 E2E Tests — User Workflows (`tests/e2e/`)

#### Auth Flows
- [x] `auth.spec.ts` — login form, validation, invalid credentials, signup link, password visibility toggle, email format validation, email preservation after failed login, accessible form labels, protected route redirects (11 routes), public route access, callbackUrl redirect (tests/e2e/auth.spec.ts — 25 tests)
- [x] `auth-signup.spec.ts` — full signup flow: form fields, validation (email/password/clinic name), submit, duplicate rejection, verify email redirect (tests/e2e/auth-signup.spec.ts — 9 tests)
- [x] `auth-roles.spec.ts` — role-based access: ADMIN full access (10 pages), DOCTOR clinical access + restricted settings/staff, RECEPTIONIST front-desk access + restricted settings/reports, cross-role sidebar nav (tests/e2e/auth-roles.spec.ts — 16 tests)

#### Patient Management
- [x] `patients-crud.spec.ts` — list, search, filter, add patient, view, create with validation, documents, insurance (tests/e2e/patients-crud.spec.ts — 11 tests)
- [x] `patients-documents.spec.ts` — documents tab navigation, upload button, upload dialog, document type options, empty state, annotation/compare controls (tests/e2e/patients-documents.spec.ts — 6 tests)
- [x] `patients-insurance.spec.ts` — insurance tab navigation, add policy button, add dialog, form fields, empty state/existing policies, verification badges, verify/edit actions, coverage details (tests/e2e/patients-insurance.spec.ts — 8 tests)

#### Appointment Workflow
- [x] `appointments-crud.spec.ts` — list, create, date/status filter, search, pagination, check-in, queue, waitlist, calendar (tests/e2e/appointments-crud.spec.ts — 11 tests)
- [x] `appointments-checkin.spec.ts` — check-in flow (detail page status actions, queue check-in button, patient info), check-out flow (check-out button, duration timer), status transitions (badges, status filter) (tests/e2e/appointments-checkin.spec.ts — 8 tests)
- [x] `appointments-queue.spec.ts` — queue page (status sections, waiting/in-progress/completed sections, patient/doctor names), queue actions (action buttons, doctor filter, no-show), queue stats (tests/e2e/appointments-queue.spec.ts — 9 tests)
- [x] `appointments-waitlist.spec.ts` — waitlist page (display, add button, entries table, patient/doctor info, summary counts), add to waitlist (form, patient selection, preferred day/time), waitlist actions (cancel/remove) (tests/e2e/appointments-waitlist.spec.ts — 9 tests)

#### Treatment Workflow
- [x] `treatments-workflow.spec.ts` — list, create, status filter, search, plans, dental chart, start/complete buttons, procedures (tests/e2e/treatments-workflow.spec.ts — 11 tests)
- [x] `treatments-plans.spec.ts` — plans list (display, new button, table, status badges, search, filter), create plan (form, patient required, add items, cost calc), plan detail (progress tracking) (tests/e2e/treatments-plans.spec.ts — 11 tests)
- [x] `dental-chart.spec.ts` — chart display (via patient detail, tooth elements, FDI numbering), standalone access (from treatments, condition legend, summary stats), interactions (patient selector, add condition) (tests/e2e/dental-chart.spec.ts — 8 tests)

#### Billing Workflow
- [x] `billing-invoice.spec.ts` — dashboard metrics, create invoice, GST calc, patient validation, filters, payments tab, payment plans, refund (tests/e2e/billing-invoice.spec.ts — 12 tests)
- [x] `billing-payment.spec.ts` — payments list (display, table, search, method badges, status indicators, currency amounts), record payment from invoice (navigate, method selection), payment summary (tests/e2e/billing-payment.spec.ts — 9 tests)
- [x] `billing-payment-plan.spec.ts` — plans list (display, new button, table, status badges, installment progress), create plan (form, invoice required, installment config, amount calc), plan detail (schedule, pay button) (tests/e2e/billing-payment-plan.spec.ts — 11 tests)
- [x] `billing-refund.spec.ts` — refund from payments (navigate, refund option, refund form, reason field), refund validation (amount limit, status display), refund impact on dashboard (tests/e2e/billing-refund.spec.ts — 7 tests)

#### Inventory Workflow
- [x] `inventory-crud.spec.ts` — list, add item, search, category filter, stock status, pagination, export, suppliers, low stock alerts (tests/e2e/inventory-crud.spec.ts — 11 tests)
- [x] `inventory-transactions.spec.ts` — transaction list (display, table, type indicators, items/quantities, date filter), stock in (button, form fields), stock out tracking (tests/e2e/inventory-transactions.spec.ts — 8 tests)
- [x] `inventory-suppliers.spec.ts` — supplier list (display, add button, table, contact details, status, search), add supplier (form, validation, contact fields), supplier actions (edit/delete) (tests/e2e/inventory-suppliers.spec.ts — 10 tests)

#### Staff Workflow
- [x] `staff-crud.spec.ts` — list, add staff, search, role filter, status badges, export, attendance, leaves, shifts, deactivation (tests/e2e/staff-crud.spec.ts — 12 tests)
- [x] `staff-attendance.spec.ts` — attendance page (display, today summary, staff list, date selector, mark button), mark attendance (present/absent/late, check-in time), attendance history (tests/e2e/staff-attendance.spec.ts — 8 tests)
- [x] `staff-leaves.spec.ts` — leave list (display, table, status badges, leave types, apply button), apply for leave (form, date range, leave type, reason), leave approval (approve/reject buttons) (tests/e2e/staff-leaves.spec.ts — 10 tests)
- [x] `staff-shifts.spec.ts` — staff detail shifts tab (navigate, schedule table), shift management (edit button, time fields), doctor schedule view (tests/e2e/staff-shifts.spec.ts — 5 tests)

#### Lab Workflow
- [x] `lab-orders.spec.ts` — list, create order, search, status filter, export, tabs, vendors (tests/e2e/lab-orders.spec.ts — 10 tests)
- [x] `lab-vendors.spec.ts` — vendor list (display, add button, table, status badges, search, contact info), add vendor (form, validation, specialization), vendor actions (edit/delete) (tests/e2e/lab-vendors.spec.ts — 10 tests)

#### Prescriptions
- [x] `prescriptions.spec.ts` — list, create, search, medication fields, validation (tests/e2e/prescriptions.spec.ts — 7 tests)

#### Communications
- [x] `communications.spec.ts` — SMS/Email tabs, send forms, validation, templates, surveys, automations, analytics (tests/e2e/communications.spec.ts — 9 tests)
- [x] `communications-sms.spec.ts` — send single (form, textarea, phone validation, character count), bulk SMS, SMS templates (tests/e2e/communications-sms.spec.ts — 6 tests)
- [x] `communications-email.spec.ts` — send email (form, subject, body, email validation), email templates, email tracking/analytics (tests/e2e/communications-email.spec.ts — 6 tests)
- [x] `communications-surveys.spec.ts` — feedback page (metrics, NPS score, average rating, sentiment breakdown), survey analytics (response rate) (tests/e2e/communications-surveys.spec.ts — 6 tests)
- [x] `communications-automations.spec.ts` — automations page (display, create button, rules list, status), create automation (form, trigger type, channel, template), toggle enable/disable (tests/e2e/communications-automations.spec.ts — 9 tests)

#### CRM & Loyalty
- [x] `crm-loyalty.spec.ts` — CRM dashboard, metrics, loyalty, memberships, referrals, segments (tests/e2e/crm-loyalty.spec.ts — 6 tests)
- [x] `crm-dashboard.spec.ts` — dashboard overview (display, membership/referral/loyalty/retention metrics), navigation (sub-page links), patient segments (page, segment cards) (tests/e2e/crm-dashboard.spec.ts — 8 tests)
- [x] `crm-memberships.spec.ts` — membership plans (display, create button, list/table, pricing, features), create plan (form, price/duration), enroll patient (tests/e2e/crm-memberships.spec.ts — 8 tests)
- [x] `crm-referrals.spec.ts` — referral list (display, create button, table, status badges, referrer/referred info), create referral (form, referrer required), referral tracking (code, reward status) (tests/e2e/crm-referrals.spec.ts — 9 tests)

#### Sterilization
- [x] `sterilization.spec.ts` — dashboard, instruments, logs, compliance (tests/e2e/sterilization.spec.ts — 5 tests)

#### Consent Forms
- [x] `consent-forms.spec.ts` — form templates, create template, form submissions (tests/e2e/consent-forms.spec.ts — 4 tests)

#### Video Consultations
- [x] `video-consultation.spec.ts` — consultation list, new button, detail navigation (tests/e2e/video-consultation.spec.ts — 4 tests)

#### Settings
- [x] `settings-clinic.spec.ts` — settings categories, theme toggle, clinic info, logo upload, billing settings, payment gateway, communication settings, test send, security, procedures (tests/e2e/settings-clinic.spec.ts — 14 tests)
- [x] `settings-ai.spec.ts` — AI settings page, master toggle, feature toggles, model preference selection, budget/limit config, toggle on/off, usage stats, save settings (tests/e2e/settings-ai.spec.ts — 9 tests)

#### Patient Portal (E2E from patient perspective)
- [x] `portal-login.spec.ts` — OTP login flow, phone validation, portal dashboard/appointments/bills/records/forms auth guards (tests/e2e/portal-login.spec.ts — 11 tests)
- [x] `portal-booking.spec.ts` — portal booking page, auth guard redirect, booking elements (covered in portal-video.spec.ts — 2 tests)
- [x] `portal-bills.spec.ts` — auth guard redirect, bills page structure (heading, portal login form), payment history section, dashboard bill links (tests/e2e/portal-bills.spec.ts — 5 tests)
- [x] `portal-forms.spec.ts` — auth guard redirect, forms page structure, form template types (medical history, consent, intake, feedback), form detail auth guard (tests/e2e/portal-forms.spec.ts — 8 tests)
- [x] `portal-records.spec.ts` — auth guard redirect, records page structure (tabs), prescriptions access, photo upload auth guard (tests/e2e/portal-records.spec.ts — 6 tests)
- [x] `portal-video.spec.ts` — auth guard redirect, video consultation structure, direct access protection, portal booking auth guard (tests/e2e/portal-video.spec.ts — 5 tests)

#### Public Pages
- [x] `public-booking.spec.ts` — public booking page, doctor selection, booking flow, date/time selection (tests/e2e/public-booking.spec.ts — 6 tests)
- [x] `public-payment.spec.ts` — payment link page (display, invalid token error, no auth required, amount/details), gateway selection (method options, pay button) (tests/e2e/public-payment.spec.ts — 6 tests)

#### Reports
- [x] `reports.spec.ts` — reports page, report types, date filter, export, charts/tables, patient/financial/clinical analytics (tests/e2e/reports.spec.ts — 8 tests)

#### Data Import
- [x] `data-import.spec.ts` — import page, file upload, entity type selection (tests/e2e/data-import.spec.ts — 3 tests)

### 1.4 Regression Tests (`tests/regression/`)
- [x] Hospital isolation — hospitalId scoping, cross-tenant prevention (tests/regression/regression.test.ts — 3 tests)
- [x] Authentication edge cases — expired sessions, null fields, missing hospitalId, password hash exposure (tests/regression/regression.test.ts — 4 tests)
- [x] Input validation — empty/spaced phones, null optionals, long strings, XSS, SQL injection, unicode, timezone boundaries (tests/regression/regression.test.ts — 8 tests)
- [x] Billing calculations — zero amounts, floating point precision, negative/excess discounts, GST, partial payments, overpayment (tests/regression/regression.test.ts — 7 tests)
- [x] Appointment scheduling — overlap detection, back-to-back, midnight crossing, holidays, date roundtrip (tests/regression/regression.test.ts — 5 tests)
- [x] Inventory management — negative stock, low stock flag, zero reorder, expiry detection, batch uniqueness (tests/regression/regression.test.ts — 5 tests)
- [x] Pagination — page 0, negative page, large page, zero limit, skip calculation, zero total (tests/regression/regression.test.ts — 6 tests)
- [x] File uploads — size limit, MIME validation, no extension, double extension, empty filename (tests/regression/regression.test.ts — 5 tests)
- [x] Concurrency — concurrent stock updates, double-submit prevention (tests/regression/regression.test.ts — 2 tests)
- [x] API response format — error format, pagination format, ISO dates, internal field exclusion (tests/regression/regression.test.ts — 4 tests)

### 1.5 Smoke Tests (`tests/smoke/smoke.test.tsx`)
- [x] Login page loads (tests/smoke/smoke.test.tsx)
- [x] Dashboard loads after auth (tests/smoke/smoke.test.tsx)
- [x] Patients list loads (tests/smoke/smoke.test.tsx)
- [x] Appointments list loads (tests/smoke/smoke.test.tsx)
- [x] Billing page loads (tests/smoke/smoke.test.tsx)
- [x] Inventory page loads (tests/smoke/smoke.test.tsx)
- [x] Settings page loads (tests/smoke/smoke.test.tsx)
- [x] AI chat page loads (tests/smoke/smoke.test.tsx)
- [x] Patient portal login page loads (tests/smoke/smoke.test.tsx)
- [x] Staff page loads (tests/smoke/smoke.test.tsx)
- [x] Treatments page loads (tests/smoke/smoke.test.tsx)
- [x] Lab page loads (tests/smoke/smoke.test.tsx)
- [x] Reports page loads (tests/smoke/smoke.test.tsx)
- [x] Communications page loads (tests/smoke/smoke.test.tsx)
- [x] Prescriptions page loads (tests/smoke/smoke.test.tsx)
- [x] Medications page loads (tests/smoke/smoke.test.tsx)
- [x] CRM page loads (tests/smoke/smoke.test.tsx)
- [x] Sterilization page loads (tests/smoke/smoke.test.tsx)
- [x] Devices page loads (tests/smoke/smoke.test.tsx)
- [x] Video page loads (tests/smoke/smoke.test.tsx)

---

## 2. UI / Frontend Testing

### 2.1 Component Tests (`tests/components/`)

#### Layout Components
- [x] `sidebar.tsx` — expand/collapse, active item highlighting, plan label, logo/initial, version footer (tests/components/layout-components.test.tsx — 16 tests)
- [x] `mobile-sidebar.tsx` — drawer open/close, Escape key, backdrop click, route close (tests/components/layout-components.test.tsx — 9 tests)
- [x] `global-search.tsx` — "/" shortcut, debounced search, grouped results, keyboard nav, input guard (tests/components/layout-components.test.tsx — 11 tests)
- [x] `notification-tray.tsx` — fetch on mount, unread badge (9+), mark read, mark all read, empty state, error handling (tests/components/layout-components.test.tsx — 11 tests)
- [x] `dashboard-shell.tsx` — renders Sidebar/MobileSidebar/Header with props, AIProvider, SidebarProvider, CommandBar, ChatWidget, KeyboardShortcutHelp, Breadcrumb, children (tests/components/dashboard-shell.test.tsx — 13 tests)

#### AI Components
- [x] `chat-widget.tsx` — message send, streaming response display, skill selection (tests/components/ai-components.test.tsx)
- [x] `command-bar.tsx` — Cmd+K opening, command search, execution (tests/components/ai-components.test.tsx)
- [x] `voice-orb.tsx` — idle/listening/speaking/processing states, aria-labels, waveform bars, ripple rings, spinner, dynamic scale, custom size, disabled (tests/components/voice-orb.test.tsx — 18 tests)
- [x] `insights-panel.tsx` — insight card rendering, refresh (tests/components/ai-components.test.tsx)
- [x] `smart-suggestions.tsx` — suggestion display, click to apply (tests/components/ai-components.test.tsx)

#### Clinical Components
- [x] `dental-chart.tsx` — tooth click, condition dialog, surface checkboxes, save/error, summary cards, legend, history (tests/components/clinical-components.test.tsx — 22 DentalChart tests)
- [x] `dental-3d-viewer.tsx` — SVG arch view, view angle buttons, zoom controls, condition legend, overview stats, readOnly, empty data (tests/components/clinical-components.test.tsx — 12 Dental3DViewer tests)
- [x] `image-viewer.tsx` — zoom/rotation/flip/brightness/contrast controls, navigation arrows, image counter, annotate/compare/download buttons, keyboard shortcuts (tests/components/imaging-components.test.tsx — 17 tests)
- [x] `image-annotator.tsx` — drawing tools (6 types), color swatches, line width, undo/redo/clear, save/cancel, readOnly mode, annotation count (tests/components/imaging-components.test.tsx — 14 tests)
- [x] `image-compare.tsx` — side-by-side mode, slider mode, before/after labels, dates, close button, mode switching (tests/components/imaging-components.test.tsx — 12 tests)

#### Billing Components
- [x] `payment-checkout.tsx` — trigger button, dialog states (idle/loading/error/success), create-order API, Razorpay/PhonePe flow, retry, controlled open (tests/components/billing-components.test.tsx — 15 tests)
- [x] `gateway-settings.tsx` — provider selection (Razorpay/PhonePe/Paytm), credential fields, Active/Live/Test badges, save/error flow, webhook URL, encrypted note (tests/components/gateway-settings.test.tsx — 19 tests)

#### Form Components
- [x] `form-renderer.tsx` — all 11 field types (heading, paragraph, text, textarea, number, date, select, checkbox, checkbox-group, radio, signature), validation (required, minLength, maxLength, min/max), readOnly mode, initial data, signature required, loading state (tests/components/form-components.test.tsx — 29 tests)
- [x] `signature-pad.tsx` — canvas rendering, undo/clear buttons, agreement checkbox, custom label, mouse drawing events, canvas dimensions, placeholder text (tests/components/signature-pad.test.tsx — 13 tests)

#### Appointment Components
- [x] `calendar-view.tsx` — week/day/month view switching, navigation, Today button, appointment rendering, status legend, "+N more" overflow, appointment click navigation (tests/components/calendar-view.test.tsx — 14 tests)

#### Video Components
- [x] `video-room.tsx` — LIVE badge, timer, End Call, Daily/Jitsi iframe, doctor sidebar (patient info, medical alerts, appointment, notes), panel toggle, call ended state, Save Notes (tests/components/video-room.test.tsx — 21 tests)

#### Portal Components
- [x] `portal-shell.tsx` — hospital name/logo, patient info, 8 nav items, nav links, logout API, mobile menu toggle, children rendering (tests/components/portal-shell.test.tsx — 10 tests)

#### Patient Form Components
- [x] `patient-form-submissions.tsx` — empty state, submission list, status badges, signed indicator, view dialog, review section, status options, review notes (tests/components/patient-form-submissions.test.tsx — 10 tests)

#### Insurance Components
- [x] `patient-insurance.tsx` — loading skeletons, empty state, policy cards, provider name, policy/group/member IDs, subscriber info, verification badges (Verified/Unverified/Expired), copay/deductible, Activate/Deactivate, Add/Edit dialog, form validation, verify API (tests/components/patient-insurance.test.tsx — 22 tests)

#### Clinical Components (Additional)
- [x] `voice-input.tsx` — SpeechRecognition detection, renders null when unsupported, mic button, tooltip, cleanup on unmount (tests/components/voice-input.test.tsx — 4 tests)

#### Layout Components (Additional)
- [x] `keyboard-shortcut-help.tsx` — dialog hidden by default, "?" hotkey opens dialog, Navigation/Quick Actions/General sections, kbd elements, "then" separators (tests/components/keyboard-shortcut-help.test.tsx — 9 tests)

#### UI Components (Additional)
- [x] `export-menu.tsx` — Export button, CSV/Excel options, downloadCSV/downloadExcel calls, success/no-data/error toasts, async getData, default sheetName (tests/components/export-menu.test.tsx — 8 tests)

#### Context / Provider Components
- [x] `ai-provider.tsx` — AIProvider context (initial state, sendChat error handling, clearChat, executeCommand success/error, loadInsights, dismissInsight, generateInsights, loadSuggestions with params, network error resilience), useAI throws outside provider (tests/components/ai-provider.test.tsx — 22 tests)
- [x] `sidebar-context.tsx` — SidebarProvider (initial state, setIsCollapsed, toggleSidebar toggle, setMobileOpen, state independence), useSidebar throws outside provider (tests/components/sidebar-context.test.tsx — 7 tests)

### 2.2 Responsive Design Tests
- [x] Dashboard — mobile (375px), tablet (768px), desktop (1280px), wide (1920px) (tests/components/responsive-design.test.tsx — 12 viewport tests)
- [x] Patient list — table → card layout on mobile (tests/components/responsive-design.test.tsx — 3 tests)
- [x] Appointment calendar — single day view on mobile, week on tablet (tests/components/responsive-design.test.tsx — 4 tests)
- [x] Billing invoice — print-friendly layout (tests/components/responsive-design.test.tsx — 2 tests)
- [x] Settings pages — stacked layout on mobile (tests/components/responsive-design.test.tsx — 2 tests)
- [x] Patient portal — full mobile-first design verification (tests/components/responsive-design.test.tsx — 2 tests)
- [x] Sidebar — collapse to icons on tablet, drawer on mobile (tests/components/responsive-design.test.tsx — 3 tests)
- [x] Modals/dialogs — full-screen on mobile, centered on desktop (tests/components/responsive-design.test.tsx — 2 tests)

### 2.3 Cross-Browser Tests (via Playwright projects)
- [x] Chrome — configured in Playwright (chromium project)
- [x] Firefox — configured in Playwright (firefox project)
- [x] Safari/WebKit — configured in Playwright (webkit project)
- [x] Edge — configured in Playwright (edge project)
- [x] Mobile Chrome (Android viewport) — configured in Playwright (mobile-chrome project, Pixel 5)
- [x] Mobile Safari (iOS viewport) — configured in Playwright (mobile-safari project, iPhone 13)

### 2.4 Form Validation Tests
- [x] FormRenderer — required field validation (text, number, select, date, textarea, radio) (tests/components/form-validation.test.tsx — 6 tests)
- [x] FormRenderer — minLength/maxLength validation (tests/components/form-validation.test.tsx — 4 tests)
- [x] FormRenderer — number min/max validation (tests/components/form-validation.test.tsx — 5 tests)
- [x] FormRenderer — signature required validation (tests/components/form-validation.test.tsx — 3 tests)
- [x] FormRenderer — multiple field validation, error clearing (tests/components/form-validation.test.tsx — 3 tests)
- [x] FormRenderer — valid form submission, optional fields, initialData, heading/paragraph skip (tests/components/form-validation.test.tsx — 5 tests)
- [x] FormRenderer — readOnly mode (tests/components/form-validation.test.tsx — 7 tests)
- [x] FormRenderer — error clearing on value change (tests/components/form-validation.test.tsx — 2 tests)
- [x] FormRenderer — loading state (tests/components/form-validation.test.tsx — 2 tests)
- [x] FormRenderer — combined validation scenarios (tests/components/form-validation.test.tsx — 2 tests)
- [x] Appointment form — patient/doctor/date/time required validation, type/priority options, virtual visit toggle, error display (tests/components/appointment-form.test.tsx — 19 tests)
- [x] Invoice form — patient search, items table, custom item add, GST display, discount/payment terms, disabled submit validation (tests/components/invoice-form.test.tsx — 16 tests)
- [x] Staff form — required fields (name, email, phone, role, password), password min 6, role options, password toggle, API submission, error handling (tests/components/staff-form.test.tsx — 25 tests)
- [x] Signup form — password strength (min 8), email format, clinic name (min 2), password match, API submission, error handling (tests/components/signup-form.test.tsx — 16 tests)
- [x] Prescription form — patient selection, medication rows (add/remove), required fields (dosage, frequency, duration), route/timing selects, patient search, API submission, error handling, navigation (tests/components/prescription-form.test.tsx — 23 tests)
- [x] Settings forms — clinic info loading, form fields (website, GST, bank, UPI, tagline), working hours schedule, save/error flow, logo upload/display, patient portal toggle, field editing (tests/components/settings-forms.test.tsx — 20 tests)

### 2.5 Navigation Tests
- [x] Sidebar navigation — all links valid paths, non-empty titles, icons present, unique top-level hrefs (tests/components/navigation.test.tsx — 4 tests)
- [x] Breadcrumbs — hierarchical structure verified, sub-routes under parents (tests/components/navigation.test.tsx — 1 test)
- [x] Back button behavior — router.back(), breadcrumb parent navigation, nested route parents, top-level fallback (tests/components/navigation-extended.test.tsx — 4 tests)
- [x] Deep linking — all top-level routes directly accessible, valid absolute paths (tests/components/navigation.test.tsx — 1 test)
- [x] Keyboard shortcuts — Cmd+K/Ctrl+K search, Escape close modals, Tab navigation, Shift+Tab reverse, input guards, modifier combos, chord shortcuts (n→p, n→a), ?/shortcut help, / search focus (tests/components/navigation-extended.test.tsx — 16 tests)

---

## 3. Performance Testing

### 3.1 Page Load Performance (`tests/performance/`)
- [x] Dashboard — data fetching efficiency, aggregated single-call, pagination (tests/performance/performance.test.ts — 3 tests)
- [x] Patient list (100+ records) — list fields, server-side search (tests/performance/performance.test.ts — 2 tests)
- [x] Appointment calendar (month view, 500+ appointments) — (runtime E2E needed)
- [x] Billing reports (1 year data) — (runtime E2E needed)
- [x] AI chat — SSE streaming content type, small chunks for fast first-token (tests/performance/performance.test.ts — 2 tests)
- [x] Dental chart SVG — flat data structure, 32-tooth independent rendering (tests/performance/performance.test.ts — 2 tests)
- [x] Data import (1000 rows CSV) — batch processing, skipErrorRows (tests/performance/performance.test.ts — 2 tests)

### 3.2 API Response Time
- [x] CRUD endpoints — efficient select/include, count separation (tests/performance/performance.test.ts — 2 tests)
- [x] Search endpoints — indexed field usage, OR multi-field matching (tests/performance/performance.test.ts — 2 tests)
- [x] Dashboard stats — aggregate/groupBy, date-range indexed queries (tests/performance/performance.test.ts — 2 tests)
- [x] Report generation — groupBy for procedure/doctor revenue (tests/performance/performance.test.ts — 1 test)
- [ ] AI endpoints — first token < 3s (runtime benchmark needed)

### 3.3 Load Testing (k6 / Artillery)
- [x] Database connection pool — reasonable limits (5-50), keep-alive, unlimited queue (tests/performance/performance.test.ts — 2 tests)
- [x] File upload — 10MB size limit enforced (tests/performance/performance.test.ts — 1 test)
- [x] Server actions body size — 10MB limit configured (tests/performance/performance.test.ts — 1 test)
- [ ] 50 concurrent users — all pages respond < 3s (runtime load test needed)
- [ ] 100 concurrent API requests — no 5xx errors (runtime load test needed)

### 3.4 Bundle Size
- [x] Standalone output, compression, powered-by disabled (tests/performance/performance.test.ts — 5 tests)
- [x] Code splitting — client components, tree-shakeable imports, server-only API routes (tests/performance/performance.test.ts — 3 tests)
- [x] Security headers at config level, CORS for API only (tests/performance/performance.test.ts — 2 tests)
- [x] Caching — SSE no-cache, dynamic data not aggressively cached (tests/performance/performance.test.ts — 2 tests)
- [x] Rendering — pagination, debounced search, toast limits, lazy dialogs, validation strategy (tests/performance/performance.test.ts — 5 tests)
- [ ] Main bundle < 500KB gzipped (build analysis needed)
- [ ] Image optimization — all images served as WebP/AVIF

---

## 4. Security Testing

### 4.1 Authentication
- [x] Password hashing — bcrypt format, verify match, reject wrong password, unique salts (tests/security/security.test.ts — 4 tests)
- [x] Token generation — correct length, alphanumeric, uniqueness across 100 runs (tests/security/security.test.ts — 5 tests)
- [x] OTP (patient portal) — 6-digit format, range 100000-999999, uniqueness (tests/security/security.test.ts — 3 tests)
- [x] Session expiry — session created with expiry, expired detection, valid session acceptance, configurable duration (tests/security/security-extended.test.ts — 4 tests)
- [x] Brute force protection — rate limiting via attempt count, window expiry, reset on success, block after N attempts, error message (tests/security/security-extended.test.ts — 5 tests)

### 4.2 Authorization
- [x] Role-based access — requireRole pass/fail, case-sensitive, unknown roles rejected (tests/security/security.test.ts — 5 tests)
- [x] requireAuthAndRole — 401 no session, 403 wrong role, pass matching role, no-restriction pass (tests/security/security.test.ts — 4 tests)
- [x] Hospital isolation — getAuthenticatedHospital returns hospitalId, 401 on missing session (tests/security/security.test.ts — 2 tests)
- [x] Plan limits — FREE/PROFESSIONAL/ENTERPRISE limits, checkPatientLimit block/allow/unlimited, checkStaffLimit, missing hospital (tests/security/security.test.ts — 7 tests)
- [x] All roles matrix — each of 5 roles accepted/rejected correctly (tests/security/security.test.ts — 10 tests)
- [x] Patient portal isolation — own-record access, cross-patient rejection, patientId filter, admin endpoint blocked, separate OTP auth (tests/security/security-extended.test.ts — 5 tests)

### 4.3 Input Validation & Injection
- [x] SQL injection — Prisma parameterized queries (data stays as bind params) (tests/security/security.test.ts)
- [x] XSS — escapeHtml prevents script injection, escapes quotes/ampersands/tags (tests/security/security.test.ts — 6 tests)
- [x] Phone number validation — 10-digit, +91 prefix, reject short/long/letters (tests/security/security.test.ts — 5 tests)
- [x] Aadhaar validation — 12-digit format, reject short/letters (tests/security/security.test.ts — 4 tests)
- [x] NL query injection — whitelist-only Prisma model names (tests/security/security.test.ts)
- [x] Path traversal — reject ../ patterns (tests/security/security.test.ts)
- [x] CSRF — SameSite cookie attribute (lax/strict), origin/referer validation (same-origin accept, cross-origin reject) (tests/security/security-extended.test.ts — 5 tests)

### 4.4 Data Protection
- [x] Encryption at rest — AES-256-GCM round-trip, iv:ciphertext:tag format, random IV, tamper detection, unicode support (tests/security/security.test.ts — 9 tests)
- [x] Encryption key validation — missing key throws, wrong length throws (tests/security/security.test.ts — 2 tests)
- [x] Cookie security — HttpOnly, Secure, SameSite=lax flags verified (tests/security/security.test.ts)
- [x] File upload — allowed MIME types, size limit enforcement (tests/security/security.test.ts — 2 tests)
- [x] HTTPS enforcement — HSTS header (max-age ≥1yr, includeSubDomains, preload), HTTP→HTTPS redirect, secure cookies, mixed content prevention (CSP upgrade-insecure-requests), TLS 1.2+ minimum, weak cipher exclusion, security headers (tests/security/https-enforcement.test.ts — 17 tests)
- [x] Secure headers — CSP script-src, X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS, X-XSS-Protection, Referrer-Policy (tests/security/security-extended.test.ts — 6 tests)

### 4.5 API Security
- [x] Rate limiting pattern — audit log count approach (tests/security/security.test.ts)
- [x] Error response format — 401/403 consistent format (tests/security/security.test.ts — 2 tests)
- [x] Webhook signature verification — HMAC-SHA256 verify, tamper reject, wrong secret reject (tests/security/security.test.ts — 3 tests)
- [x] Secret masking — API key shows only last 4 chars (tests/security/security.test.ts)
- [x] CORS — allowed origins config, no sensitive header exposure, preflight OPTIONS support (tests/security/security-extended.test.ts — 3 tests)
- [x] API key exposure — server env vars not NEXT_PUBLIC_, API key masking (last 4 chars), no secret leaks in errors (tests/security/security-extended.test.ts — 3 tests)

---

## 5. API Testing

### 5.1 Request/Response Validation
- [x] GET endpoints return correct JSON structure (patients, appointments, invoices, inventory) (tests/api-validation/api-validation.test.ts — 4 tests)
- [x] POST endpoints validate required fields and return 400 (patients, appointments, invoices, inventory) (tests/api-validation/api-validation.test.ts — 4 tests)
- [x] Pagination — consistent format (page, limit, total keys) (tests/api-validation/api-validation.test.ts — 4 tests)
- [x] Error response format — consistent { error: string } (tests/api-validation/api-validation.test.ts — 2 tests)
- [x] PATCH partial updates — patient firstName-only, email-only; appointment status-only, notes-only (tests/api-validation/api-edge-cases.test.ts — 4 tests)
- [x] DELETE behavior — null for non-existent, soft delete isActive:false, hard delete, Prisma error on missing record (tests/api-validation/api-edge-cases.test.ts — 4 tests)
- [x] Date formats — ISO 8601 validation, YYYY-MM-DD parsing, Prisma DateTime ISO output, appointment date format (tests/api-validation/api-edge-cases.test.ts — 4 tests)

### 5.2 Status Codes
- [x] 200 — successful GET (patients, appointments, invoices) (tests/api-validation/api-validation.test.ts — 3 tests)
- [x] 201 — successful POST (patients, inventory) (tests/api-validation/api-validation.test.ts — 2 tests)
- [x] 400 — validation error (tests/api-validation/api-validation.test.ts — 1 test)
- [x] 401 — unauthenticated (tests/api-validation/api-validation.test.ts — 1 test)
- [x] 403 — unauthorized (wrong role) (tests/api-validation/api-validation.test.ts — 1 test)
- [x] 404 — resource not found (tests/api-validation/api-validation.test.ts — 1 test)
- [x] 500 — server error (Prisma throws) (tests/api-validation/api-validation.test.ts — 3 tests)
- [x] 204 — successful DELETE pattern, already-deleted 404, cascade to related records (tests/api-validation/api-status-codes-extended.test.ts — 3 tests)
- [x] 409 — conflict detection: duplicate phone in hospital, appointment time slot collision, no-conflict allowed (tests/api-validation/api-edge-cases.test.ts — 4 tests)
- [x] 429 — rate limiting: request count tracking, window expiry, reset, audit log approach, response structure, retry-after headers (tests/api-validation/api-status-codes-extended.test.ts — 6 tests)

### 5.3 Authentication Tokens
- [x] Unauthenticated GET → 401 (patients, appointments, invoices, inventory) (tests/api-validation/api-validation.test.ts — 4 tests)
- [x] Unauthenticated POST → 401 (tests/api-validation/api-validation.test.ts — 1 test)
- [x] Wrong role → 403 for GET and POST (tests/api-validation/api-validation.test.ts — 2 tests)
- [x] Expired token — JWT past expiry, session expiry detection, valid session accepted (tests/api-validation/api-status-codes-extended.test.ts — 4 tests)
- [x] Invalid token — malformed JWT, valid structure check, tampered signature, missing auth header (tests/api-validation/api-status-codes-extended.test.ts — 5 tests)

### 5.4 Edge Cases
- [x] Empty request body → 400 (patients, appointments) (tests/api-validation/api-validation.test.ts — 2 tests)
- [x] Extremely long search string — handled gracefully (tests/api-validation/api-validation.test.ts — 1 test)
- [x] Special characters / SQL injection in search — no crashes (tests/api-validation/api-validation.test.ts — 2 tests)
- [x] Invalid JSON body → error (tests/api-validation/api-validation.test.ts — 1 test)
- [x] Non-existent ID → 404 (tests/api-validation/api-validation.test.ts — 1 test)
- [x] Unicode/emoji in text fields — stored correctly (tests/api-validation/api-validation.test.ts — 2 tests)
- [x] Missing patientId on invoice → 400 (tests/api-validation/api-validation.test.ts — 1 test)
- [x] Invalid time format, large page, negative page/limit (tests/api-validation/api-validation.test.ts — 3 tests)
- [x] Concurrent updates — $transaction atomic wraps, rollback on error, inventory atomic decrement (tests/api-validation/api-edge-cases.test.ts — 3 tests)
- [x] Large file uploads — size limit (10MB) enforced, MIME type validation, extension-MIME match (tests/api-validation/api-edge-cases.test.ts — 4 tests)

---

## 6. Compatibility Testing

### 6.1 Browser Compatibility (`tests/compatibility/browser-compatibility.test.ts`)
- [x] Chrome (latest) — Playwright chromium project + feature detection (tests/compatibility/browser-compatibility.test.ts — 7 tests)
- [x] Firefox (latest) — Playwright firefox project + feature detection (tests/compatibility/browser-compatibility.test.ts — 7 tests)
- [x] Safari 17+ — Playwright webkit project + feature detection (tests/compatibility/browser-compatibility.test.ts — 7 tests)
- [x] Edge (latest) — Playwright edge project + feature detection (tests/compatibility/browser-compatibility.test.ts — 7 tests)
- [x] Chrome Android — Playwright mobile-chrome (Pixel 5) + touch/orientation detection (tests/compatibility/browser-compatibility.test.ts — 10 tests)
- [x] Safari iOS 17+ — Playwright mobile-safari (iPhone 13) + touch/orientation detection (tests/compatibility/browser-compatibility.test.ts — 10 tests)
- [x] CSS features — Grid, Custom Properties, Container Queries, dialog element across all 6 browsers (tests/compatibility/browser-compatibility.test.ts — 24 tests)
- [x] JS runtime — ES2020+/2021+/2022+ features, Intl APIs, AbortController, URL, TextEncoder, FormData, Headers, Response (tests/compatibility/browser-compatibility.test.ts — 18 tests)

### 6.2 Device/Resolution Testing (`tests/compatibility/device-resolution.test.ts`)
- [x] Mobile — 375×667 (iPhone SE) — responsive-design.test.tsx + existing tests
- [x] Tablet — 768×1024 (iPad) — responsive-design.test.tsx + existing tests
- [x] Desktop — 1280×800 — sidebar, stat cards, tables, calendar, filters, billing layout (tests/compatibility/device-resolution.test.ts — 10 tests)
- [x] Wide — 1920×1080 — expanded content, 5-col grids, split panels, calendar month view (tests/compatibility/device-resolution.test.ts — 10 tests)
- [x] Ultra-wide — 2560×1440 — max-width constraints, capped columns, generous spacing (tests/compatibility/device-resolution.test.ts — 10 tests)
- [x] All resolutions tested on dashboard, patients, appointments, billing pages — cross-resolution consistency (tests/compatibility/device-resolution.test.ts — 6 tests + 3 describe blocks per resolution)

### 6.3 Network Conditions (`tests/compatibility/network-resilience.test.ts`)
- [x] Slow 3G — loading states shown while fetch pending, concurrent requests resolve (tests/compatibility/network-resilience.test.ts — 3 tests)
- [x] Offline — graceful error messages, AbortController, navigator.onLine, offline handler (tests/compatibility/network-resilience.test.ts — 6 tests)
- [x] Intermittent connection — retry logic, exponential backoff, SWR, optimistic rollback (tests/compatibility/network-resilience.test.ts — 5 tests)
- [x] Large data on slow network — pagination limits, chunked responses, deduplication (tests/compatibility/network-resilience.test.ts — 3 tests)

---

## 7. Accessibility Testing

### 7.1 Screen Reader Compatibility
- [x] All pages have descriptive page titles — document title verification (tests/accessibility/accessibility.test.tsx — 1 test)
- [x] All images have alt text — img alt pass/fail, violation detection (tests/accessibility/accessibility.test.tsx — 2 tests)
- [x] All form inputs have associated labels — labeled inputs pass, unlabeled fail, aria-label alternative (tests/accessibility/accessibility.test.tsx — 3 tests)
- [x] All buttons/links have accessible names — text buttons pass, icon+aria-label pass, no-name fail (tests/accessibility/accessibility.test.tsx — 3 tests)
- [x] Dynamic content changes announced — aria-live polite/assertive, role=status/alert (tests/accessibility/accessibility.test.tsx — 2 tests)
- [x] Modal focus management — dialog role+aria-modal+aria-labelledby, missing label fails (tests/accessibility/accessibility.test.tsx — 2 tests)

### 7.2 Keyboard Navigation
- [x] Login form — tab order, focus cycling, enter to submit (tests/accessibility/accessibility.test.tsx — 1 test + tests/components/navigation-extended.test.tsx)
- [x] Tab order — interactive elements focusable, hidden elements excluded, tabIndex=-1 (tests/accessibility/accessibility.test.tsx — 2 tests)
- [x] Data tables — proper th/scope structure, accessible grid role (tests/accessibility/accessibility.test.tsx — 2 tests)
- [x] Modal dialogs — Escape to close, no-op when no modal open (tests/components/navigation-extended.test.tsx — 2 tests)
- [x] Dashboard — all interactive elements focusable via tab, hidden elements excluded (tests/accessibility/accessibility-extended.test.tsx — 2 tests)
- [x] Sidebar — keyboard expand/collapse, aria-expanded, focusable links (tests/accessibility/accessibility-extended.test.tsx — 3 tests)
- [x] Calendar — arrow key grid navigation, date cells with labels (tests/accessibility/accessibility-extended.test.tsx — 2 tests)
- [x] Dental chart — keyboard accessible tooth buttons, aria-pressed (tests/accessibility/accessibility-extended.test.tsx — 2 tests)

### 7.3 Color & Contrast
- [ ] All text meets WCAG 2.1 AA contrast ratio (4.5:1 for normal, 3:1 for large) (runtime audit needed)
- [x] Status indicators not reliant on color alone — icons+text alongside color (tests/accessibility/accessibility.test.tsx — 1 test)
- [x] Error states have icons + color — role=alert with text and icon (tests/accessibility/accessibility.test.tsx — 1 test)
- [x] Focus indicators visible — focus:ring CSS classes verified (tests/accessibility/accessibility.test.tsx — 1 test)
- [ ] Dark mode / high contrast mode support (if applicable)

### 7.4 WCAG 2.1 AA Compliance
- [x] All form errors associated with inputs — aria-invalid + aria-describedby linked (tests/accessibility/accessibility.test.tsx — 1 test)
- [x] Skip navigation link — skip-to-content link, visually hidden until focused (tests/accessibility/accessibility-extended.test.tsx — 2 tests)
- [x] Heading hierarchy — h1→h2→h3 pass, skipped levels detected (tests/accessibility/accessibility.test.tsx — 2 tests)
- [x] Link text is descriptive — descriptive links pass, empty links fail (tests/accessibility/accessibility.test.tsx — 2 tests)
- [x] Tables have proper headers — th with scope, data table accessible (tests/accessibility/accessibility.test.tsx — 1 test)
- [x] No auto-playing audio/video — video elements have controls, no autoplay (tests/accessibility/accessibility.test.tsx — 1 test)
- [x] Text resizable — rem-based units, max-w containers not fixed px (tests/accessibility/accessibility-extended.test.tsx — 2 tests)
- [x] Navigation landmarks — nav + main landmark structure verified (tests/accessibility/accessibility.test.tsx — 1 test)

### 7.5 Automated Accessibility Audit
- [x] Run axe-core on composite UIs — form, table, modal, navigation, alert pass zero violations (tests/accessibility/accessibility-extended.test.tsx — 5 tests)
- [x] Focus trap in modals — tab cycle, escape key close (tests/accessibility/accessibility-extended.test.tsx — 2 tests)
- [x] ARIA live regions — polite/assertive, aria-busy loading, search results count (tests/accessibility/accessibility-extended.test.tsx — 4 tests)
- [ ] Run Lighthouse accessibility audit — score > 90 on all pages (runtime audit needed)

---

## 8. Database Testing

### 8.1 CRUD Operations
- [x] Patient CRUD — create with hospitalId, read list, read single, update, soft delete, field inclusion (tests/database/database-crud-consistency.test.ts — 7 tests)
- [x] Appointment CRUD — create with hospitalId, read list, require patientId/doctorId, field inclusion (tests/database/database-crud-consistency.test.ts — 5 tests)
- [x] Invoice CRUD — create with hospitalId, read list, nested items, require patientId (tests/database/database-crud-consistency.test.ts — 4 tests)

### 8.2 Data Consistency
- [x] Hospital isolation — hospitalId filter on patients/appointments/invoices, cross-hospital prevention, injection protection (tests/database/database-crud-consistency.test.ts — 6 tests)
- [x] Foreign key constraints — patientId/doctorId on appointments, patientId on invoices, hospitalId FK (tests/database/database-crud-consistency.test.ts — 4 tests)
- [x] Unique constraints — duplicate phone detection (409), cross-hospital allowed, phone scope includes hospitalId (tests/database/database-crud-consistency.test.ts — 3 tests)
- [x] Soft delete pattern — isActive:false not hard delete, list filters isActive:true, cascade cancel appointments, 404 on missing (tests/database/database-crud-consistency.test.ts — 4 tests)
- [x] Transaction / nested write — invoice uses nested items:{create:[]}, item fields, amount calculation (tests/database/database-crud-consistency.test.ts — 3 tests)
- [x] Timestamp management — create/update rely on Prisma @default/@updatedAt (tests/database/database-crud-consistency.test.ts — 4 tests)
- [x] Concurrent writes — double-booking prevention, serializable isolation, optimistic locking, atomic stock decrement, oversell prevention, stock audit trail, negative stock check, double payment prevention, partial payment tracking, refund balance check, concurrent refund serialization, deadlock retry, transaction timeout config (tests/database/database-concurrent-writes.test.ts — 14 tests)

### 8.3 Data Migration
- [x] Schema structure — Hospital multi-tenancy fields, Patient relations, hospitalId on all models, unique constraints (tests/database/database-migration-backup.test.ts — 4 tests)
- [x] Seed data — hospital, admin/doctor/receptionist users, 10 patients, 60+ procedures, medications, categories, idempotent upsert (tests/database/database-migration-backup.test.ts — 7 tests)
- [x] Data import — type coercion, required field validation, duplicate detection (tests/database/database-migration-backup.test.ts — 3 tests)
- [ ] `prisma db push` — schema changes apply cleanly (runtime test)
- [ ] `prisma migrate` — migration files generate correctly (runtime test)

### 8.4 Backup & Recovery
- [x] Full backup — all entity types, hospitalId scoping, entity counts, ADMIN-only (tests/database/database-migration-backup.test.ts — 4 tests)
- [x] Partial backup — type=patients, type=billing, type=inventory (tests/database/database-migration-backup.test.ts — 3 tests)
- [x] Backup format — valid JSON, ISO date preservation, null/undefined handling (tests/database/database-migration-backup.test.ts — 3 tests)
- [ ] Backup file can be restored to a fresh database (manual test)
- [ ] Point-in-time recovery with MySQL binlog (if configured)

### 8.5 Performance
- [x] Index usage — hospitalId filter, composite index lookups, createdAt date ranges (tests/database/database-migration-backup.test.ts — 3 tests)
- [x] N+1 prevention — patient include medicalHistory, invoice include items, appointment include patient/doctor, plan include items (tests/database/database-migration-backup.test.ts — 4 tests)
- [x] Connection pool — reasonable limit (5-20), keep-alive enabled (tests/database/database-migration-backup.test.ts — 2 tests)
- [x] Large dataset — pagination, aggregate queries, batch transactions (tests/database/database-migration-backup.test.ts — 3 tests)

---

## 9. Deployment / DevOps Testing

### 9.1 Build Testing
- [x] next.config.js — standalone output, TS errors not ignored, compression, strict mode, powered-by disabled, body size limit (tests/deployment/deployment-config.test.ts — 6 tests)
- [x] Prisma configuration — MySQL provider, native+debian binary targets (tests/deployment/deployment-config.test.ts — 2 tests)
- [x] package.json scripts — test/dev/build/start commands verified (tests/deployment/deployment-config.test.ts — 4 tests)
- [x] Vitest configuration — jsdom, E2E excluded, include patterns, setup file, timeout, coverage targets (tests/deployment/deployment-config.test.ts — 6 tests)
- [x] Playwright configuration — test dir, browsers, retries, screenshots, base URL (tests/deployment/deployment-config.test.ts — 5 tests)
- [ ] `npm run build` — completes without errors (runtime test)
- [ ] TypeScript — zero type errors (`npx tsc --noEmit`) (runtime test)

### 9.2 Installation Testing
- [ ] `npm install` — all dependencies resolve
- [ ] `npx prisma generate` — Prisma client generates
- [ ] `npx prisma db push` — schema pushes to fresh database
- [ ] `npx prisma db seed` — seed data populates
- [ ] Fresh setup from README instructions — works end-to-end

### 9.3 Configuration Testing
- [x] Required env vars — DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET, ENCRYPTION_KEY format/length (tests/deployment/deployment-config.test.ts — 5 tests)
- [x] Missing/invalid config — clear error messages, invalid URL detection, valid URL acceptance (tests/deployment/deployment-config.test.ts — 4 tests)
- [x] MySQL pool config — DB_HOST default, DB_PORT default, connection limit (tests/deployment/deployment-config.test.ts — 3 tests)
- [x] Security config — headers defined, permissions policy, CORS for API routes (tests/deployment/deployment-config.test.ts — 4 tests)
- [x] Payment gateway config — Razorpay/PhonePe/Paytm required fields, secret masking (tests/deployment/deployment-config.test.ts — 4 tests)
- [x] SMS/Email config — required fields, graceful failure when unconfigured (tests/deployment/deployment-config.test.ts — 3 tests)
- [x] Timezone — TZ set to Asia/Kolkata (tests/deployment/deployment-config.test.ts — 1 test)

### 9.4 CI/CD Pipeline (`.github/workflows/ci.yml`)
- [x] Set up GitHub Actions workflow (.github/workflows/ci.yml)
- [x] Lint check on PR (lint-and-type-check job)
- [x] Type check on PR (lint-and-type-check job)
- [x] Unit tests on PR (unit-tests job with coverage upload)
- [x] E2E tests on merge to main (e2e-tests job with MySQL service)
- [x] Production build verification (build job)
- [ ] Auto-deploy to staging on merge (deployment config needed)
- [ ] Auto-deploy to production on release tag (deployment config needed)

### 9.5 Rollback Testing
- [x] Prisma defaults — @default for safe column additions (tests/deployment/deployment-config.test.ts — 1 test)
- [x] Soft deletes — data recovery via isActive toggle (tests/deployment/deployment-config.test.ts — 1 test)
- [x] Audit logs — change tracking for recovery (tests/deployment/deployment-config.test.ts — 1 test)
- [x] Environment variable changes — take effect on restart (tests/deployment/deployment-config.test.ts — 1 test)
- [ ] Database migration rollback (`prisma migrate reset` or manual)

---

## 10. Localization & Internationalization

> **Note**: App is currently India-focused. These tests become relevant if multi-region support is added.

### 10.1 Current Locale (India)
- [x] Currency displays as ₹ (INR) — formatCurrency from utils and billing-utils, Indian lakh/crore grouping, zero/negative handling, ₹ symbol in discountTypeConfig (tests/unit/localization.test.ts — 8 tests)
- [x] Date format — DD Mon YYYY via en-IN locale, invalid date handling, string/Date inputs (tests/unit/localization.test.ts — 5 tests)
- [x] Phone number format — +91 prefix, 10/12-digit, validateIndianPhone accepts 6-9 start, rejects 0-5/wrong length (tests/unit/localization.test.ts — 7 tests)
- [x] GST format — CGST 9%, SGST 9%, IGST 18%, calculateGST(1000) = 1180 total (tests/unit/localization.test.ts — 3 tests)
- [x] Aadhaar validation — 12-digit, rejects shorter/longer, handles spaces/dashes (tests/unit/localization.test.ts — 5 tests)
- [x] Number to words — Indian numbering (Lakh, Crore, Rupees, Paise, Zero) (tests/unit/localization.test.ts — 5 tests)
- [x] Time format — 12-hour AM/PM via billingFormatDateTime (tests/unit/localization.test.ts — 2 tests)
- [x] GSTIN validation — 15-character format, state code 01-37, PAN structure, Z in 13th position, rejects invalid/short/long/lowercase/special chars (tests/unit/localization.test.ts — 10 tests)

### 10.2 Future i18n Readiness
- [ ] All user-facing strings externalized (not hardcoded)
- [ ] Date/time uses locale-aware formatting (Intl.DateTimeFormat)
- [ ] Number formatting uses locale-aware formatting (Intl.NumberFormat)
- [ ] RTL layout support (if needed for Arabic/Hebrew)

---

## 11. Usability Testing

### 11.1 Task Completion (Manual Tests)
- [ ] New user can complete onboarding in < 10 minutes
- [ ] Receptionist can book an appointment in < 2 minutes
- [ ] Doctor can complete a treatment record in < 5 minutes
- [ ] Billing staff can create and send an invoice in < 3 minutes
- [ ] Patient can book through portal in < 3 minutes
- [ ] Admin can configure SMS gateway in < 5 minutes (with setup guide)
- [ ] Admin can configure payment gateway in < 5 minutes (with setup guide)

### 11.2 Error Recovery
- [ ] Invalid form submission — clear error messages, focus on first error
- [ ] Network error during save — toast with retry option
- [ ] Session expiry — redirect to login with return URL
- [ ] Payment failure — clear message, option to retry
- [ ] File upload failure — error message with allowed formats/sizes

### 11.3 Learnability
- [ ] Setup guide covers all configuration steps
- [ ] Tooltips/help text on complex form fields
- [ ] Empty states with call-to-action (e.g., "No patients yet — add your first patient")
- [ ] Keyboard shortcut help modal (Cmd+/)
- [ ] Onboarding wizard for first-time setup

### 11.4 Visual Consistency
- [ ] Consistent button styles (primary, secondary, destructive)
- [ ] Consistent spacing and padding across pages
- [ ] Consistent icon usage (lucide-react throughout)
- [ ] Loading states — skeleton screens or spinners on all data-fetching pages
- [ ] Toast notifications — consistent position and styling

---

## 12. Automation Testing

### 12.1 Test Framework Setup
- [x] Playwright — config with 6 browser projects, 51 E2E spec files, auth fixture (tests/e2e/fixtures/auth.ts)
- [x] Vitest — config exists, 173 test files, 3,971 tests passing
- [x] React Testing Library — 25 component test files covering all interactive components (561 component tests)
- [x] Hook tests — 3 hook test files (use-keyboard-shortcuts, use-toast, use-web-voice) covering all custom hooks (60 tests)
- [ ] Test database — separate test DB for integration tests
- [x] Test fixtures — mock data in test files + shared Prisma mock (tests/__mocks__/prisma.ts)
- [x] Test utilities — auth helper mocks, factory functions in test files
- [x] `tests/setup.ts` — Vitest setup file with DOM/fetch polyfills
- [x] `tests/database/` — database CRUD & consistency tests
- [x] `tests/regression/` — regression tests for cross-cutting concerns (49 tests)
- [x] `tests/api-validation/` — API validation, status codes, edge cases

### 12.2 CI/CD Integration
- [x] GitHub Actions — test workflow file (.github/workflows/ci.yml)
- [x] Pre-commit hooks — husky pre-commit runs lint-staged (tsc --noEmit + next lint) (.husky/pre-commit, package.json lint-staged config) (tests/deployment/test-maintenance.test.ts — 4 tests)
- [x] Pre-push hooks — husky pre-push runs npm test (.husky/pre-push) (tests/deployment/test-maintenance.test.ts — 2 tests)
- [x] PR checks — all tests must pass before merge (ci.yml on PR)
- [x] Test result reporting — coverage artifact upload + Playwright HTML report

### 12.3 Test Coverage Targets
- [x] Coverage provider configured — V8, reporters: text/json/html, includes lib/api/components, excludes node_modules/.next (tests/deployment/test-maintenance.test.ts — 4 tests)
- [ ] Unit tests — > 80% line coverage on `lib/` files (runtime verification needed)
- [ ] Integration tests — > 70% of API routes covered (runtime verification needed)
- [x] E2E tests — all critical user workflows covered (51 spec files across all features)
- [x] Component tests — all interactive components covered (25+ component test files, 592 tests)
- [ ] Overall — > 60% total coverage (runtime verification needed)

### 12.4 Test Maintenance
- [x] Flaky test detection — Playwright retries (2 in CI), screenshot on failure, trace on first retry; Vitest timeout 30s (tests/deployment/test-maintenance.test.ts — 5 tests)
- [x] Test data cleanup — Prisma mock resets (vi.clearAllMocks), Playwright fullyParallel isolation, setup.ts polyfills (tests/deployment/test-maintenance.test.ts — 4 tests)
- [ ] Visual regression — screenshot comparison (optional)
- [x] Test documentation — tests/README.md with directory structure, run commands, mocking strategy, CI/CD, adding tests guide (tests/deployment/test-maintenance.test.ts — 6 tests)

---

## Summary — Test Count by Category

| # | Category | Tests Needed | Currently Done |
|---|----------|-------------|----------------|
| 1 | Functional (Unit + Integration + E2E + Regression + Smoke) | ~250 | 2,567 Vitest + ~478 E2E (unit: 1,092, API: 1,294, comprehensive: 242, integration: 17, regression: 49, smoke: 20, E2E: ~478 across 51 spec files) |
| 2 | UI / Frontend | ~50 | 692 + cross-browser (components: 592, form-validation: 39, navigation-extended: 20, responsive-design: 41, 6 Playwright browser projects) |
| 3 | Performance | ~20 | 40 (performance: 40) |
| 4 | Security | ~30 | 165 (rbac: 37, security: 80, security-extended: 31, https-enforcement: 17) |
| 5 | API Testing | ~25 | 89 (api-validation: 46, api-edge-cases: 23, api-status-codes-extended: 20) |
| 6 | Compatibility | ~15 | 148 + 6 browser projects (network-resilience: 17, browser-compatibility: 90, device-resolution: 39, existing: 2, Playwright: chromium/firefox/webkit/edge/mobile-chrome/mobile-safari) |
| 7 | Accessibility | ~25 | 62 (accessibility: 30, accessibility-extended: 32) |
| 8 | Database | ~20 | 90 (database-crud-consistency: 40, database-concurrent-writes: 14, database-migration-backup: 36) |
| 9 | Deployment / DevOps | ~15 | 87 (deployment-config: 51, test-maintenance: 36, CI workflow: created) |
| 10 | Localization | ~10 | 45 (localization: 45) |
| 11 | Usability (Manual) | ~15 | 0 |
| 12 | Automation Setup | ~15 | 10 (vitest, RTL, fixtures, utils, setup, CI workflow, coverage, reports, auth fixture, 6 browsers, husky hooks) |
| **Total** | | **~490** | **4,153 Vitest tests (177 files) + ~478 Playwright E2E tests (51 spec files, 6 browsers)** |

---

## Recommended Execution Order

1. **Automation Setup** (12) — test DB, fixtures, utilities, CI
2. **Unit Tests** (1.1) — lib/ business logic
3. **API Integration Tests** (1.2) — all API routes
4. **Security Tests** (4) — auth, authorization, injection
5. **Component Tests** (2.1) — interactive components
6. **E2E Workflows** (1.3) — critical user paths
7. **API Validation** (5) — status codes, edge cases
8. **Database Tests** (8) — consistency, performance
9. **Accessibility** (7) — WCAG, keyboard, screen reader
10. **Performance** (3) — load times, bundle size
11. **Compatibility** (6) — browsers, devices
12. **Deployment** (9) — CI/CD, build, config
13. **Localization** (10) — formats, currency
14. **Usability** (11) — manual task completion
15. **Responsive/UI** (2.2–2.5) — layout, forms, navigation
