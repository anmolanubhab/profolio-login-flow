# K3-C — Tax & Compliance Decision Record

Status: **TAX PRODUCTION BLOCKED**
Owner: (unassigned — needs a business/finance owner before real charging)
Last updated: 2026-09-03 (K3-C Remediation)

This document exists because the K3-C Remediation phase deliberately did **not**
implement tax. It records what must be decided and built before Profolio can
charge real money for advertising in production.

---

## Current state (test mode)

- Every invoice is created with `tax_cents = 0` and `total_cents = subtotal_cents`.
- `ad_billing_profiles` already captures `billing_country`, `state_region`,
  `postal_code`, `tax_id_type`, `tax_id_value` and snapshots them onto each
  invoice (`billing_profile_snapshot`) at settlement time — so the data needed
  to compute tax is being collected, it is just not used.
- All money is simulated (`ad_provider_config.test_mode = true`). No tax
  liability is being incurred or misreported because nothing is really charged.

## Decisions required before production charging (K3-C+)

1. **Nexus / registration.** In which countries and sub-jurisdictions will
   Profolio be a registered taxpayer for advertising services (US sales tax /
   state economic nexus, EU/UK VAT, India GST, etc.)? This is a legal/finance
   determination, not an engineering one.
2. **Tax engine.** Build in-house rate tables, or integrate a tax provider
   (Stripe Tax, Avalara, TaxJar, …). If a provider: it must sit behind the same
   `PaymentProvider`-style abstraction and must **not** be wired to a real
   account during any sandbox phase.
3. **B2B reverse charge / tax-ID validation.** EU VAT reverse charge, VIES /
   GSTIN validation, US resale certificates — which apply, and is the
   validation blocking or advisory?
4. **Inclusive vs exclusive pricing.** Are advertiser budgets tax-exclusive
   (tax added on top, threshold charge grows) or tax-inclusive (tax carved out
   of the budget)? This changes the K2 spend engine and the threshold model.
5. **Invoice legal requirements.** Sequential invoice numbering per legal
   entity, supplier tax number on the invoice, credit-note handling for
   refunds, retention period, e-invoicing mandates (e.g. India IRN, Italy SdI).
   Current numbering is `INV-YYYYMM-NNNNNN` from a single global sequence —
   revisit before production.
6. **Withholding tax.** Some advertiser jurisdictions require the advertiser to
   withhold tax on payment to Profolio — decide whether that is supported or
   contractually excluded.
7. **Reporting.** Periodic tax return data extract, reconciliation of collected
   vs remitted tax, audit trail. `ad_billing_reconciliation_check` covers money
   movement, not tax.

## Engineering blockers (must be true before flipping tax on)

- [ ] `ad_invoices` gains real `tax_cents`, a `tax_breakdown jsonb` (per
      jurisdiction / rate / taxable amount), and a `tax_provider_ref`.
- [ ] Tax is computed **server-side** at settlement, from the profile snapshot,
      never from client input.
- [ ] Refund path issues a tax credit note, not just a negative ledger line.
- [ ] The K2 threshold / pacing model accounts for tax so an advertiser is not
      silently overcharged past their budget.
- [ ] A fresh Production Readiness Audit explicitly signs off tax.

Until every box above is checked and a finance owner has signed the decisions,
**production charging must not be enabled**, regardless of whether the payment
provider (Stripe) integration itself is ready.
