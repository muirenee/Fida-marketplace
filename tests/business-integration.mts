import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { test } from 'node:test';

process.env.APP_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'local-test-only-secret-at-least-thirty-two-characters';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55439/postgres?connection_limit=1';
delete process.env.FLUTTERWAVE_SECRET_KEY;
delete process.env.FLUTTERWAVE_WEBHOOK_SECRET;
const db = await PGlite.create();
const sql = execFileSync('node_modules/.bin/prisma', ['migrate','diff','--from-empty','--to-schema','packages/database/prisma/schema.prisma','--script'], {encoding:'utf8',env:process.env});
await db.exec(sql);
const socket = new PGLiteSocketServer({db,port:55439,host:'127.0.0.1'});
await socket.start();
const { prisma } = await import('../packages/database/src/client.js');
const { buildServer } = await import('../apps/api/src/server.js');
const app = await buildServer();
await app.ready();
const owner=await prisma.user.create({data:{email:'owner@example.test',phone:'+250788000001'}});
const customer=await prisma.user.create({data:{email:'customer@example.test',phone:'+250788000002'}});
const outsider=await prisma.user.create({data:{email:'outsider@example.test',phone:'+250788000003'}});
const staff=await prisma.user.create({data:{email:'staff@example.test'}});
const admin=await prisma.user.create({data:{email:'admin@example.test',isPlatformAdmin:true}});
const tenant=await prisma.tenant.create({data:{name:'Test Kitchen',slug:'test-kitchen',status:'ACTIVE',merchantType:'RESTAURANT',taxPercent:10,platformCommissionPercent:10}});
const other=await prisma.tenant.create({data:{name:'Other Kitchen',slug:'other-kitchen',status:'ACTIVE',merchantType:'RESTAURANT'}});
await prisma.tenantMembership.createMany({data:[{tenantId:tenant.id,userId:owner.id,role:'OWNER'},{tenantId:tenant.id,userId:staff.id,role:'STAFF'}]});
const branch=await prisma.branch.create({data:{tenantId:tenant.id,name:'Central',latitude:-1.95,longitude:30.05}});
await prisma.deliveryZone.create({data:{branchId:branch.id,minDistanceKm:0,maxDistanceKm:10,fee:500}});
const category=await prisma.category.create({data:{tenantId:tenant.id,name:'Lunch',slug:'lunch'}});
const product=await prisma.product.create({data:{tenantId:tenant.id,categoryId:category.id,name:'Rice bowl',price:1000,options:[{name:'Avocado',price:200}]}});
const otherProduct=await prisma.product.create({data:{tenantId:other.id,name:'Private product',price:900}});
const request=async(method:string,url:string,user=owner,payload?:unknown,expected=200)=>{
 const r=await app.inject({method:method as any,url,headers:{authorization:`Bearer ${app.jwt.sign({sub:user.id,type:'access'})}`,'x-tenant-id':tenant.id},...(payload===undefined?{}:{payload:payload as any})});
 assert.equal(r.statusCode,expected,`${method} ${url}: ${r.body}`);
 return r.body?r.json():null;
};
const checkout={tenantId:tenant.id,branchId:branch.id,paymentMethod:'CASH',fulfillmentType:'DELIVERY',deliveryAddress:'Kigali test address',deliveryLatitude:-1.951,deliveryLongitude:30.051,items:[{productId:product.id,quantity:1,options:['Avocado']}]};
let driver:any,driverUser:any,order:any;
try {
 await test('public marketplace lists merchants and opens their catalog with active delivery zones',async()=>{
  await prisma.deliveryZone.create({data:{branchId:branch.id,minDistanceKm:10,maxDistanceKm:20,fee:900,isActive:false}});
  const listed=await app.inject({method:'GET',url:'/v1/marketplace/merchants'});
  assert.equal(listed.statusCode,200,listed.body);
  assert.deepEqual(listed.json().map((m:any)=>m.id),[tenant.id]);
  assert.equal(listed.json()[0].branches[0].deliveryZones.length,1);
  const catalog=await app.inject({method:'GET',url:`/v1/marketplace/merchants/${tenant.slug}`});
  assert.equal(catalog.statusCode,200,catalog.body);
  assert.equal(catalog.json().categories[0].products[0].id,product.id);
  assert.equal(catalog.json().branches[0].deliveryZones.length,1);
  const search=await app.inject({method:'GET',url:'/v1/marketplace/merchants?q=Rice'});
  assert.equal(search.statusCode,200,search.body);
  assert.equal(search.json()[0].id,tenant.id);
 });
 await test('tenant isolation and staff write restrictions',async()=>{
  await request('PATCH',`/v1/merchant/products/${otherProduct.id}`,owner,{price:1},404);
  await request('PATCH',`/v1/merchant/products/${product.id}`,outsider,{price:1},403);
  await request('PATCH',`/v1/merchant/products/${product.id}`,staff,{price:1},403);
  await request('PATCH',`/v1/merchant/products/${product.id}`,owner,{imageUrl:`/v1/media/${other.id}/photo.png`},400);
  await request('POST','/v1/notifications/devices',customer,{app:'merchant',token:'a'.repeat(32)},403);
 });
 await test('driver creation never exposes password hashes, enrollment is tenant scoped',async()=>{
  driver=await request('POST','/v1/merchant/drivers/create',owner,{email:'driver@example.test',phone:'+250788000004',firstName:'Aline',password:'Test-password-123',branchId:branch.id},201);
  assert.equal(JSON.stringify(driver).includes('passwordHash'),false);
  driverUser=await prisma.user.findUniqueOrThrow({where:{id:driver.user.id}});
  assert.ok(driverUser.passwordHash);assert.notEqual(driverUser.passwordHash,'Test-password-123');
  await request('PATCH',`/v1/merchant/drivers/${driver.id}/details`,owner,{maxConcurrentOrders:1,vehicleType:'BICYCLE'});
  await request('PATCH','/v1/driver/availability',driverUser,{isOnline:true,isAvailable:true});
 });
 await test('required groups and separately configured lines are priced on the server',async()=>{
  const configured=await request('POST','/v1/merchant/products',owner,{name:'Custom meal',price:1000,categoryId:category.id,options:[{name:'White rice',price:0,group:'Rice',minSelect:1,maxSelect:1},{name:'Brown rice',price:200,group:'Rice',minSelect:1,maxSelect:1},{name:'Cheese',price:100}]},201);
  await request('POST','/v1/customer/orders',customer,{...checkout,items:[{productId:configured.id,quantity:1}]},409);
  await request('POST','/v1/customer/orders',customer,{...checkout,items:[{productId:configured.id,quantity:1,options:['White rice','Brown rice']}]},409);
  const payload={...checkout,fulfillmentType:'PICKUP',deliveryInstructions:'Please include utensils.',items:[{productId:configured.id,quantity:1,options:['White rice']},{productId:configured.id,quantity:2,options:['Brown rice','Cheese']}]};
  const preview=await request('POST','/v1/customer/checkout-preview',customer,payload);
  const placed=await request('POST','/v1/customer/orders',customer,payload,201);
  assert.equal(placed.items.length,2);assert.equal(Number(placed.subtotal),3600);assert.equal(Number(placed.total),Number(preview.total));assert.equal(placed.deliveryInstructions,'Please include utensils.');
  await request('PATCH',`/v1/merchant/products/${configured.id}`,owner,{isAvailable:false});
  await request('POST','/v1/customer/orders',customer,payload,409);
  await request('PATCH',`/v1/merchant/products/${configured.id}`,owner,{options:[{name:' White rice ',price:0},{name:'White rice',price:0}]},400);
 });
 await test('operator pay controls are authorized and require valid rates',async()=>{
  await request('PATCH','/v1/merchant/driver-pay',outsider,{driverBasePay:300,driverPerKmPay:50},403);
  await request('PATCH','/v1/merchant/driver-pay',staff,{driverBasePay:300,driverPerKmPay:50},403);
  await request('PATCH','/v1/merchant/driver-pay',owner,{driverBasePay:-1,driverPerKmPay:50},400);
  await request('PATCH','/v1/merchant/driver-pay',owner,{driverBasePay:300,driverPerKmPay:50});
 });
 await test('checkout blocks suspended categories, closed branches, unavailable payments and invalid options',async()=>{
  await request('PATCH',`/v1/merchant/categories/${category.id}`,owner,{isActive:false});
  await request('POST','/v1/customer/orders',customer,checkout,409);
  await request('PATCH',`/v1/merchant/categories/${category.id}`,owner,{isActive:true});
  await request('PATCH',`/v1/merchant/branches/${branch.id}/hours`,owner,{closedUntil:new Date(Date.now()+3600000).toISOString()});
  await request('POST','/v1/customer/orders',customer,checkout,409);
  await request('PATCH',`/v1/merchant/branches/${branch.id}/hours`,owner,{closedUntil:null});
  await request('POST','/v1/customer/orders',customer,{...checkout,paymentMethod:'CARD'},409);
  await request('POST','/v1/customer/orders',customer,{...checkout,items:[{productId:product.id,quantity:1,options:['Unknown']}]},409);
  await request('POST','/v1/customer/orders',customer,{...checkout,items:[{productId:product.id,quantity:1.5}]},400);
 });
 await test('server prices options, limits promotions and makes checkout retry idempotent',async()=>{
  await prisma.promotion.create({data:{tenantId:tenant.id,code:'ONCE',percent:10,maxDiscount:500,maxUses:1,expiresAt:new Date(Date.now()+86400000)}});
  const body={...checkout,promoCode:'ONCE',checkoutKey:'test-checkout-idempotency-001'};
  const preview=await request('POST','/v1/customer/checkout-preview',customer,{...body,latitude:-1.951,longitude:30.051});
  order=await request('POST','/v1/customer/orders',customer,body,201);
  assert.equal(Number(order.subtotal),1200);assert.equal(Number(order.discount),120);assert.equal(Number(order.tax),108);assert.equal(Number(order.total),1688);assert.equal(Number(preview.total),1688);
  const retried=await request('POST','/v1/customer/orders',customer,body);assert.equal(retried.id,order.id);
  await request('POST','/v1/customer/orders',customer,{...checkout,promoCode:'ONCE'},409);
  assert.equal(await prisma.promotion.findUniqueOrThrow({where:{tenantId_code:{tenantId:tenant.id,code:'ONCE'}}}).then(p=>p.usedCount),1);
  assert.match(order.deliveryPin,/^\d{4}$/);
 });
 await test('delivery capacity, customer-only PIN, transition guards and completion ledger',async()=>{
  for(const status of ['ACCEPTED','PREPARING','READY_FOR_PICKUP'])await request('PATCH',`/v1/merchant/orders/${order.id}/status`,owner,{status});
  const merchantOrders=await request('GET','/v1/merchant/orders');assert.equal(JSON.stringify(merchantOrders).includes('deliveryPin'),false);
  const offers=await request('GET','/v1/driver/deliveries/available',driverUser);assert.ok(Number(offers.find((d:any)=>d.id===order.delivery.id).estimatedPayout)>=300);
  const claimed=await request('POST',`/v1/driver/deliveries/${order.delivery.id}/claim`,driverUser,{});assert.equal(JSON.stringify(claimed).includes('deliveryPin'),false);
  const agreedPay=Number(claimed.estimatedPayout);assert.ok(agreedPay>=300);
  await request('PATCH','/v1/merchant/driver-pay',owner,{driverBasePay:900,driverPerKmPay:0});
  assert.equal(Number((await prisma.delivery.findUniqueOrThrow({where:{id:claimed.id}})).estimatedPayout),agreedPay);
  await request('PATCH','/v1/driver/location',driverUser,{latitude:-1.952,longitude:30.052});
  const tracking=await request('GET',`/v1/customer/orders/${order.id}`,customer);assert.equal(tracking.delivery.driver.latitude,-1.952);assert.ok(tracking.branch.latitude);
  await request('GET',`/v1/customer/orders/${order.id}`,outsider,undefined,404);
  await request('PATCH',`/v1/merchant/drivers/${driver.id}`,owner,{isActive:false},409);
  const second=await request('POST','/v1/customer/orders',customer,checkout,201);
  for(const status of ['ACCEPTED','PREPARING','READY_FOR_PICKUP'])await request('PATCH',`/v1/merchant/orders/${second.id}/status`,owner,{status});
  await request('POST',`/v1/driver/deliveries/${second.delivery.id}/claim`,driverUser,{},409);
  for(const status of ['AT_PICKUP','PICKED_UP','AT_DROPOFF'])await request('PATCH',`/v1/driver/deliveries/${order.delivery.id}/status`,driverUser,{status});
  await request('PATCH',`/v1/driver/deliveries/${order.delivery.id}/status`,driverUser,{status:'DELIVERED',pin:'wrong'},400);
  await request('PATCH',`/v1/driver/deliveries/${order.delivery.id}/status`,driverUser,{status:'DELIVERED',pin:order.deliveryPin});
  await request('PATCH',`/v1/driver/deliveries/${order.delivery.id}/status`,driverUser,{status:'DELIVERED',pin:order.deliveryPin},409);
  const completed=await prisma.order.findUniqueOrThrow({where:{id:order.id}});assert.equal(completed.status,'COMPLETED');assert.equal(completed.paymentStatus,'PAID');
  assert.equal(await prisma.financeEntry.count({where:{orderId:order.id,kind:'COMMISSION_DUE'}}),1);
  assert.ok(await prisma.notificationEvent.count({where:{orderId:order.id}})>=5);
 });
 await test('receipts and commission invoices are automatic, stable and tenant scoped',async()=>{
  assert.equal(await prisma.businessDocument.count({where:{orderId:order.id}}),2);
  const receipt=await request('GET',`/v1/customer/orders/${order.id}/receipt`,customer);
  assert.equal(Number(receipt.payload.total),Number(order.total));assert.equal(receipt.payload.lines[0].description,order.items[0].productName);
  const retry=await request('GET',`/v1/customer/orders/${order.id}/receipt`,customer);assert.deepEqual(retry,receipt);
  await request('GET',`/v1/customer/orders/${order.id}/receipt`,outsider,undefined,404);
  await request('GET','/v1/merchant/documents',staff,undefined,403);
  const invoices=await request('GET','/v1/merchant/documents');assert.equal(invoices[0].kind,'COMMISSION_INVOICE');assert.equal(Number(invoices[0].payload.total),Number(order.platformCommissionAmount));
  const finished=await request('GET',`/v1/customer/orders/${order.id}`,customer);assert.equal(finished.delivery.driver.latitude,null);assert.equal(finished.delivery.driver.longitude,null);
  const earnings=await request('GET','/v1/driver/earnings',driverUser);assert.equal(earnings.length,1);assert.ok(Number(earnings[0].estimatedPayout)>=300);
 });
 await test('refund access, approval and receipt requirement',async()=>{
  const refund=await request('POST',`/v1/customer/orders/${order.id}/refund`,customer,{reason:'Missing food'});
  await request('PATCH',`/v1/admin/business/refunds/${refund.id}`,owner,{status:'APPROVED',resolution:'Checked'},403);
  await request('PATCH',`/v1/admin/business/refunds/${refund.id}`,admin,{status:'REFUNDED',resolution:'Checked'},409);
  await request('PATCH',`/v1/admin/business/refunds/${refund.id}`,admin,{status:'APPROVED',resolution:'Checked'});
  await request('PATCH',`/v1/admin/business/refunds/${refund.id}`,admin,{status:'REFUNDED',resolution:'Cash returned',externalReference:'test-cash-receipt'});
  const result=await prisma.order.findUniqueOrThrow({where:{id:order.id}});assert.equal(result.paymentStatus,'REFUNDED');
  assert.equal(await prisma.financeEntry.count({where:{orderId:order.id,kind:'COMMISSION_REVERSAL'}}),1);
  assert.equal(await prisma.businessDocument.count({where:{orderId:order.id}}),4);
  const refundedReceipt=await request('GET',`/v1/customer/orders/${order.id}/receipt`,customer);assert.equal(refundedReceipt.creditNotes.length,1);assert.equal(Number(refundedReceipt.creditNotes[0].payload.total),-Number(order.total));
 });
 await test('payment verification rejects tampering and duplicate notifications do not double book',async()=>{
  process.env.FLUTTERWAVE_SECRET_KEY='test-key';process.env.FLUTTERWAVE_WEBHOOK_SECRET='test-webhook-secret';
  const paid=await request('POST','/v1/customer/orders',customer,{...checkout,paymentMethod:'CARD'},201);
  await prisma.paymentAttempt.create({data:{orderId:paid.id,customerId:customer.id,reference:`fida-${paid.id}`,provider:'FLUTTERWAVE'}});
  const original=globalThis.fetch;let providerAmount=1;
  globalThis.fetch=async()=>new Response(JSON.stringify({status:'success',data:{status:'successful',tx_ref:`fida-${paid.id}`,currency:'RWF',amount:providerAmount}}),{status:200});
  try{
   const webhook=(secret:string)=>app.inject({method:'POST',url:'/v1/payments/webhook',headers:{'verif-hash':secret},payload:{event:'charge.completed',data:{id:12345}}});
   assert.equal((await webhook('forged')).statusCode,401);
   assert.equal((await webhook('test-webhook-secret')).statusCode,200);
   assert.equal((await prisma.order.findUniqueOrThrow({where:{id:paid.id}})).paymentStatus,'PENDING');
   providerAmount=Number(paid.total);
   assert.equal((await webhook('test-webhook-secret')).statusCode,200);
   assert.equal((await webhook('test-webhook-secret')).statusCode,200);
   assert.equal((await prisma.order.findUniqueOrThrow({where:{id:paid.id}})).paymentStatus,'PAID');
   assert.equal(await prisma.financeEntry.count({where:{orderId:paid.id,kind:'ONLINE_PAYMENT'}}),1);
  }finally{globalThis.fetch=original;}
 });
} finally {
 await app.close();await prisma.$disconnect();await socket.stop();await db.close();
}
