import {Prisma} from '@fida/database/client';
type DB=Prisma.TransactionClient;
function scope(id:string){
 const orders=Prisma.sql`SELECT id FROM "Order" WHERE "tenantId"=${id}`;
 const products=Prisma.sql`SELECT id FROM "Product" WHERE "tenantId"=${id}`;
 const branches=Prisma.sql`SELECT id FROM "Branch" WHERE "tenantId"=${id}`;
 const operators=Prisma.sql`SELECT id FROM "DeliveryOperator" WHERE "tenantId"=${id}`;
 const drivers=Prisma.sql`SELECT id FROM "Driver" WHERE "operatorId" IN (${operators}) OR ("operatorId" IS NULL AND "branchId" IN (${branches}))`;
 const users=Prisma.sql`SELECT u.id FROM "User" u WHERE NOT u."isPlatformAdmin" AND (EXISTS(SELECT 1 FROM "TenantMembership" m WHERE m."userId"=u.id AND m."tenantId"=${id}) OR EXISTS(SELECT 1 FROM "Driver" d WHERE d."userId"=u.id AND d.id IN (${drivers}))) AND NOT EXISTS(SELECT 1 FROM "TenantMembership" m WHERE m."userId"=u.id AND m."tenantId"<>${id}) AND NOT EXISTS(SELECT 1 FROM "Driver" d WHERE d."userId"=u.id AND d.id NOT IN (${drivers}))`;
 return {orders,products,branches,operators,drivers,users};
}
function steps(id:string){
 const s=scope(id),tenant=Prisma.sql`t."tenantId"=${id}`,order=Prisma.sql`t."orderId" IN (${s.orders})`;
 return [
  ['NotificationEvent',order],['PaymentAttempt',order],
  ...['Review','SupportCase','RefundRequest','BusinessDocument','FinanceEntry'].map(model=>[model,Prisma.sql`(${tenant} OR ${order})`] as const),
  ['CommissionPeriod',tenant],['Promotion',Prisma.sql`(${tenant} OR t."productId" IN (${s.products}))`],
  ['StoreVisit',tenant],['Favorite',tenant],
  ['MediaAsset',Prisma.sql`(t.url LIKE ${`/v1/media/${id}/%`} OR t.url IN (SELECT "logoUrl" FROM "Tenant" WHERE id=${id} UNION SELECT "coverUrl" FROM "Tenant" WHERE id=${id} UNION SELECT "imageUrl" FROM "Product" WHERE "tenantId"=${id})) AND NOT EXISTS(SELECT 1 FROM "Tenant" x WHERE x.id<>${id} AND (x."logoUrl"=t.url OR x."coverUrl"=t.url)) AND NOT EXISTS(SELECT 1 FROM "Product" x WHERE x."tenantId"<>${id} AND x."imageUrl"=t.url) AND NOT EXISTS(SELECT 1 FROM "MerchantApplication" x WHERE (x."tenantId" IS NULL OR x."tenantId"<>${id}) AND (x.payload->>'logoUrl'=t.url OR x.payload->>'coverUrl'=t.url))`],
  ['MerchantApplication',tenant],
  ['DeviceToken',Prisma.sql`t."userId" IN (${s.users}) AND t.app IN ('merchant','driver')`],
  ['Session',Prisma.sql`t."userId" IN (${s.users})`],
  ['Delivery',order],['OrderItem',order],['Order',tenant],['Product',tenant],['Category',tenant],
  ['Driver',Prisma.sql`t.id IN (${s.drivers})`],['DeliveryZone',Prisma.sql`t."branchId" IN (${s.branches})`],
  ['TenantMembership',tenant],['Branch',tenant],['DeliveryOperator',tenant],['Tenant',Prisma.sql`t.id=${id}`],
 ] as [string,Prisma.Sql][];
}
async function fingerprint(db:DB,model:string,where:Prisma.Sql){
 // Table names are compile-time literals from steps(), never request strings.
 const rows=await db.$queryRaw<{count:number;digest:string}[]>(Prisma.sql`SELECT count(*)::int AS count,md5(COALESCE(string_agg(md5(row_to_json(t)::text),'' ORDER BY row_to_json(t)::text),'')) AS digest FROM ${Prisma.raw(`"${model}"`)} t WHERE ${where}`);
 return {model,...rows[0]};
}
export async function storePurgePlan(db:DB,id:string){
 if(!await db.tenant.findUnique({where:{id}}))throw Object.assign(new Error('Store not found.'),{statusCode:404});
 const s=scope(id);
 const external=await db.$queryRaw<{count:number}[]>(Prisma.sql`SELECT count(*)::int AS count FROM "Delivery" WHERE "driverId" IN (${s.drivers}) AND "orderId" NOT IN (${s.orders}) AND status IN ('ASSIGNED','AT_PICKUP','PICKED_UP','AT_DROPOFF')`);
 if(external[0].count)throw Object.assign(new Error('Reassign active deliveries for other stores before purging this fleet.'),{statusCode:409});
 const rows=[];
 rows.push(await fingerprint(db,'User',Prisma.sql`t.id IN (${s.users})`));
 for(const [model,where] of steps(id))rows.push(await fingerprint(db,model,where));
 return {kind:'STORE_PURGE',storeId:id,rows};
}
export async function executeStorePurge(db:DB,id:string){
 const s=scope(id);
 // Identity records remain; old refresh and access tokens are both invalidated.
 await db.$executeRaw(Prisma.sql`UPDATE "User" SET "authVersion"="authVersion"+1,"updatedAt"=NOW() WHERE id IN (${s.users})`);
 for(const [model,where] of steps(id))await db.$executeRaw(Prisma.sql`DELETE FROM ${Prisma.raw(`"${model}"`)} t WHERE ${where}`);
 const settings=await db.runtimeSettings.findUnique({where:{id:'platform'}});
 if(settings){const values=settings.values as Record<string,any>;values.FEATURED_STORE_IDS=String(values.FEATURED_STORE_IDS||'').split(',').filter(v=>v!==id).join(',');await db.runtimeSettings.update({where:{id:'platform'},data:{values}});}
}
