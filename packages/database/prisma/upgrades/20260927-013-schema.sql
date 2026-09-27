-- Existing orders retain their original exclusive-tax accounting.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxInclusive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ALTER COLUMN "taxInclusive" SET DEFAULT true;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryTax" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "baseUnitPrice" DECIMAL(12,2);
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "modifierLines" JSONB;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "isFreeReward" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "rewardPromotionId" TEXT;
ALTER TABLE "Promotion" DROP CONSTRAINT IF EXISTS "Promotion_bogo_scope_check";
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_bogo_scope_check" CHECK
 ("discountType" <> 'BOGO' OR ("productId" IS NOT NULL AND "buyQuantity" BETWEEN 1 AND 50 AND "getQuantity"=1));
