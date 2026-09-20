import { MerchantType, Prisma } from '@fida/database/client';
import { validateHours } from './business-hours.js';
const fail = (message: string): never => { throw Object.assign(new Error(message), {statusCode:400}); };
function text(value: unknown, label: string, min = 2, max = 160) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) return fail(`${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
function image(value: unknown, label: string) {
  const s = text(value, label, 8, 2000);
  try { const u = new URL(s); if (u.protocol !== 'https:' || u.username || u.password) return fail(`${label} must be an HTTPS image URL.`); } catch { return fail(`${label} must be an HTTPS image URL.`); }
  return s;
}
export function applicationStage(stage: number, raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Application fields are required.');
  const b = raw as Record<string, unknown>;
  if (stage === 0) {
    const taxId = text(b.taxId, 'Tax identification', 3, 40);
    if (!/^[A-Za-z0-9 -]+$/.test(taxId)) return fail('Invalid tax identification.');
    return {legalName:text(b.legalName,'Legal entity'), taxId};
  }
  if (stage === 1) {
    const merchantType = text(b.merchantType,'Business type');
    if (!Object.values(MerchantType).includes(merchantType as MerchantType)) return fail('Invalid business type.');
    const timezone = text(b.timezone,'Time zone');
    try { new Intl.DateTimeFormat('en', {timeZone:timezone}).format(); } catch { return fail('Invalid time zone.'); }
    if (!Array.isArray(b.cuisineTags) || !b.cuisineTags.length || b.cuisineTags.length > 12) return fail('Choose 1–12 cuisine or category tags.');
    const cuisineTags = [...new Set(b.cuisineTags.map(v => text(v,'Category tag',2,40)))];
    const slug = text(b.slug,'Store URL',3,60).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return fail('Store URL must use letters, numbers and hyphens.');
    return {name:text(b.name,'Store name'),slug,merchantType,timezone,cuisineTags,logoUrl:image(b.logoUrl,'Logo'),coverUrl:image(b.coverUrl,'Cover photo')};
  }
  if (stage === 2) {
    const latitude = b.latitude, longitude = b.longitude;
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) return fail('Valid latitude and longitude are required.');
    return {addressLine:text(b.addressLine,'Street address',5,300),city:text(b.city,'City'),latitude,longitude};
  }
  if (stage === 3) {
    if (!validateHours(b.openingHours) || !b.openingHours.some(w => w && (!Array.isArray(w) || w.length))) return fail('Provide non-overlapping opening windows for at least one day.');
    return {openingHours:b.openingHours};
  }
  return fail('Invalid application stage.');
}
export function fullApplication(raw: unknown) {
  return Object.assign({}, ...[0,1,2,3].map(stage => applicationStage(stage,raw))) as Record<string, any>;
}
export async function createPendingTenant(tx: Prisma.TransactionClient, ownerId: string, b: Record<string, any>, tenantId?: string) {
  const data = {name:b.name,slug:b.slug,merchantType:b.merchantType,status:'PENDING_APPROVAL',isAcceptingOrders:false,legalName:b.legalName,taxId:b.taxId,logoUrl:b.logoUrl,coverUrl:b.coverUrl,cuisineTags:b.cuisineTags,timezone:b.timezone} as const;
  if (tenantId) {
    const tenant = await tx.tenant.update({where:{id:tenantId},data});
    await tx.branch.updateMany({where:{tenantId,code:'MAIN'},data:{city:b.city,addressLine:b.addressLine,latitude:b.latitude,longitude:b.longitude,openingHours:b.openingHours}});
    return tenant;
  }
  const tenant = await tx.tenant.create({data});
  await tx.branch.create({data:{tenantId:tenant.id,name:'Main Branch',code:'MAIN',city:b.city,addressLine:b.addressLine,latitude:b.latitude,longitude:b.longitude,openingHours:b.openingHours,logisticsMode:'MERCHANT'}});
  await tx.tenantMembership.create({data:{tenantId:tenant.id,userId:ownerId,role:'OWNER'}});
  return tenant;
}
