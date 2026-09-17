import { Prisma, prisma } from '@fida/database/client';

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type DeliveryQuote = {
  distanceKm: number;
  fee: Prisma.Decimal;
  zoneId: string;
};

export async function quoteBranchDelivery(branchId: string, latitude: number, longitude: number): Promise<DeliveryQuote | null> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      deliveryEnabled: true,
      latitude: true,
      longitude: true,
      deliveryZones: {
        where: { isActive: true },
        orderBy: [{ minDistanceKm: 'asc' }, { maxDistanceKm: 'asc' }],
        select: { id: true, minDistanceKm: true, maxDistanceKm: true, fee: true },
      },
    },
  });

  if (!branch?.deliveryEnabled || branch.latitude === null || branch.longitude === null) return null;

  const distanceKm = Number(haversineKm(Number(branch.latitude), Number(branch.longitude), latitude, longitude).toFixed(2));
  const zone = branch.deliveryZones.find((candidate) => {
    const min = Number(candidate.minDistanceKm);
    const max = Number(candidate.maxDistanceKm);
    return distanceKm >= min && distanceKm <= max;
  });

  if (!zone) return null;
  return { distanceKm, fee: zone.fee, zoneId: zone.id };
}
