ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authVersion" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_tenantId_idx" ON "Order"("status", "createdAt", "tenantId");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
