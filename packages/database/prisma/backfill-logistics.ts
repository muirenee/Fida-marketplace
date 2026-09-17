import 'dotenv/config';
import { DeliveryOperatorType } from '../generated/client.js';
import { prisma } from '../src/client.js';

async function main() {
  const legacyDrivers = await prisma.driver.findMany({
    where: { operatorId: null },
    select: {
      id: true,
      userId: true,
      deliveries: {
        select: {
          id: true,
          operatorId: true,
          order: {
            select: {
              tenantId: true,
              branchId: true,
              tenant: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  let migratedDrivers = 0;
  let migratedDeliveries = 0;
  let skippedDrivers = 0;

  for (const driver of legacyDrivers) {
    const tenantIds = [...new Set(driver.deliveries.map((delivery) => delivery.order.tenantId))];
    if (tenantIds.length !== 1) {
      skippedDrivers += 1;
      console.log(
        `Skipped driver ${driver.id}: historical deliveries map to ${tenantIds.length} merchants; merchant enrollment is required.`,
      );
      continue;
    }

    const tenantId = tenantIds[0]!;
    const tenantName = driver.deliveries.find((delivery) => delivery.order.tenantId === tenantId)?.order.tenant.name;
    if (!tenantName) {
      skippedDrivers += 1;
      console.log(`Skipped driver ${driver.id}: merchant could not be resolved.`);
      continue;
    }

    const operator = await prisma.deliveryOperator.upsert({
      where: { tenantId },
      update: {
        type: DeliveryOperatorType.MERCHANT,
        name: `${tenantName} delivery`,
        isActive: true,
      },
      create: {
        type: DeliveryOperatorType.MERCHANT,
        tenantId,
        name: `${tenantName} delivery`,
      },
      select: { id: true },
    });

    const result = await prisma.driver.updateMany({
      where: { id: driver.id, operatorId: null },
      data: { operatorId: operator.id },
    });
    migratedDrivers += result.count;

    const deliveryResult = await prisma.delivery.updateMany({
      where: { driverId: driver.id, operatorId: null },
      data: { operatorId: operator.id },
    });
    migratedDeliveries += deliveryResult.count;

    console.log(`Backfilled driver ${driver.id} to ${tenantName}.`);
  }

  console.log({
    legacyDrivers: legacyDrivers.length,
    migratedDrivers,
    migratedDeliveries,
    skippedDrivers,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
