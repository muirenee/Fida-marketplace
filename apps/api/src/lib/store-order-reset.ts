import {Prisma} from '@fida/database/client';
type DB=Prisma.TransactionClient;
const fail=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:409});};
function steps(id:string):[string,Prisma.Sql][]{
 const orders=Prisma.sql`SELECT id FROM "Order" WHERE "tenantId"=${id}`;
 const order=Prisma.sql`t."orderId" IN (${orders})`;
 return [
  ...['NotificationEvent','PaymentAttempt','Delivery','OrderItem'].map(m=>[m,order] as [string,Prisma.Sql]),
  ...['Review','SupportCase','RefundRequest','BusinessDocument','FinanceEntry'].map(m=>[m,Prisma.sql`(${order} OR t."tenantId"=${id})`] as [string,Prisma.Sql]),
  ['CommissionPeriod',Prisma.sql`t."tenantId"=${id}`],['Order',Prisma.sql`t."tenantId"=${id}`],
 ];
}
export async function storeOrderResetPlan(db:DB,id:string){
 const store=await db.tenant.findUnique({where:{id}});
 if(!store)throw Object.assign(new Error('Store not found.'),{statusCode:404});
 if(store.isAcceptingOrders)fail('Pause this store before resetting its orders.');
 if(await db.order.count({where:{tenantId:id,status:{notIn:['COMPLETED','CANCELLED','REJECTED']}}}))fail('Complete or cancel active orders before resetting store history.');
 const rows=[];
 for(const [model,where] of steps(id)){
  const [row]=await db.$queryRaw<{count:number;digest:string}[]>(Prisma.sql`SELECT count(*)::int AS count,md5(COALESCE(string_agg(md5(row_to_json(t)::text),'' ORDER BY row_to_json(t)::text),'')) AS digest FROM ${Prisma.raw(`"${model}"`)} t WHERE ${where}`);
  rows.push({model,...row});
 }
 return {kind:'STORE_ORDERS_RESET',storeId:id,rows};
}
export async function executeStoreOrderReset(db:DB,id:string){
 for(const [model,where] of steps(id))await db.$executeRaw(Prisma.sql`DELETE FROM ${Prisma.raw(`"${model}"`)} t WHERE ${where}`);
 // Preserve store/menu/settings, staff, drivers, favorites, media and promotions.
 // This resets local records; it does not refund or delete provider-side payments.
}
