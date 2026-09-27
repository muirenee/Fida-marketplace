import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Prisma} from '../packages/database/src/client.js';
import {checkoutTotals,includedTax} from '../apps/api/src/lib/checkout.js';
import {selectedOptions} from '../apps/api/src/lib/product-options.js';
import {issueOrderDocuments} from '../apps/api/src/lib/documents.js';
export async function verify013({prisma,request,customer,tenant,owner,checkout}:any){
 await test('premium counters price independently, validate bounds, and preserve required group limits',async()=>{
  const product={name:'Rice',price:new Prisma.Decimal(1180),options:[{name:'Rice type',price:0,group:'Base',minSelect:1,maxSelect:1},{name:'Cheese',price:118},{name:'Sauce',price:59}]};
  const configured=selectedOptions(product,['Rice type',{name:'Cheese',quantity:3},{name:'Sauce',quantity:2}]);
  assert.equal(configured.price.toNumber(),1652);assert.equal(configured.modifierLines[1].totalPrice,'354');
  for(const quantity of [-1,0,1.5,21,'2'])assert.throws(()=>selectedOptions(product,[{name:'Cheese',quantity}]),/quantities/);
  assert.throws(()=>selectedOptions(product,[{name:'Rice type',quantity:2}]),/once/);
  assert.throws(()=>selectedOptions(product,['Rice type','Cheese','Cheese']),/Duplicate/);
  assert.throws(()=>selectedOptions(product,[{name:'Cheese',quantity:1}]),/Choose/);
  assert.equal(includedTax(new Prisma.Decimal(1180),new Prisma.Decimal(18)).toNumber(),180);
  assert.equal(includedTax(new Prisma.Decimal(1180),new Prisma.Decimal(0)).toNumber(),0);
 });
 await test('buy X adds only earned whole rewards, tax includes delivery, and changed free offers invalidate checkout',async()=>{
  await prisma.tenant.update({where:{id:tenant.id},data:{taxPercent:18,minimumOrder:0}});
  const product=await prisma.product.create({data:{tenantId:tenant.id,name:'Buy two meal',price:1180,options:[{name:'Cheese',price:118}]}});
  const offer={code:'BUY2013',discountType:'BOGO',productId:product.id,buyQuantity:2,getQuantity:1,maxDiscount:100000,maxUses:10,minimumOrder:0,expiresAt:new Date(Date.now()+86400000).toISOString()};
  for(const buyQuantity of [0,51,1.5,'2'])await request('POST','/v1/merchant/promotions',owner,{...offer,buyQuantity},400);
  const promotion=await request('POST','/v1/merchant/promotions',owner,offer,201);
  const configured=selectedOptions(product,[{name:'Cheese',quantity:3}]);
  const line={productId:product.id,productName:configured.name,unitPrice:configured.price,basePrice:product.price,selectedOptions:configured.selectedOptions,modifierLines:configured.modifierLines};
  for(const qty of [1,2,3,4,5,50]){
   const totals=await checkoutTotals(tenant.id,[{...line,quantity:qty}],new Prisma.Decimal(590));
   const free=totals.items.filter(i=>i.isFreeReward).reduce((s,i)=>s+i.quantity,0);
   assert.equal(free,Math.floor(qty/2));assert.equal(totals.total.toNumber(),1534*qty+590);
   assert.equal(totals.items.reduce((s,i)=>s.plus(i.tax),new Prisma.Decimal(0)).plus(totals.deliveryTax).toString(),totals.tax.toString());
   assert.equal(totals.tax.toString(),includedTax(totals.total,new Prisma.Decimal(18)).toString());
   for(const bonus of totals.items.filter(i=>i.isFreeReward)){assert.ok(bonus.discount.equals(bonus.totalPrice));assert.ok(bonus.tax.isZero());}
  }
  const split=await checkoutTotals(tenant.id,[{...line,quantity:1},{...line,quantity:1,unitPrice:new Prisma.Decimal(1180),selectedOptions:[],modifierLines:[]}],new Prisma.Decimal(0));
  assert.equal(split.items.filter(i=>i.isFreeReward)[0].unitPrice.toNumber(),1180);
  const payload={...checkout,items:[{productId:product.id,quantity:2,options:[{name:'Cheese',quantity:3}]}]};
  const preview=await request('POST','/v1/customer/checkout-preview',customer,payload);
  await prisma.promotion.update({where:{id:promotion.id},data:{isActive:false}});
  const changed=await request('POST','/v1/customer/checkout-preview',customer,payload);
  assert.equal(preview.total,changed.total);assert.notEqual(preview.quoteHash,changed.quoteHash);
  await request('POST','/v1/customer/orders',customer,{...payload,confirmedTotal:Number(preview.total),confirmedQuote:preview.quoteHash},409);
  await prisma.promotion.update({where:{id:promotion.id},data:{isActive:true}});
  const order=await request('POST','/v1/customer/orders',customer,{...payload,checkoutKey:'quote013-idempotent',confirmedTotal:Number(preview.total),confirmedQuote:preview.quoteHash},201);
  assert.equal(order.taxInclusive,true);assert.equal(Number(order.total),3568);assert.equal(order.items.reduce((s:number,i:any)=>s+i.quantity,0),3);
  const paid=order.items.find((i:any)=>!i.isFreeReward);assert.equal(paid.modifierLines[0].quantity,6);assert.equal(Number(paid.modifierLines[0].totalPrice),708);
  const retry=await request('POST','/v1/customer/orders',customer,{...payload,checkoutKey:'quote013-idempotent',confirmedTotal:Number(preview.total),confirmedQuote:preview.quoteHash});assert.equal(retry.id,order.id);
  assert.equal((await prisma.promotion.findUniqueOrThrow({where:{id:promotion.id}})).usedCount,1);
  await prisma.order.update({where:{id:order.id},data:{status:'COMPLETED'}});
  await prisma.$transaction((tx:any)=>issueOrderDocuments(tx,order.id));
  const receipt=await prisma.businessDocument.findUniqueOrThrow({where:{orderId_kind:{orderId:order.id,kind:'CUSTOMER_RECEIPT'}}});
  assert.equal(receipt.payload.taxInclusive,true);assert.equal(receipt.payload.total,order.total);assert.equal(receipt.payload.lines.reduce((s:number,l:any)=>s+Number(l.amount),0),Number(order.subtotal));
  const reorder=await request('GET',`/v1/customer/orders/${order.id}/reorder`,customer);assert.equal(reorder.items.length,1);assert.deepEqual(reorder.items[0].selectedOptions,[{name:'Cheese',quantity:3}]);
  await prisma.promotion.update({where:{id:promotion.id},data:{maxDiscount:1534}});
  const capped=await checkoutTotals(tenant.id,[{...line,quantity:6}],new Prisma.Decimal(0));assert.equal(capped.items.filter(i=>i.isFreeReward).reduce((s,i)=>s+i.quantity,0),1);
  await prisma.promotion.update({where:{id:promotion.id},data:{maxDiscount:1500}});
  const noPartial=await checkoutTotals(tenant.id,[{...line,quantity:2}],new Prisma.Decimal(0));assert.ok(noPartial.itemDiscount.isZero());
 });
}
