export const PRODUCT_NAME = 'Fida Marketplace';

export type AppRole =
  | 'platform_admin'
  | 'tenant_owner'
  | 'tenant_admin'
  | 'tenant_manager'
  | 'tenant_staff'
  | 'customer'
  | 'driver';

export type MerchantVertical =
  | 'restaurant'
  | 'supermarket'
  | 'pharmacy'
  | 'retail'
  | 'other';

export const ORDER_FLOW = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'DELIVERING',
  'COMPLETED',
] as const;
