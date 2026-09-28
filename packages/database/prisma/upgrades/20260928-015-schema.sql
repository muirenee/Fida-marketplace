-- Run transactionally after 0.13; historical prices and documents are unchanged.
ALTER TYPE "FulfillmentType" ADD VALUE IF NOT EXISTS 'DINE_OUT';
CREATE TABLE IF NOT EXISTS "StoreCategory" (
 code TEXT PRIMARY KEY,name TEXT NOT NULL,icon TEXT NOT NULL DEFAULT '🛍️',
 "isActive" BOOLEAN NOT NULL DEFAULT TRUE,"sortOrder" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Tenant' AND column_name='merchantType' AND udt_name='MerchantType') THEN
  INSERT INTO "StoreCategory" (code,name,icon,"sortOrder") VALUES
   ('RESTAURANT','Restaurants','🍽️',10),('SUPERMARKET','Grocery','🛒',20),('RETAIL','Shops','🛍️',30),('OTHER','Other','🏪',40) ON CONFLICT DO NOTHING;
  ALTER TABLE "Tenant" ALTER COLUMN "merchantType" TYPE TEXT USING "merchantType"::TEXT;
  UPDATE "Tenant" SET "merchantType"='OTHER' WHERE "merchantType"='PHARMACY';
 END IF;
END $$;
ALTER TABLE "Tenant" ALTER COLUMN "merchantType" DROP NOT NULL;
DROP TYPE IF EXISTS "MerchantType";
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Tenant_merchantType_fkey') THEN
  ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_merchantType_fkey" FOREIGN KEY ("merchantType") REFERENCES "StoreCategory"(code) ON DELETE SET NULL ON UPDATE CASCADE;
 END IF;
END $$;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "deliveryMarkup" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "dineOutEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "rewardProductId" TEXT;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Tenant_deliveryMarkup_check') THEN
  ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_deliveryMarkup_check" CHECK ("deliveryMarkup">=0 AND "deliveryMarkup"<=1000000);
 END IF;
END $$;
