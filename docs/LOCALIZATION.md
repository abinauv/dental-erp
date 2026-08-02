# Localization & Internationalization

**Status:** step 1 (locale plumbing) is implemented, including the per-person
locale override described in §2.1; steps 2–5 are still proposals. See §3 for the
running order.

DentalERP was built for Indian dental clinics, and that assumption is not confined
to display strings — it reaches into the invoice schema, the tax maths and the seed
data. This document maps what is actually India-specific today, proposes an
architecture, and suggests an order of work.

## 1. Where we are

`next-intl` is wired up and `lib/i18n/` holds the locale config, the request
config and the one formatting module. What remains is the volume: every
user-facing string is still a literal in a `.tsx` file, and the tax model is
still India-shaped.

The counts below are what step 2 onwards has to work through:

| Coupling                      | Count | Where                                 |
| ----------------------------- | ----- | ------------------------------------- |
| `en-IN` locale literals       | 90    | `lib/`, `components/`, `app/`         |
| `₹` glyph hardcoded in markup | 91    | mostly `app/(dashboard)/**`           |
| `'INR'` currency literals     | 28    | formatting helpers and chart tooltips |

`lib/utils.ts`, `lib/billing-utils.ts` and `lib/treatment-utils.ts` used to
carry three near-duplicate `formatCurrency`/`formatDate` pairs, each hardcoding
`en-IN` with slightly different fraction-digit rules. They now delegate to
[`lib/i18n/format.ts`](../lib/i18n/format.ts) and keep their own defaults, so
their output is byte-identical to before. Each also takes an optional `locale`
argument, which is the seam the rest of the work hangs off.

### The parts that are not strings

This is the half that makes localization more than a find-and-replace.

