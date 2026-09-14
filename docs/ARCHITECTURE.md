# Architecture — Fida Marketplace

## Product surfaces

- Customer mobile app
- Merchant mobile app
- Driver mobile app
- Platform administration web app
- Merchant web portal (next milestone)
- Public API / integration layer

## Tenancy model

`Tenant` is the merchant organization. A tenant owns branches, categories, products, orders, settings, promotions, and staff memberships.

Every tenant-owned API request must resolve an authenticated tenant context and scope reads/writes by `tenantId`. Platform administrators are the only actors allowed to cross tenant boundaries.

Branch-scoped staff memberships allow a merchant to restrict an employee to one location while owners/admins may operate tenant-wide.

## Transaction model

An `Order` belongs to exactly one tenant and one branch. Product names and prices are snapshotted into `OrderItem` so historical orders remain correct after catalog changes.

Delivery is modeled separately from order status so dispatch, reassignment, courier status, and proof-of-delivery can evolve without corrupting the commerce state machine.

## Security baseline

- Short-lived access token + refresh token model
- Tenant context derived server-side; never trusted from UI alone
- Role/permission checks for platform and tenant actions
- Audit logs for administrative changes
- Idempotency keys for checkout/payment operations
- Webhook signature validation for payment providers
