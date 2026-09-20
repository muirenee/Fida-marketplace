import { Prisma, prisma } from '@fida/database/client';
type DB = Prisma.TransactionClient;
export type PricedLine = {productId:string;productName:string;quantity:number;unitPrice:Prisma.Decimal;basePrice:Prisma.Decimal};
const zero=()=>new Prisma.Decimal(0);
const invalid=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:409});};
// Allocate whole cents by largest remainder so no small line becomes negative.
export function allocateDiscount(amount:Prisma.Decimal, weights:Prisma.Decimal[]) {
 const total=weights.reduce((sum,w)=>sum.plus(w),zero());
 if(total.isZero())return weights.map(()=>zero());
 const exact=weights.map(w=>amount.mul(w).div(total));
 const result=exact.map(v=>v.toDecimalPlaces(2,Prisma.Decimal.ROUND_DOWN));
 const cents=amount.minus(result.reduce((sum,v)=>sum.plus(v),zero())).mul(100).toNumber();
 const ranking=exact.map((v,i)=>({i,fraction:v.minus(result[i])})).sort((a,b)=>b.fraction.comparedTo(a.fraction)||a.i-b.i);
 for(let n=0;n<Math.round(cents);n++)result[ranking[n].i]=result[ranking[n].i].plus('0.01');
 return result;
}
export async function checkoutTotals(tenantId:string, lines:PricedLine[], deliveryFee:Prisma.Decimal, promoCode?:string|null, db:DB=prisma){
 const tenant=await db.tenant.findUniqueOrThrow({where:{id:tenantId}});
 if(tenant.status!=='ACTIVE'||!tenant.isAcceptingOrders) return invalid('This merchant is not accepting orders.');
 const subtotal=lines.reduce((v,l)=>v.plus(l.unitPrice.mul(l.quantity)),zero());
 if(subtotal.lt(tenant.minimumOrder))return invalid(`Minimum merchandise order is ${tenant.minimumOrder} ${tenant.currency}.`);
 const policy=await db.promotionPolicy.findUnique({where:{id:'platform'}});
 const offers=await db.promotion.findMany({where:{tenantId,productId:{in:lines.map(l=>l.productId)},isActive:true,expiresAt:{gt:new Date()}},orderBy:{id:'asc'}});
 const discounts=lines.map(()=>zero()),used:typeof offers=[];
 for(const productId of new Set(lines.map(l=>l.productId))){
   const indexes=lines.map((l,i)=>l.productId===productId?i:-1).filter(i=>i>=0);
   const base=indexes.reduce((sum,i)=>sum.plus(lines[i].basePrice.mul(lines[i].quantity)),zero());
   const quantity=indexes.reduce((sum,i)=>sum+lines[i].quantity,0);
   let best:typeof offers[number]|undefined,bestAmount=zero();
   for(const p of offers.filter(p=>p.productId===productId&&p.usedCount<p.maxUses&&subtotal.gte(p.minimumOrder))){
     const amount=Prisma.Decimal.min(base,p.maxDiscount,p.discountType==='FLAT'?p.flatAmount.mul(quantity):base.mul(p.percent).div(100)).toDecimalPlaces(2);
     if(amount.gt(bestAmount)){best=p;bestAmount=amount;}
   }
   if(best&&bestAmount.gt(0)){
     used.push(best);
     const allocated=allocateDiscount(bestAmount,indexes.map(i=>lines[i].basePrice.mul(lines[i].quantity)));
     indexes.forEach((i,n)=>{discounts[i]=allocated[n];});
   }
 }
 const itemDiscount=discounts.reduce((s,d)=>s.plus(d),zero());
 const net=subtotal.minus(itemDiscount);
 const code=promoCode?.trim().toUpperCase();
 const coupon=code?await db.promotion.findUnique({where:{tenantId_code:{tenantId,code}}}):null;
 if(code&&(!coupon||coupon.productId||!coupon.isActive||coupon.expiresAt<=new Date()||coupon.usedCount>=coupon.maxUses||net.lt(coupon.minimumOrder)))return invalid('This promo code is unavailable or the minimum after item discounts is not met.');
 if(coupon&&used.length&&(!coupon.stackable||used.some(p=>!p.stackable)||policy?.allowStacking===false))return invalid('This code cannot be combined with the active item discounts.');
 const cartDiscount=coupon?Prisma.Decimal.min(net,coupon.maxDiscount,coupon.discountType==='FLAT'?coupon.flatAmount:net.mul(coupon.percent).div(100)).toDecimalPlaces(2):zero();
 if(coupon)used.push(coupon);
 const cartParts=allocateDiscount(cartDiscount,lines.map((l,i)=>l.unitPrice.mul(l.quantity).minus(discounts[i])));
 const items=lines.map((l,i)=>{
   const totalPrice=l.unitPrice.mul(l.quantity);
   const discount=discounts[i].plus(cartParts[i]);
   const tax=totalPrice.minus(discount).mul(tenant.taxPercent).div(100).toDecimalPlaces(2);
   return {productId:l.productId,productName:l.productName,quantity:l.quantity,unitPrice:l.unitPrice,totalPrice,discount,tax};
 });
 const discount=itemDiscount.plus(cartDiscount),tax=items.reduce((v,l)=>v.plus(l.tax),zero());
 return {subtotal,deliveryFee,itemDiscount,cartDiscount,discount,tax,taxLabel:tenant.taxLabel,taxPercent:tenant.taxPercent,total:subtotal.minus(discount).plus(tax).plus(deliveryFee),items,usedPromotions:used,commissionPercent:tenant.platformCommissionPercent};
}
