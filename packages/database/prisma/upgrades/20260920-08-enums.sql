-- Commit these enum labels before applying the schema migration.
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'KITCHEN_CREW';