1. **Taxation.** [`lib/billing-utils.ts:210`](../lib/billing-utils.ts#L210) defines
   `gstConfig` (`cgstRate: 9`, `sgstRate: 9`, `igstRate: 18`) and
   [`calculateGST()`](../lib/billing-utils.ts#L218) computes a CGST/SGST split.
   The `Invoice` model stores that split as first-class columns —
   `cgstRate`, `sgstRate`, `cgstAmount`, `sgstAmount` in
   [`prisma/schema.prisma`](../prisma/schema.prisma). **A schema shaped like this
   cannot represent EU VAT, US state + local sales tax, or a zero-rated
   medical exemption.** This is the single largest piece of work.

2. **Amount in words.** [`numberToWords()`](../lib/billing-utils.ts#L572) prints
   invoice totals using the Indian numbering system (`Thousand`, `Lakh`, `Crore`)
   and splits into rupees/paise. Short-scale locales need `Million` / `Billion`.

3. **Clinic identity fields.** The `Hospital` model carries `gstNumber`,
   `panNumber`, `bankIfsc`, `upiId`, `pincode` and a free-text `state` — all
   India-specific, none optional in the UI.

4. **Address forms.** Hardcoded Indian state dropdowns appear in
   `app/(dashboard)/onboarding/page.tsx`, `patients/new/page.tsx`,
   `staff/new/page.tsx`, `settings/clinic/page.tsx` and `lab/vendors/page.tsx`.

5. **Seed data.** [`prisma/seed.ts`](../prisma/seed.ts) seeds an Indian medication
   list and a procedure catalogue. Which drugs may be prescribed is a matter of
   national regulation, so this data is inherently per-country.

## 2. Proposed architecture

### Framework: `next-intl`

Recommended over the alternatives for this codebase:

- **App Router native.** The app is Next.js 16 App Router. `next-intl` works in
  Server Components, so pages stay server-rendered and the full message catalogue
  is not shipped to the browser.
- **`next-i18next` is not an option** — it is Pages Router only.
- **`react-i18next`** works but pushes components toward `"use client"` and a
  larger bundle.
- It builds on the `Intl` primitives we already need for currency and dates, so
  one API covers strings, numbers, dates, plurals and relative time.

The choice is deliberately reversible: the message-catalogue layout below is
essentially identical under `react-i18next`, so switching later is mechanical.

### Locale resolution: per-clinic, not per-URL

This is a logged-in B2B application, not a public marketing site. The locale
should hang off the **`Hospital` record**, not a `/[locale]/` URL segment — that
avoids restructuring every route in `app/(dashboard)/`.

On the `Hospital` model (already added):

```prisma
locale    String @default("en-IN")  // BCP 47
country   String @default("IN")     // ISO 3166-1 alpha-2, drives the tax provider
currency  String @default("INR")    // ISO 4217
timezone  String @default("Asia/Kolkata")
```

The patient-facing surfaces — the patient portal, public booking and public
payment pages — resolve the locale from the clinic being booked, with an optional
override for the patient's own preference. That override is §2.1.

### 2.1 The resolution cascade — implemented

`Hospital.locale` is the clinic's setting. `User.locale` and `Patient.locale` sit
on top of it as personal overrides. Resolution walks from most specific to least
and takes the first **supported** value:

| Surface                   | Resolution                                     | Entry point                                                |
| ------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| Staff UI                  | `User.locale` → `Hospital.locale` → default    | `getLocaleForRequest()`                                    |
| Patient portal            | `Patient.locale` → `Hospital.locale` → default | `getLocaleForRequest()`, or `getLocaleForPatientRequest()` |
| Public pages (no session) | `?lang=` → `Hospital.locale` → default         | `resolvePublicLocale()`                                    |

`getLocaleForRequest()` is what `next-intl` calls. It tries the staff session
first and the portal cookie second, because a browser can hold both at once and
the staff session is the more specific context when it does.

**Both override columns are nullable with no default.** This is the decision
worth understanding before changing anything here:

```prisma
model User {
  // null means "inherit from the clinic" — deliberately NOT defaulted.
  locale String?
}
```

A default would make "never expressed a preference" indistinguishable from
"explicitly chose en-IN", so a clinic changing its own locale would silently
fail to propagate to everyone who had never touched the setting.

Three behaviours follow from that, covered by
[`tests/unit/i18n-cascade.test.ts`](../tests/unit/i18n-cascade.test.ts) for the
resolution itself and
[`tests/api/locale-preferences.test.ts`](../tests/api/locale-preferences.test.ts)
for what the endpoints actually write:

- **Clearing the picker persists `NULL`**, not the clinic's current value.
  Re-selecting whatever the clinic uses today would pin the user to it.
- **An unsupported stored value falls through to the next candidate**, not
  straight to the default. If a locale is retired, its users should land on
  their clinic's locale. This is why resolution uses
  `resolveLocaleCascade(...candidates)` rather than
  `resolveLocale(user ?? clinic)` — the latter treats a non-null unsupported
  value as a decision and skips the clinic entirely.
- **`?lang=` is never written anywhere.** An anonymous visitor has no account to
  store it against, and persisting it would let a shared link change what other
  visitors see.

Failure is never fatal: no session, an unreachable database or a retired locale
all resolve to the default rather than throwing. Formatting must not be able to
take a page down.

**What the override currently changes.** Number and date formatting, and how
amounts are grouped and punctuated — not which currency the clinic bills in, and
not the interface language, because no component calls `useTranslations` yet.
That is step 2 below.

### Layout

```
messages/
  en-IN.json
  en-US.json
  de-DE.json          # etc.
lib/i18n/
  config.ts           # supported locales, default, resolution helpers
  request.ts          # next-intl getRequestConfig — reads Hospital.locale
  format.ts           # the single locale-aware currency/date/number module
lib/tax/
  types.ts            # TaxProvider interface
  providers/
    india-gst.ts      # extracted from lib/billing-utils.ts
    eu-vat.ts
    us-sales-tax.ts
  index.ts            # registry: country code -> provider
prisma/seed-data/
  IN/{medications,procedures}.ts
  US/{medications,procedures}.ts
```

### The tax abstraction

The key move is to stop treating "CGST + SGST" as the shape of tax and start
treating it as _one_ possible breakdown:

```ts
export interface TaxComponent {
  code: string // 'CGST' | 'SGST' | 'VAT' | 'STATE_SALES_TAX'
  label: string // display name, localized
  rate: number // percent
  amount: number
}

export interface TaxResult {
  taxableAmount: number
  components: TaxComponent[]
  totalTax: number
  grandTotal: number
}

export interface TaxProvider {
  readonly country: string
  calculate(
    lineItems: TaxableLineItem[],
    context: { placeOfSupply?: string; clinicRegion?: string }
  ): TaxResult
}
```

`IndiaGSTProvider` reproduces today's behaviour exactly, including the
intra-state (CGST+SGST) versus inter-state (IGST) split that `gstConfig` already
anticipates but `calculateGST()` does not yet implement.

On the schema side, `Invoice.cgstRate/sgstRate/cgstAmount/sgstAmount` are replaced
by a single `taxComponents Json` column holding the serialized `TaxComponent[]`,
with `taxAmount` retained as the scalar total for queries and reporting. The
existing columns should be kept through one release and backfilled, so historical
invoices keep rendering correctly — **an invoice must always re-render with the
tax breakdown that was in force when it was issued**, never with today's rates.

## 3. Suggested order of work

Sequenced so that contributors are not editing the same files simultaneously.

1. ~~**Locale plumbing.**~~ **Done.** `next-intl` wiring, the four `Hospital`
   columns, and `lib/i18n/format.ts` — the single formatting module the three
   former `formatCurrency`/`formatDate` copies now delegate to. Defaults are
   unchanged (`en-IN`/INR), so this step is invisible to existing clinics.
   The per-person override in §2.1 is part of this step: nullable `User.locale`
   and `Patient.locale`, the resolution cascade, and a picker on both surfaces.
   Also invisible by default — a clinic that changes nothing sees no change.
2. **String extraction.** Move literals into `messages/en-IN.json`, one module at
   a time (billing, then patients, then appointments…). Mechanical and highly
   parallelizable once step 1 sets the conventions.
3. **Tax provider abstraction** plus the schema migration and backfill.
4. **Per-country seed data** — medications, procedures, state/region lists.
5. **A second locale end-to-end** as the proof. A non-English, non-INR locale
   (e.g. `de-DE`) exercises VAT, decimal-comma formatting and string expansion
   all at once; a second _English_ locale would mostly exercise currency only.

## 4. Conventions

- **Message keys** are namespaced by feature, not by page:
  `billing.invoice.taxBreakdown`, not `invoicePage.label7`.
- **Never concatenate translated fragments.** Use ICU message format with
  placeholders so translators control word order.
- **No raw `₹` in markup.** Always go through the formatter — the symbol,
  its position and the digit grouping are all locale-dependent
  (`en-IN` groups as `1,00,000`; most locales as `100,000`).
- **Dates in the database stay UTC.** Only presentation is localized.
- **Clinical free text is not translated.** Patient notes, prescriptions and
  diagnoses are entered by clinicians and stored verbatim; machine-translating
  them would be a safety problem.
