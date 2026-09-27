import {createHash} from 'node:crypto';
import { Prisma, prisma } from '@fida/database/client';
import type {ChoiceSelection,ModifierLine} from './product-options.js';
type DB = Prisma.TransactionClient;
export type PricedLine = {productId:string;productName:string;quantity:number;unitPrice:Prisma.Decimal;basePrice:Prisma.Decimal;selectedOptions?:ChoiceSelection[]|string[];modifierLines?:ModifierLine[]};
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
export function includedTax(gross:Prisma.Decimal,percent:Prisma.Decimal){
 return gross.minus(gross.div(new Prisma.Decimal(1).plus(percent.div(100)))).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
}
export async function checkoutTotals(tenantId:string, lines:PricedLine[], deliveryFee:Prisma.Decimal, promoCode?:string|null, db:DB=prisma){
 const tenant=await db.tenant.findUniqueOrThrow({where:{id:tenantId}});
 if(tenant.status!=='ACTIVE'||!tenant.isAcceptingOrders)return invalid('This merchant is not accepting orders.');
 const paidSubtotal=lines.reduce((v,l)=>v.plus(l.unitPrice.mul(l.quantity)),zero());
 if(paidSubtotal.lt(tenant.minimumOrder))return invalid(`Minimum merchandise order is ${tenant.minimumOrder} ${tenant.currency}.`);
 const policy=await db.promotionPolicy.findUnique({where:{id:'platform'}});
 const offers=await db.promotion.findMany({where:{tenantId,productId:{in:lines.map(l=>l.productId)},isActive:true,expiresAt:{gt:new Date()}},orderBy:{id:'asc'}});
 const discounts=lines.map(()=>zero()),used:typeof offers=[];
 const rewards:{index:number;quantity:number;promotionId:string}[]=[];
 for(const productId of new Set(lines.map(l=>l.productId))){
  const indexes=lines.map((l,i)=>l.productId===productId?i:-1).filter(i=>i>=0);
  const base=indexes.reduce((sum,i)=>sum.plus(lines[i].basePrice.mul(lines[i].quantity)),zero());
  const quantity=indexes.reduce((sum,i)=>sum+lines[i].quantity,0);
  let best:typeof offers[number]|undefined,bestAmount=zero(),bestRewards:typeof rewards=[];
  for(const p of offers.filter(p=>p.productId===productId&&p.usedCount<p.maxUses&&paidSubtotal.gte(p.minimumOrder))){
   let amount=zero();const candidate:typeof rewards=[];
   if(p.discountType==='BOGO'&&p.buyQuantity>=1&&p.buyQuantity<=50&&p.getQuantity===1){
    // Quantities are PAID units. Added rewards never qualify for another reward.
    let remaining=Math.floor(quantity/p.buyQuantity),cap=p.maxDiscount;
    // Mixed configurations receive the cheapest eligible configuration first.
    for(const i of [...indexes].sort((a,b)=>lines[a].unitPrice.comparedTo(lines[b].unitPrice)||a-b)){
     const unit=lines[i].unitPrice;
     if(!remaining||unit.lte(0))continue;
     const count=Math.min(remaining,lines[i].quantity,cap.div(unit).floor().toNumber());
     if(count>0){candidate.push({index:i,quantity:count,promotionId:p.id});remaining-=count;cap=cap.minus(unit.mul(count));amount=amount.plus(unit.mul(count));}
    }
   }else if(p.discountType==='FLAT'||p.discountType==='PERCENT'){
    amount=Prisma.Decimal.min(base,p.maxDiscount,p.discountType==='FLAT'?p.flatAmount.mul(quantity):base.mul(p.percent).div(100)).toDecimalPlaces(2);
   }
   if(amount.gt(bestAmount)){best=p;bestAmount=amount;bestRewards=candidate;}
  }
  if(best&&bestAmount.gt(0)){
   used.push(best);
   if(best.discountType==='BOGO')rewards.push(...bestRewards);
   else{
    const allocated=allocateDiscount(bestAmount,indexes.map(i=>lines[i].basePrice.mul(lines[i].quantity)));
    indexes.forEach((i,n)=>{discounts[i]=allocated[n];});
   }
  }
 }
 const paidItemDiscount=discounts.reduce((s,d)=>s.plus(d),zero());
 const rewardValue=rewards.reduce((s,r)=>s.plus(lines[r.index].unitPrice.mul(r.quantity)),zero());
 const subtotal=paidSubtotal.plus(rewardValue),itemDiscount=paidItemDiscount.plus(rewardValue);
 const net=paidSubtotal.minus(paidItemDiscount);
 const code=promoCode?.trim().toUpperCase();
 const coupon=code?await db.promotion.findUnique({where:{tenantId_code:{tenantId,code}}}):null;
 if(code&&(!coupon||coupon.productId||coupon.discountType==='BOGO'||!coupon.isActive||coupon.expiresAt<=new Date()||coupon.usedCount>=coupon.maxUses||net.lt(coupon.minimumOrder)))return invalid('This promo code is unavailable or the minimum after item discounts is not met.');
 if(coupon&&used.length&&(!coupon.stackable||used.some(p=>!p.stackable)||policy?.allowStacking===false))return invalid('This code cannot be combined with the active item discounts.');
 const cartDiscount=coupon?Prisma.Decimal.min(net,coupon.maxDiscount,coupon.discountType==='FLAT'?coupon.flatAmount:net.mul(coupon.percent).div(100)).toDecimalPlaces(2):zero();
 if(coupon)used.push(coupon);
 const cartParts=allocateDiscount(cartDiscount,lines.map((l,i)=>l.unitPrice.mul(l.quantity).minus(discounts[i])));
 const makeItem=(l:PricedLine,quantity:number,discount:Prisma.Decimal,rewardPromotionId:string|null=null)=>({
  productId:l.productId,productName:rewardPromotionId?`FREE · ${l.productName}`:l.productName,quantity,unitPrice:l.unitPrice,baseUnitPrice:l.basePrice,totalPrice:l.unitPrice.mul(quantity),discount,tax:zero(),isFreeReward:rewardPromotionId!==null,rewardPromotionId,
  ...(l.selectedOptions===undefined?{}:{selectedOptions:l.selectedOptions}),
  modifierLines:(l.modifierLines??[]).map(m=>({...m,quantity:m.quantity*quantity,totalPrice:new Prisma.Decimal(m.unitPrice).mul(m.quantity).mul(quantity).toString()})),
 });
 const items=lines.map((l,i)=>makeItem(l,l.quantity,discounts[i].plus(cartParts[i])));
 for(const reward of rewards){const l=lines[reward.index];items.push(makeItem(l,reward.quantity,l.unitPrice.mul(reward.quantity),reward.promotionId));}
 const discount=itemDiscount.plus(cartDiscount),total=subtotal.minus(discount).plus(deliveryFee);
 const tax=includedTax(total,tenant.taxPercent);
 const taxParts=allocateDiscount(tax,[...items.map(i=>i.totalPrice.minus(i.discount)),deliveryFee]);
 items.forEach((item,i)=>{item.tax=taxParts[i];});
 const deliveryTax=taxParts[items.length];
 const quoteHash=createHash('sha256').update(JSON.stringify({tenantId,items,deliveryFee,discount,total,tax,taxPercent:tenant.taxPercent})).digest('hex');
 return {quoteHash,subtotal,deliveryFee,itemDiscount,cartDiscount,discount,tax,taxInclusive:true,deliveryTax,taxLabel:tenant.taxLabel,taxPercent:tenant.taxPercent,total,items,usedPromotions:used,commissionPercent:tenant.platformCommissionPercent};
}
