import {allocateDiscount,includedTax} from './inclusive-money.js';
export {allocateDiscount,includedTax} from './inclusive-money.js';
import {itemPromotions} from './item-promotions.js';
import {createHash} from 'node:crypto';
import { Prisma, prisma } from '@fida/database/client';
import type {ChoiceSelection,ModifierLine} from './product-options.js';
type DB = Prisma.TransactionClient;
export type PricedLine = {productId:string;productName:string;quantity:number;unitPrice:Prisma.Decimal;basePrice:Prisma.Decimal;selectedOptions?:ChoiceSelection[]|string[];modifierLines?:ModifierLine[]};
const zero=()=>new Prisma.Decimal(0);
const invalid=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:409});};
export async function checkoutTotals(tenantId:string, lines:PricedLine[], deliveryFee:Prisma.Decimal, promoCode?:string|null, db:DB=prisma,fulfillmentType:'DELIVERY'|'PICKUP'|'DINE_OUT'='PICKUP'){
 const tenant=await db.tenant.findUniqueOrThrow({where:{id:tenantId}});
 if(tenant.status!=='ACTIVE'||!tenant.isAcceptingOrders)return invalid('This merchant is not accepting orders.');
 const markup=fulfillmentType==='DELIVERY'?tenant.deliveryMarkup:zero();
 lines=lines.map(l=>({...l,unitPrice:l.unitPrice.plus(markup),basePrice:l.basePrice.plus(markup)}));
 const paidSubtotal=lines.reduce((v,l)=>v.plus(l.unitPrice.mul(l.quantity)),zero());
 if(paidSubtotal.lt(tenant.minimumOrder))return invalid(`Minimum merchandise order is ${tenant.minimumOrder} ${tenant.currency}.`);
 const policy=await db.promotionPolicy.findUnique({where:{id:'platform'}});
 const {discounts,used,paidUnits,rewards,rewardHints}=await itemPromotions(db,tenantId,lines,paidSubtotal,markup);
 const paidItemDiscount=discounts.reduce((s,d)=>s.plus(d),zero());
 const rewardValue=rewards.reduce((s,r)=>s.plus(r.line.unitPrice.mul(r.quantity)),zero());
 const autoRewardValue=rewards.filter(r=>r.existingIndex===undefined).reduce((s,r)=>s.plus(r.line.unitPrice.mul(r.quantity)),zero());
 const subtotal=paidSubtotal.plus(autoRewardValue),itemDiscount=paidItemDiscount.plus(rewardValue);
 const net=subtotal.minus(itemDiscount);
 const code=promoCode?.trim().toUpperCase();
 const coupon=code?await db.promotion.findUnique({where:{tenantId_code:{tenantId,code}}}):null;
 if(code&&(!coupon||coupon.productId||coupon.discountType==='BOGO'||!coupon.isActive||coupon.expiresAt<=new Date()||coupon.usedCount>=coupon.maxUses||net.lt(coupon.minimumOrder)))return invalid('This promo code is unavailable or the minimum after item discounts is not met.');
 if(coupon&&used.length&&(!coupon.stackable||used.some(p=>!p.stackable)||policy?.allowStacking===false))return invalid('This code cannot be combined with the active item discounts.');
 const cartDiscount=coupon?Prisma.Decimal.min(net,coupon.maxDiscount,coupon.discountType==='FLAT'?coupon.flatAmount:net.mul(coupon.percent).div(100)).toDecimalPlaces(2):zero();
 if(coupon)used.push(coupon);
 const cartParts=allocateDiscount(cartDiscount,lines.map((l,i)=>l.unitPrice.mul(paidUnits[i]).minus(discounts[i])));
 const makeItem=(l:PricedLine,quantity:number,discount:Prisma.Decimal,rewardPromotionId:string|null=null)=>({
  productId:l.productId,productName:rewardPromotionId?`FREE · ${l.productName}`:l.productName,quantity,unitPrice:l.unitPrice,baseUnitPrice:l.basePrice,totalPrice:l.unitPrice.mul(quantity),discount,tax:zero(),isFreeReward:rewardPromotionId!==null,rewardPromotionId,
  ...(l.selectedOptions===undefined?{}:{selectedOptions:l.selectedOptions}),
  modifierLines:(l.modifierLines??[]).map(m=>({...m,quantity:m.quantity*quantity,totalPrice:new Prisma.Decimal(m.unitPrice).mul(m.quantity).mul(quantity).toString()})),
 });
 const items=lines.map((l,i)=>makeItem(l,paidUnits[i],discounts[i].plus(cartParts[i]))).filter(l=>l.quantity>0);
 for(const reward of rewards){const l=reward.line;items.push(makeItem(l,reward.quantity,l.unitPrice.mul(reward.quantity),reward.promotionId));}
 const discount=itemDiscount.plus(cartDiscount),total=subtotal.minus(discount).plus(deliveryFee);
 const tax=includedTax(total,tenant.taxPercent);
 const taxParts=allocateDiscount(tax,[...items.map(i=>i.totalPrice.minus(i.discount)),deliveryFee]);
 items.forEach((item,i)=>{item.tax=taxParts[i];});
 const deliveryTax=taxParts[items.length];
 const quoteHash=createHash('sha256').update(JSON.stringify({tenantId,fulfillmentType,items,deliveryFee,discount,total,tax,taxPercent:tenant.taxPercent})).digest('hex');
 return {quoteHash,rewardHints,fulfillmentType,deliveryMarkup:markup,subtotal,deliveryFee,itemDiscount,cartDiscount,discount,tax,taxInclusive:true,deliveryTax,taxLabel:tenant.taxLabel,taxPercent:tenant.taxPercent,total,items,usedPromotions:used,commissionPercent:tenant.platformCommissionPercent};
}
