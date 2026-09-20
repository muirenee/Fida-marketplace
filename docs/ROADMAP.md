# Fida Marketplace Roadmap

Updated: 20 September 2026

## Candidate implementation status

0.8 adds approval-gated onboarding, kitchen RBAC, taxes/item promotions, cooking notes, direct merchant payment routing, actual driver payment records and layout repairs. See [0.8 source and deployment](RELEASE-0.8.md) and [automated evidence audit](ROADMAP-AUDIT-0.8.json). The prioritized acceptance checklist in 0.8 supersedes the historical next-implementation sequence below.

The 0.6 candidate is deployed and the user confirmed the merchant-list and portal-save fixes work. The 0.7 source adds the customer UI redesign, grouped required modifiers, multiple configurations per cart, embedded live map, background location permission flow, configured driver pay estimates, commercial receipts/commission invoices and portal controls. See [0.7 handoff](RELEASE-0.7.md) for exact scope, deployment and limitations. Milestone checkboxes below remain historical until physical-device and external-provider acceptance is complete.

Traffic-aware embedded routes/ETAs, EBM fiscal integration, automated financial transfers, subscription/social authentication and full conversion analytics are not implemented. Do not describe the platform as full Uber Eats feature parity.

## M0 — Foundation
- [x] Monorepo structure
- [x] Multi-tenant core schema
- [x] Customer / merchant / driver mobile apps
- [x] Admin web control center
- [x] PostgreSQL + Redis infrastructure
- [x] Authentication and refresh sessions
- [x] Tenant-context authorization
- [x] Production Docker deployment
- [x] Permanent Android release signing

## M1 — Marketplace catalog
- [x] Merchant activation and commercial settings
- [x] Branches
- [x] Categories and products
- [x] Customer browse and merchant detail
- [x] Pickup / delivery per branch
- [x] Distance-based delivery pricing
- [ ] Branch opening hours and temporary closures
- [ ] Product variants and add-ons
- [ ] Product images and richer catalog media
- [ ] Search, favourites and merchant discovery improvements

## M2 — Ordering
- [x] Cart and checkout
- [x] Cash checkout
- [x] Merchant accept / reject
- [x] Order state machine
- [x] Pickup workflow
- [x] Customer cancellation before preparation
- [x] Required customer phone number
- [x] Merchandise commission snapshot
- [ ] Push notifications for order status changes
- [ ] Scheduled orders
- [ ] Promo codes and controlled discounts
- [ ] Taxes where required

## M3 — Delivery
- [x] Merchant-managed driver enrollment
- [x] Driver online / offline and availability
- [x] Delivery offer queue
- [x] Multiple simultaneous deliveries per driver
- [x] GPS location updates
- [x] Pickup and drop-off workflow
- [x] Customer live delivery tracking
- [x] Merchant distance bands including free delivery
- [x] Architecture for merchant, Fida and hybrid logistics
- [ ] Configurable driver capacity / maximum concurrent orders
- [ ] Route ordering and multi-stop optimization
- [ ] Proof of delivery (PIN, signature or photo)
- [ ] Fida fleet operations and dispatch controls

## M4 — Money
- [x] Cash payment completion
- [x] Platform merchandise commission
- [ ] Mobile Money adapter
- [ ] Card adapter
- [ ] Merchant settlement and commission remittance ledger
- [ ] Refund workflow
- [ ] Driver / logistics earnings where Fida logistics is used
- [ ] Finance reconciliation and payout reporting

## M5 — Operations and growth
- [x] Admin operations overview
- [x] Finance / reports / insights foundation
- [x] Audit events
- [ ] Customer and merchant push notifications
- [ ] Support cases and order issue handling
- [ ] Ratings and reviews
- [ ] Merchant promotions
- [ ] Fraud / abuse controls
- [ ] Analytics for conversion, retention and delivery performance

## Next implementation sequence
1. Push notifications for customer, merchant and driver status changes.
2. Branch opening hours, temporary closure controls and catalog availability schedules.
3. Proof of delivery and delivery issue handling.
4. Mobile Money payment adapter.
5. Merchant settlement / commission remittance ledger.
6. Configurable driver capacity and route optimization for multi-order delivery.
