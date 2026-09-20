-- AlterTable
ALTER TABLE "DeliveryOperator" ADD COLUMN     "driverBasePay" DECIMAL(12,2),
ADD COLUMN     "driverPerKmPay" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "estimatedPayout" DECIMAL(12,2),
ADD COLUMN     "payoutCurrency" TEXT;

-- CreateTable
CREATE TABLE "BusinessDocument" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDocument_number_key" ON "BusinessDocument"("number");

-- CreateIndex
CREATE INDEX "BusinessDocument_tenantId_issuedAt_idx" ON "BusinessDocument"("tenantId", "issuedAt");

-- CreateIndex
CREATE INDEX "BusinessDocument_customerId_kind_idx" ON "BusinessDocument"("customerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDocument_orderId_kind_key" ON "BusinessDocument"("orderId", "kind");

