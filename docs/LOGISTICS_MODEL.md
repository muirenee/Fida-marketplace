# Fida Marketplace logistics and revenue model

Fida Marketplace is a commerce platform first. The platform earns a configurable commission on merchandise sales. Customer delivery charges belong to the selected fulfillment operation and are not part of Fida's marketplace commission.

## Fulfillment

Each merchant branch can support pickup, delivery, or both.

Delivery is configured per branch with distance bands. A band can have a zero price for free delivery. Customer checkout shows the selected fulfillment choice and final total; there is no separate customer-facing Fida service fee.

## Logistics operators

The data model supports three branch logistics modes:

- `MERCHANT`: the merchant owns and manages the delivery operation and enrolls its drivers.
- `FIDA`: reserved for a future Fida-owned fleet.
- `HYBRID`: reserved for merchant delivery with optional Fida backup.

Merchant-owned drivers can only see and claim eligible deliveries for their merchant. Platform administrators retain read-only/support visibility but do not enroll merchant drivers.

## Marketplace commission

Each order snapshots the merchant commission percentage and amount at order creation. Commission is calculated from merchandise subtotal only, excluding delivery charges.

Historical orders keep their original commission snapshot even when the merchant's future commission setting changes.

## Customer pricing

For pickup, delivery price is zero. For delivery, the server calculates straight-line distance between branch coordinates and the customer's saved delivery coordinates, then selects the matching active merchant delivery band.

The server always recalculates distance, delivery price, product prices, and commission before accepting an order.
