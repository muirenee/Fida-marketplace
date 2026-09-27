import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Prisma} from '../packages/database/src/client.js';
import {checkoutTotals} from '../apps/api/src/lib/checkout.js';
export async function verify011({prisma,request,customer,outsider,tenant,other,owner,checkout}:any){
 await test('BOGO validates scope, adds fully free configurations, caps whole rewards, and respects stacking and usage',async()=>{
  const item=await prisma.product.create({data:{tenantId:tenant.id,name:'BOGO bowl',price:1000,options:[{name:'Cheese',price:200}]}});
  const external=await prisma.product.create({data:{tenantId:other.id,name:'External BOGO',price:1000}});
  const offer={code:'BOGO011',discountType:'BOGO',productId:item.id,maxDiscount:2500,minimumOrder:0,maxUses:2,expiresAt:new Date(Date.now()+86400000).toISOString(),stackable:true};
  const create=(values:any,status=400)=>request('POST','/v1/merchant/promotions',owner,{...offer,...values},status);
  await create({productId:null});await create({productId:external.id});await create({buyQuantity:51});await create({maxDiscount:999});
  const promo=await create({},201);
  const lines=(quantity:number)=>[{productId:item.id,productName:item.name,quantity,basePrice:new Prisma.Decimal(1000),unitPrice:new Prisma.Decimal(1200)}];
  const price=(quantity:number,code?:string)=>checkoutTotals(tenant.id,lines(quantity),new Prisma.Decimal(0),code);
  for(const [qty,discount] of [[1,1200],[2,2400],[3,2400],[4,2400],[6,2400]]){
   const total=await price(qty);assert.equal(total.itemDiscount.toNumber(),discount);assert.equal(total.subtotal.toNumber(),qty*1200+discount);
  }
  const split=await checkoutTotals(tenant.id,[...lines(1),...lines(2)],new Prisma.Decimal(0));assert.equal(split.itemDiscount.toNumber(),2400);assert.equal(split.items.reduce((s,i)=>s+i.discount.toNumber(),0),2400);
  await create({code:'BOGOCART',discountType:'PERCENT',productId:null,percent:10,maxDiscount:5000,minimumOrder:1500},201);
  await assert.rejects(price(1,'BOGOCART'),/minimum after item discounts/);
  assert.equal((await price(3,'BOGOCART')).cartDiscount.toNumber(),360);
  await prisma.promotion.update({where:{id:promo.id},data:{stackable:false}});
  await assert.rejects(price(3,'BOGOCART'),/cannot be combined/);
  await prisma.promotion.update({where:{id:promo.id},data:{stackable:true,expiresAt:new Date(0)}});
  assert.equal((await price(2)).itemDiscount.toNumber(),0);
  await prisma.promotion.update({where:{id:promo.id},data:{expiresAt:new Date(Date.now()+86400000),maxUses:1}});
  const payload={...checkout,items:[{productId:item.id,quantity:2,options:['Cheese']}],checkoutKey:'bogo011-idempotent-checkout'};
  const preview=await request('POST','/v1/customer/checkout-preview',customer,payload);
  assert.equal(Number(preview.subtotal),4800);assert.equal(Number(preview.itemDiscount),2400);
  const order=await request('POST','/v1/customer/orders',customer,{...payload,confirmedTotal:Number(preview.total)},201);
  const retry=await request('POST','/v1/customer/orders',customer,{...payload,confirmedTotal:Number(preview.total)},200);assert.equal(retry.id,order.id);
  assert.equal((await prisma.promotion.findUniqueOrThrow({where:{id:promo.id}})).usedCount,1);
  assert.equal((await price(2)).itemDiscount.toNumber(),0);
  let store=(await request('GET','/v1/marketplace/merchants',customer)).find((s:any)=>s.id===tenant.id);
  assert.ok(!store.promotions.some((p:any)=>p.code===offer.code));
  await prisma.promotion.update({where:{id:promo.id},data:{maxUses:10}});
  store=(await request('GET','/v1/marketplace/merchants',customer)).find((s:any)=>s.id===tenant.id);
  assert.equal(store.promotions.find((p:any)=>p.code===offer.code).productName,item.name);
  const detail=await request('GET',`/v1/marketplace/merchants/${tenant.slug}`,customer);
  assert.equal(detail.categories.flatMap((c:any)=>c.products).find((p:any)=>p.id===item.id).promotions[0].discountType,'BOGO');
  await prisma.product.update({where:{id:item.id},data:{isAvailable:false}});
  store=(await request('GET','/v1/marketplace/merchants',customer)).find((s:any)=>s.id===tenant.id);
  assert.ok(!store.promotions.some((p:any)=>p.code===offer.code));
 });
 await test('pin edits are owner-scoped, validate coordinate pairs, preserve a default, and change delivery eligibility',async()=>{
  const path='/v1/customer/addresses';
  await request('POST',path,customer,{addressLine:'Bad',latitude:91,longitude:30},400);
  await request('POST',path,customer,{addressLine:'Missing pair',latitude:0},400);
  const a=await request('POST',path,customer,{addressLine:'Equator',latitude:0,longitude:0,isDefault:true},201);
  await request('PATCH',`${path}/${a.id}`,outsider,{addressLine:'Steal'},404);
  await request('PATCH',`${path}/${a.id}`,customer,{longitude:181,latitude:0},400);
  await request('PATCH',`${path}/${a.id}`,customer,{latitude:-1.951},400);
  const b=await request('PATCH',`${path}/${a.id}`,customer,{addressLine:'KK 31 entrance',latitude:-1.951,longitude:30.051,isDefault:true});
  assert.equal(Number(b.latitude),-1.951);assert.equal(b.addressLine,'KK 31 entrance');
  assert.equal((await request('GET',path,customer)).filter((a:any)=>a.isDefault).length,1);
  const stores=async(lat:number,lon:number)=>(await request('GET',`/v1/marketplace/merchants?latitude=${lat}&longitude=${lon}`,customer)).find((s:any)=>s.id===tenant.id);
  assert.equal((await stores(-1.951,30.051)).branches.find((b:any)=>b.id===checkout.branchId).deliversToLocation,true);
  assert.equal((await stores(0,0)).branches.find((b:any)=>b.id===checkout.branchId).deliversToLocation,false);
  await request('GET','/v1/marketplace/merchants?latitude=100&longitude=30',customer,undefined,400);
  await request('GET','/v1/marketplace/merchants?latitude=0',customer,undefined,400);
 });
}
