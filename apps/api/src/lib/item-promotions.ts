import {Prisma} from '@fida/database/client';
import type {PricedLine} from './checkout.js';
import {allocateDiscount} from './inclusive-money.js';
type DB=Prisma.TransactionClient;
const zero=()=>new Prisma.Decimal(0);
export async function itemPromotions(db:DB,tenantId:string,lines:PricedLine[],paidSubtotal:Prisma.Decimal,markup:Prisma.Decimal){
 const offers=await db.promotion.findMany({where:{tenantId,productId:{in:lines.map(l=>l.productId)},isActive:true,expiresAt:{gt:new Date()}},orderBy:{id:'asc'}});
 const discounts=lines.map(()=>zero()),used:typeof offers=[];
 const paidUnits=lines.map(l=>l.quantity),reserved=lines.map(()=>0);
 const rewards:{line:PricedLine;quantity:number;promotionId:string;existingIndex?:number}[]=[];
 const rewardHints:{productId:string;productName:string;quantity:number;message:string}[]=[];
 const rewardIds=offers.flatMap(p=>p.rewardProductId?[p.rewardProductId]:[]);
 // Inside order creation these locks last through snapshots and redemption. Preview locks are read-only.
 if(rewardIds.length)await db.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE "tenantId"=${tenantId} AND id IN (${Prisma.join(rewardIds)}) ORDER BY id FOR SHARE`);
 const catalog=await db.product.findMany({where:{tenantId,id:{in:rewardIds},isActive:true,isAvailable:true,deletedAt:null,OR:[{categoryId:null},{category:{isActive:true,deletedAt:null}}]}});
 // Stable ordering, one winning offer per trigger product. Reserved paid triggers cannot become rewards.
 for(const productId of [...new Set(lines.map(l=>l.productId))].sort()){
  const indexes=lines.map((l,i)=>l.productId===productId?i:-1).filter(i=>i>=0);
  const base=indexes.reduce((sum,i)=>sum.plus(lines[i].basePrice.mul(paidUnits[i])),zero());
  const quantity=indexes.reduce((sum,i)=>sum+paidUnits[i],0);
  let best:typeof offers[number]|undefined,bestAmount=zero(),bestRewards:typeof rewards=[],bestHint:typeof rewardHints[number]|undefined;
  let unclaimedHint:typeof rewardHints[number]|undefined;
  for(const p of offers.filter(p=>p.productId===productId&&p.usedCount<p.maxUses&&paidSubtotal.gte(p.minimumOrder))){
   let amount=zero(),hint:typeof rewardHints[number]|undefined;const candidate:typeof rewards=[];
   if(p.discountType==='BOGO'&&p.buyQuantity>=1&&p.buyQuantity<=50&&p.getQuantity===1){
    let remaining=Math.floor(quantity/p.buyQuantity),cap=p.maxDiscount;
    if(p.rewardProductId&&p.rewardProductId!==productId){
     const product=catalog.find(v=>v.id===p.rewardProductId);if(!product||product.price.lte(0))continue;
     const matches=lines.map((l,i)=>l.productId===product.id?i:-1).filter(i=>i>=0).sort((a,b)=>lines[a].unitPrice.comparedTo(lines[b].unitPrice)||a-b);
     for(const i of matches){
      const unit=lines[i].unitPrice,count=Math.min(remaining,paidUnits[i]-reserved[i],cap.div(unit).floor().toNumber());
      if(count>0){candidate.push({line:lines[i],quantity:count,promotionId:p.id,existingIndex:i});remaining-=count;cap=cap.minus(unit.mul(count));amount=amount.plus(unit.mul(count));}
     }
     const price=product.price.plus(markup),count=Math.min(remaining,cap.div(price).floor().toNumber());
     if(count>0){
      const requiresChoices=Array.isArray(product.options)&&product.options.some(o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&Number(o.minSelect??0)>0);
      if(requiresChoices)hint={productId:product.id,productName:product.name,quantity:count,message:`Choose options for ${product.name} and add it to your cart to claim up to ${count} free.`};
      else{candidate.push({line:{productId:product.id,productName:product.name,quantity:count,unitPrice:price,basePrice:price,selectedOptions:[],modifierLines:[]},quantity:count,promotionId:p.id});amount=amount.plus(price.mul(count));}
     }
    }else{
     // Same-product quantities remain PAID units; rewards are added separately.
     for(const i of [...indexes].sort((a,b)=>lines[a].unitPrice.comparedTo(lines[b].unitPrice)||a-b)){
      const unit=lines[i].unitPrice;if(!remaining||unit.lte(0))continue;
      const count=Math.min(remaining,paidUnits[i],cap.div(unit).floor().toNumber());
      if(count>0){candidate.push({line:lines[i],quantity:count,promotionId:p.id});remaining-=count;cap=cap.minus(unit.mul(count));amount=amount.plus(unit.mul(count));}
     }
    }
   }else if(p.discountType==='FLAT'||p.discountType==='PERCENT')amount=Prisma.Decimal.min(base,p.maxDiscount,p.discountType==='FLAT'?p.flatAmount.mul(quantity):base.mul(p.percent).div(100)).toDecimalPlaces(2);
   if(amount.gt(bestAmount)){best=p;bestAmount=amount;bestRewards=candidate;bestHint=hint;}
   if(hint&&!unclaimedHint)unclaimedHint=hint;
  }
  if(best&&bestAmount.gt(0)){
   used.push(best);indexes.forEach(i=>{reserved[i]=paidUnits[i];});
   if(best.discountType==='BOGO'){rewards.push(...bestRewards);for(const reward of bestRewards)if(reward.existingIndex!==undefined)paidUnits[reward.existingIndex]-=reward.quantity;}
   else{const allocated=allocateDiscount(bestAmount,indexes.map(i=>lines[i].basePrice.mul(paidUnits[i])));indexes.forEach((i,n)=>{discounts[i]=allocated[n];});}
   if(bestHint)rewardHints.push(bestHint);
  }else if(unclaimedHint)rewardHints.push(unclaimedHint);
 }
 return {discounts,used,paidUnits,rewards,rewardHints};
}
