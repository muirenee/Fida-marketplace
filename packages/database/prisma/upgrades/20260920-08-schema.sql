-- Additive upgrade from 0.7; apply atomically after 08-enums.sql.
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "cuisineTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "paymentSubaccount" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "taxLabel" TEXT NOT NULL DEFAULT 'VAT',
ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "TenantMembership" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cookingInstructions" TEXT,
ADD COLUMN     "taxLabel" TEXT NOT NULL DEFAULT 'VAT';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "settledPayout" DECIMAL(12,2),
ADD COLUMN     "settlementReference" TEXT;

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "flatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "stackable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "destinationSubaccount" TEXT,
ADD COLUMN     "settlementMode" TEXT NOT NULL DEFAULT 'PLATFORM_LEGACY';

-- CreateTable
CREATE TABLE "MerchantApplication" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tenantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "step" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "reviewReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionPolicy" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "maxPercent" INTEGER NOT NULL DEFAULT 100,
    "maxDiscount" DECIMAL(12,2) NOT NULL DEFAULT 100000000,
    "allowStacking" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantApplication_tenantId_key" ON "MerchantApplication"("tenantId");

-- CreateIndex
CREATE INDEX "MerchantApplication_ownerId_createdAt_idx" ON "MerchantApplication"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "MerchantApplication_status_createdAt_idx" ON "MerchantApplication"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_settlementReference_key" ON "Delivery"("settlementReference");

