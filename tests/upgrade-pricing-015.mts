import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Prisma} from '../packages/database/src/client.js';
import {checkoutTotals,includedTax} from '../apps/api/src/lib/checkout.js';
export async function verifyPricing015({prisma,request,app,customer,tenant,other,owner,checkout}:any){
 const dec=(v:number)=>new Prisma.Decimal(v);
 const product=await prisma.product.create({data:{id:'015-a-trigger',tenantId:tenant.id,name:'Meal 015',price:1180}});
 const reward=await prisma.product.create({data:{id:'015-b-reward',tenantId:tenant.id,name:'Drink 015',price:590}});
 const line=(p:any,q:number)=>({productId:p.id,productName:p.name,quantity:q,unitPrice:p.price,basePrice:p.price});
 const body={code:'CROSS015',discountType:'BOGO',productId:product.id,rewardProductId:reward.id,buyQuantity:2,getQuantity:1,maxDiscount:10000,maxUses:100,minimumOrder:0,expiresAt:new Date(Date.now()+86400000).toISOString()};
 await test('cross-product rewards validate ownership and availability and name the selected catalog reward',async()=>{
  const foreign=await prisma.product.create({data:{tenantId:other.id,name:'Foreign',price:100}});
  await request('POST','/v1/merchant/promotions',owner,{...body,rewardProductId:foreign.id},400);
  await prisma.product.update({where:{id:reward.id},data:{isAvailable:false}});
  await request('POST','/v1/merchant/promotions',owner,body,400);
  await prisma.product.update({where:{id:reward.id},data:{isAvailable:true}});
  await request('POST','/v1/merchant/promotions',owner,body,201);
  const catalog=await app.inject({method:'GET',url:`/v1/marketplace/merchants/${tenant.slug}`});
  const offer=catalog.json().promotions.find((p:any)=>p.code===body.code);assert.equal(offer.rewardProductId,reward.id);assert.equal(offer.rewardProductName,reward.name);
 });
 await test('cross-product checkout frees existing units, adds missing units, honors thresholds and whole caps',async()=>{
  for(const quantity of [1,2,3,4])for(const existing of [0,1,3]){
   const totals=await checkoutTotals(tenant.id,[line(product,quantity),...(existing?[line(reward,existing)]:[])],dec(0));
   const earned=Math.floor(quantity/2);
   assert.equal(totals.items.filter(i=>i.isFreeReward).reduce((s,i)=>s+i.quantity,0),earned);
   assert.equal(totals.total.toNumber(),1180*quantity+590*Math.max(0,existing-earned));
   assert.equal(totals.items.reduce((s,i)=>s.plus(i.totalPrice),dec(0)).toString(),totals.subtotal.toString());
   assert.equal(totals.items.reduce((s,i)=>s.plus(i.discount),dec(0)).toString(),totals.discount.toString());
   assert.ok(totals.items.every(i=>i.discount.lte(i.totalPrice)));
  }
  await prisma.promotion.update({where:{tenantId_code:{tenantId:tenant.id,code:body.code}},data:{maxDiscount:590}});
  const capped=await checkoutTotals(tenant.id,[line(product,4)],dec(0));assert.equal(capped.items.filter(i=>i.isFreeReward)[0].quantity,1);
  await prisma.promotion.update({where:{tenantId_code:{tenantId:tenant.id,code:body.code}},data:{maxDiscount:10000}});
 });
 await test('free rewards never qualify as paid triggers and required choices produce an actionable hint',async()=>{
  await request('POST','/v1/merchant/promotions',owner,{...body,code:'NOCHAIN015',productId:reward.id,rewardProductId:product.id,buyQuantity:1},201);
  const totals=await checkoutTotals(tenant.id,[line(product,2),line(reward,1)],dec(0));assert.equal(totals.items.filter(i=>i.isFreeReward).length,1);assert.equal(totals.total.toNumber(),2360);
  await prisma.promotion.update({where:{tenantId_code:{tenantId:tenant.id,code:'NOCHAIN015'}},data:{isActive:false}});
  await prisma.product.update({where:{id:reward.id},data:{options:[{name:'Cola',price:0,group:'Flavor',minSelect:1,maxSelect:1}]}});
  const hinted=await checkoutTotals(tenant.id,[line(product,2)],dec(0));assert.equal(hinted.rewardHints[0].productId,reward.id);assert.equal(hinted.items.length,1);
  const quoted=await request('POST','/v1/customer/checkout-preview',customer,{...checkout,fulfillmentType:'PICKUP',items:[{productId:product.id,quantity:2},{productId:reward.id,quantity:1,options:['Cola']}]});assert.equal(quoted.items.find((i:any)=>i.isFreeReward).selectedOptions[0].name,'Cola');
  await prisma.product.update({where:{id:reward.id},data:{isAvailable:false}});
  const unavailable=await checkoutTotals(tenant.id,[line(product,2)],dec(0));assert.equal(unavailable.items.length,1);
  await prisma.product.update({where:{id:reward.id},data:{isAvailable:true,options:[]}});
 });
 await test('delivery markup is per unit, tax-inclusive, mode-specific and snapshotted',async()=>{
  await request('PATCH','/v1/merchant/settings',owner,{deliveryMarkup:-1},400);await request('PATCH','/v1/merchant/settings',owner,{deliveryMarkup:0.001},400);
  await request('PATCH','/v1/merchant/settings',owner,{deliveryMarkup:118,taxPercent:18});
  const delivery=await checkoutTotals(tenant.id,[line(product,2)],dec(590),null,prisma,'DELIVERY');
  assert.equal(delivery.total.toNumber(),3186);assert.equal(delivery.tax.toString(),includedTax(dec(3186),dec(18)).toString());assert.equal(delivery.items.find(i=>i.isFreeReward)!.discount.toNumber(),708);
  for(const mode of ['PICKUP','DINE_OUT'] as const){const t=await checkoutTotals(tenant.id,[line(product,2)],dec(0),null,prisma,mode);assert.equal(t.total.toNumber(),2360);assert.equal(t.deliveryMarkup.toNumber(),0);}
  const payload={...checkout,items:[{productId:product.id,quantity:2}]},preview=await request('POST','/v1/customer/checkout-preview',customer,payload);
  await request('PATCH','/v1/merchant/settings',owner,{deliveryMarkup:236});
  await request('POST','/v1/customer/orders',customer,{...payload,confirmedQuote:preview.quoteHash},409);
  const newQuote=await request('POST','/v1/customer/checkout-preview',customer,payload);
  const order=await request('POST','/v1/customer/orders',customer,{...payload,confirmedQuote:newQuote.quoteHash},201);assert.equal(order.items.find((i:any)=>!i.isFreeReward).baseUnitPrice,'1416');
  await prisma.order.update({where:{id:order.id},data:{status:'CANCELLED'}});await request('PATCH','/v1/merchant/settings',owner,{deliveryMarkup:0});
 });
 await test('Dine Out can be enabled, discovered, ordered and completed without a driver',async()=>{
  const payload={...checkout,fulfillmentType:'DINE_OUT',items:[{productId:product.id,quantity:1}]};
  await request('POST','/v1/customer/checkout-preview',customer,payload,409);await request('POST','/v1/customer/orders',customer,payload,409);
  await request('PATCH',`/v1/merchant/branches/${checkout.branchId}/fulfillment`,owner,{dineOutEnabled:true});
  const found=await app.inject({method:'GET',url:'/v1/marketplace/merchants?fulfillment=DINE_OUT'});assert.ok(found.json().some((m:any)=>m.id===tenant.id));
  const quote=await request('POST','/v1/customer/checkout-preview',customer,payload);assert.equal(Number(quote.deliveryFee),0);
  const order=await request('POST','/v1/customer/orders',customer,{...payload,confirmedQuote:quote.quoteHash},201);assert.equal(order.fulfillmentType,'DINE_OUT');assert.equal(order.delivery,null);assert.equal(order.deliveryPin,null);
  for(const status of ['ACCEPTED','PREPARING','READY_FOR_PICKUP','COMPLETED'])await request('PATCH',`/v1/merchant/orders/${order.id}/status`,owner,{status});
  assert.equal(await prisma.delivery.count({where:{orderId:order.id}}),0);assert.equal(await prisma.businessDocument.count({where:{orderId:order.id}}),2);
 });
}
