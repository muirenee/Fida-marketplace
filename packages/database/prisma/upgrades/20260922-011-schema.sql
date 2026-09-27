ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "buyQuantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "getQuantity" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "Promotion_tenantId_productId_isActive_expiresAt_idx" ON "Promotion" ("tenantId", "productId", "isActive", "expiresAt");
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Promotion_bogo_scope_check') THEN
  ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_bogo_scope_check" CHECK ("discountType" <> 'BOGO' OR ("productId" IS NOT NULL AND "buyQuantity"=1 AND "getQuantity"=1));
 END IF;
END $$;
