import { Prisma, prisma } from '@fida/database/client';
export async function checkoutTotals(tenantId:string,subtotal:Prisma.Decimal,deliveryFee:Prisma.Decimal,promoCode?:string|null) {
 const tenant=await prisma.tenant.findUniqueOrThrow({where:{id:tenantId}});
 const promotion=promoCode?await prisma.promotion.findUnique({where:{tenantId_code:{tenantId,code:promoCode.toUpperCase()}}}):null;
 if(promoCode&&(!promotion||!promotion.isActive||promotion.expiresAt<=new Date()||promotion.usedCount>=promotion.maxUses||subtotal.lessThan(promotion.minimumOrder)))throw Object.assign(new Error('This promo code is unavailable or the minimum order is not met.'),{statusCode:409});
 const discount=promotion?Prisma.Decimal.min(subtotal.mul(promotion.percent).div(100),promotion.maxDiscount).toDecimalPlaces(2):new Prisma.Decimal(0);
 const tax=subtotal.minus(discount).mul(tenant.taxPercent).div(100).toDecimalPlaces(2);
 return {subtotal,deliveryFee,discount,tax,total:subtotal.minus(discount).plus(tax).plus(deliveryFee)};
}
